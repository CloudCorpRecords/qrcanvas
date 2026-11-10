import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  QrcanvasClient,
  callTool,
  createClient,
  DEFAULT_ENDPOINT_URL,
  isKnownTool,
  parseRpcBody,
  PROTOCOL_VERSION,
  TOOL_DEFS,
  TOOL_NAMES,
  VERSION,
} from "../src/forward.js";
import { handleCallTool } from "../src/mcp.js";
import type {
  FetchFn,
  FetchResponseLike,
  ToolDef,
  ToolResult,
} from "../src/types.js";

/**
 * All tests run against a stubbed JSON-RPC upstream that
 * implements the streamable-HTTP session flow
 * (initialize -> notifications/initialized -> tools/call):
 * no live network, and the real Hovercode endpoint is
 * never contacted.
 */

const FIXTURE_URL = new URL(
  "../../../harness/fixtures/hovercode-tools-original.json",
  import.meta.url,
);
const FIXTURE_AVAILABLE = existsSync(FIXTURE_URL);
const fixture = (
  FIXTURE_AVAILABLE
    ? JSON.parse(readFileSync(FIXTURE_URL, "utf-8"))
    : { tools: [] }
) as {
  tools: ToolDef[];
};
/**
 * Publish-survival guard (Wave 25 preflight, proven Wave 24 pattern):
 * the parity fixture lives in the build harness, outside the published
 * repo tree, so fixture-dependent tests skip cleanly when it is absent;
 * with the fixture present they run in full, with no skips.
 */
function skipWithoutFixture(t: {
  skip: (message: string) => void;
}): boolean {
  if (FIXTURE_AVAILABLE) return false;
  t.skip("parity fixture lives in the build harness, not the repo tree");
  return true;
}


const QR_TOOL = "create_qr_code";
const LIST_TOOL = "list_workspaces";
const LINK_TOOL = "create_short_link";

const EXPECTED_NAMES = [
  "list_workspaces", "create_qr_code", "build_page", "create_form",
  "get_analytics", "list_qr_codes", "create_short_link", "set_workspace",
  "create_qr_codes_bulk", "download_qr", "create_pdf_qr", "get_qr_code",
  "update_qr_code", "delete_qr_code", "get_qr_activity", "list_templates",
  "list_folders", "create_folder", "update_folder", "delete_folder",
  "list_tags", "update_form", "list_forms", "get_form",
  "get_form_responses", "create_page", "get_page", "update_page",
  "delete_page", "list_pages", "list_block_types", "get_short_link",
  "list_short_links", "update_short_link", "delete_short_link",
  "get_short_link_activity",
];

const NO_REQUIRED = [
  "list_workspaces", "get_analytics", "list_qr_codes", "create_pdf_qr",
  "list_templates", "list_folders", "list_tags", "list_forms",
  "list_pages", "list_block_types", "list_short_links",
];

const SAMPLE_RESULT = {
  content: [{ type: "text", text: "{\"id\":\"qr_1\"}" }],
  structuredContent: { id: "qr_1" },
};

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface FakeOptions {
  callResult?: Record<string, unknown>;
  callBodyText?: string;
  callError?: Record<string, unknown>;
  callStatus?: number;
  initError?: Record<string, unknown>;
  throwOn?: "initialize" | "tools/call";
  sessionId?: string | null;
  hangOnCall?: boolean;
  sse?: boolean;
}

function makeResponse(
  status: number,
  bodyText: string,
  headers: Record<string, string> = {},
): FetchResponseLike {
  const lowered = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lowered.get(name.toLowerCase()) ?? null },
    text: async () => bodyText,
  };
}

function jsonResponse(status: number, payload: unknown, headers: Record<string, string> = {}) {
  return makeResponse(status, JSON.stringify(payload), headers);
}

function makeUpstream(options: FakeOptions = {}): { fetchFn: FetchFn; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    calls.push({ url, headers: init?.headers ?? {}, body });
    const method = body.method as string;
    if (options.throwOn === method) throw new Error("socket hang up");
    if (method === "initialize") {
      if (options.initError !== undefined) {
        return jsonResponse(200, { jsonrpc: "2.0", id: body.id, error: options.initError });
      }
      const headers: Record<string, string> = {};
      const sessionId = options.sessionId === undefined ? "sess-xyz" : options.sessionId;
      if (sessionId !== null) headers["mcp-session-id"] = sessionId;
      return jsonResponse(200, {
        jsonrpc: "2.0", id: body.id,
        result: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, serverInfo: { name: "hovercode", version: "1.0.1" } },
      }, headers);
    }
    if (method === "notifications/initialized") return makeResponse(202, "");
    if (method === "tools/call") {
      if (options.hangOnCall) {
        return new Promise<FetchResponseLike>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) { reject(new Error("aborted")); return; }
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }
        });
      }
      if (options.callBodyText !== undefined) return makeResponse(options.callStatus ?? 200, options.callBodyText);
      if (options.callError !== undefined) return jsonResponse(200, { jsonrpc: "2.0", id: body.id, error: options.callError });
      const result = options.callResult ?? SAMPLE_RESULT;
      const payload = { jsonrpc: "2.0", id: body.id, result };
      if (options.sse) return makeResponse(200, `event: message\ndata: ${JSON.stringify(payload)}\n\n`);
      return jsonResponse(options.callStatus ?? 200, payload);
    }
    return jsonResponse(200, {});
  };
  return { fetchFn, calls };
}

function stubClient(options: FakeOptions = {}, extra: Record<string, unknown> = {}) {
  const upstream = makeUpstream(options);
  const c = new QrcanvasClient({ fetchFn: upstream.fetchFn, env: {}, ...extra });
  return { client: c, calls: upstream.calls };
}

function textOf(result: ToolResult): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0].text;
}
function methods(calls: Captured[]): string[] { return calls.map((c) => c.body.method as string); }

/* ------------------------------------------------------------------ */

describe("registration integrity (captured surface)", () => {
  it("serves exactly the fixture's 36 tools, deep-equal", (t) => {
    if (skipWithoutFixture(t)) return;
    assert.equal(fixture.tools.length, 36);
    assert.deepEqual(TOOL_DEFS, fixture.tools);
  });
  it("serves the 36 tool names in fixture order", (t) => {
    if (skipWithoutFixture(t)) return;
    assert.deepEqual(TOOL_NAMES, EXPECTED_NAMES);
    assert.deepEqual(TOOL_NAMES, fixture.tools.map((t) => t.name));
  });
  it("carries exactly the fixture's keys on each tool (no title invented)", () => {
    for (const tool of TOOL_DEFS) {
      assert.deepEqual(Object.keys(tool).sort(), ["description", "inputSchema", "name"]);
      assert.equal("title" in tool, false);
    }
  });
  it("carries exactly the fixture's required fields per tool", () => {
    const byName = new Map(TOOL_DEFS.map((t) => [t.name, t.inputSchema as { required?: string[] }]));
    assert.deepEqual(byName.get("create_qr_code")?.required, ["qr_data"]);
    assert.deepEqual(byName.get("build_page")?.required, ["title", "blocks"]);
    assert.deepEqual(byName.get("create_form")?.required, ["title", "fields"]);
    assert.deepEqual(byName.get("create_short_link")?.required, ["link"]);
    assert.deepEqual(byName.get("set_workspace")?.required, ["workspace"]);
    assert.deepEqual(byName.get("create_qr_codes_bulk")?.required, ["items"]);
    assert.deepEqual(byName.get("create_folder")?.required, ["name"]);
    assert.deepEqual(byName.get("create_page")?.required, ["title"]);
    for (const n of ["download_qr", "get_qr_code", "update_qr_code", "delete_qr_code", "get_qr_activity", "update_folder", "delete_folder", "update_form", "get_form", "get_form_responses", "get_page", "update_page", "delete_page", "get_short_link", "update_short_link", "delete_short_link", "get_short_link_activity"]) {
      assert.deepEqual(byName.get(n)?.required, ["id"], n);
    }
  });
  it("the 11 no-required tools carry NO required key, exactly as captured", () => {
    assert.equal(NO_REQUIRED.length, 11);
    for (const tool of TOOL_DEFS) {
      const schema = tool.inputSchema as Record<string, unknown>;
      if (NO_REQUIRED.includes(tool.name)) assert.equal("required" in schema, false, tool.name);
      else assert.equal("required" in schema, true, tool.name);
    }
  });
  it("carries every fixture property, in order, for all tools", (t) => {
    if (skipWithoutFixture(t)) return;
    for (let i = 0; i < 36; i += 1) {
      const served = Object.keys((TOOL_DEFS[i].inputSchema as { properties: object }).properties);
      const expected = Object.keys((fixture.tools[i].inputSchema as { properties: object }).properties);
      assert.deepEqual(served, expected);
    }
  });
  it("isKnownTool recognises the 36 built tools and rejects others", () => {
    for (const n of EXPECTED_NAMES) assert.equal(isKnownTool(n), true, n);
    assert.equal(isKnownTool("create"), false);
    assert.equal(isKnownTool(""), false);
  });
});

/* ------------------------------------------------------------------ */

describe("session establishment and reuse", () => {
  it("runs initialize, notifications/initialized, then tools/call in order", async () => {
    const { client: c, calls } = stubClient();
    const out = await c.callTool(QR_TOOL, { qr_data: "https://example.com" });
    assert.equal(out.isError, undefined);
    assert.deepEqual(methods(calls), ["initialize", "notifications/initialized", "tools/call"]);
    assert.ok(calls.every((call) => call.url === DEFAULT_ENDPOINT_URL));
    assert.equal(DEFAULT_ENDPOINT_URL, "https://hovercode.com/mcp/");
    for (const call of calls) {
      assert.equal(call.headers["Content-Type"], "application/json");
      assert.equal(call.headers["Accept"], "application/json, text/event-stream");
    }
    assert.equal(calls[0].headers["Mcp-Session-Id"], undefined);
    assert.equal(calls[1].headers["Mcp-Session-Id"], "sess-xyz");
    assert.equal(calls[2].headers["Mcp-Session-Id"], "sess-xyz");
  });
  it("sends clientInfo name qrcanvas and the pinned protocol version on initialize", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LIST_TOOL, {});
    const initParams = calls[0].body.params as Record<string, unknown>;
    assert.equal(initParams.protocolVersion, PROTOCOL_VERSION);
    assert.equal(PROTOCOL_VERSION, "2025-03-26");
    assert.deepEqual(initParams.capabilities, {});
    assert.deepEqual(initParams.clientInfo, { name: "qrcanvas", version: VERSION });
  });
  it("establishes the session lazily once and reuses it on later calls", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LIST_TOOL, {});
    await c.callTool("list_tags", {});
    assert.deepEqual(methods(calls), ["initialize", "notifications/initialized", "tools/call", "tools/call"]);
    assert.equal(calls[3].headers["Mcp-Session-Id"], "sess-xyz");
    assert.notEqual(calls[2].body.id, calls[3].body.id);
  });
  it("sends no session header when the upstream issues none", async () => {
    const { client: c, calls } = stubClient({ sessionId: null });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, undefined);
    assert.ok(calls.every((call) => call.headers["Mcp-Session-Id"] === undefined));
  });
  it("honours the HOVERCODE_MCP_URL env override", async () => {
    const upstream = makeUpstream();
    const c = new QrcanvasClient({ fetchFn: upstream.fetchFn, env: { HOVERCODE_MCP_URL: "https://staging.example.com/mcp/" } });
    await c.callTool(LIST_TOOL, {});
    assert.ok(upstream.calls.every((call) => call.url === "https://staging.example.com/mcp/"));
  });
  it("honours an explicit url override over the default endpoint", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {}, url: "https://alt.example.com/mcp" });
    await c.callTool(LIST_TOOL, {});
    assert.ok(upstream.calls.every((call) => call.url === "https://alt.example.com/mcp"));
  });
  it("prefers an explicit url override over the env override", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: { HOVERCODE_MCP_URL: "https://env.example.com/mcp" }, url: "https://explicit.example.com/mcp" });
    await c.callTool(LIST_TOOL, {});
    assert.ok(upstream.calls.every((call) => call.url === "https://explicit.example.com/mcp"));
  });
  it("falls back to the pinned endpoint when the env override is blank", async () => {
    const upstream = makeUpstream();
    const c = new QrcanvasClient({ fetchFn: upstream.fetchFn, env: { HOVERCODE_MCP_URL: "   " } });
    await c.callTool(LIST_TOOL, {});
    assert.ok(upstream.calls.every((call) => call.url === DEFAULT_ENDPOINT_URL));
  });
});

/* ------------------------------------------------------------------ */

describe("upstream token header (labelled reconstruction)", () => {
  it("sends Authorization: Bearer on every request when HOVERCODE_API_TOKEN is set", async () => {
    const upstream = makeUpstream();
    const c = new QrcanvasClient({ fetchFn: upstream.fetchFn, env: { HOVERCODE_API_TOKEN: "hc-token-42" } });
    await c.callTool(LIST_TOOL, {});
    assert.equal(upstream.calls.length, 3);
    assert.ok(upstream.calls.every((call) => call.headers["Authorization"] === "Bearer hc-token-42"));
  });
  it("sends no Authorization header when HOVERCODE_API_TOKEN is unset", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LIST_TOOL, {});
    assert.ok(calls.every((call) => call.headers["Authorization"] === undefined));
  });
  it("never sends an X-API-Key header, with or without a token", async () => {
    const withKey = makeUpstream();
    const c1 = new QrcanvasClient({ fetchFn: withKey.fetchFn, env: { HOVERCODE_API_TOKEN: "hc-token-42" } });
    await c1.callTool(LIST_TOOL, {});
    assert.ok(withKey.calls.every((call) => call.headers["X-API-Key"] === undefined));
    const { client: c2, calls } = stubClient();
    await c2.callTool(LIST_TOOL, {});
    assert.ok(calls.every((call) => call.headers["X-API-Key"] === undefined));
  });
});

/* ------------------------------------------------------------------ */

describe("tools/call forwarding", () => {
  it("forwards a create_qr_code call verbatim", async () => {
    const { client: c, calls } = stubClient();
    const args = { qr_data: "https://example.com", dynamic: true };
    await c.callTool(QR_TOOL, args);
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, QR_TOOL);
    assert.deepEqual(params.arguments, args);
  });
  it("forwards a create_short_link call verbatim", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LINK_TOOL, { link: "https://example.com/long" });
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, LINK_TOOL);
    assert.deepEqual(params.arguments, { link: "https://example.com/long" });
  });
  it("forwards a list_workspaces call with empty arguments verbatim", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LIST_TOOL, {});
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, LIST_TOOL);
    assert.deepEqual(params.arguments, {});
  });
  it("passes the upstream result through verbatim, including extra fields", async () => {
    const { client: c } = stubClient();
    const out = await c.callTool(QR_TOOL, { qr_data: "https://example.com" });
    assert.deepEqual(out, SAMPLE_RESULT);
  });
  it("passes an upstream isError result through untouched", async () => {
    const upstreamResult = { content: [{ type: "text", text: "limit reached" }], isError: true };
    const { client: c } = stubClient({ callResult: upstreamResult });
    const out = await c.callTool(QR_TOOL, { qr_data: "https://example.com" });
    assert.deepEqual(out, upstreamResult);
  });
  it("reads an SSE-framed tools/call response", async () => {
    const { client: c } = stubClient({ sse: true });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, undefined);
    assert.deepEqual(out, SAMPLE_RESULT);
  });
  it("the one-shot callTool helper forwards under the right tool name", async () => {
    const upstream = makeUpstream();
    const out = await callTool("get_qr_code", { id: "qr_9" }, { fetchFn: upstream.fetchFn, env: {} });
    assert.equal(out.isError, undefined);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, "get_qr_code");
    assert.deepEqual(params.arguments, { id: "qr_9" });
  });
});

/* ------------------------------------------------------------------ */

describe("upstream failures surface as qrcanvas error text", () => {
  it("maps a JSON-RPC error to `qrcanvas error: <message>`", async () => {
    const { client: c } = stubClient({ callError: { code: -32000, message: "create failed upstream" } });
    const out = await c.callTool(QR_TOOL, { qr_data: "https://example.com" });
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "qrcanvas error: create failed upstream");
  });
  it("maps an initialize JSON-RPC error to qrcanvas error text", async () => {
    const { client: c } = stubClient({ initError: { code: -32600, message: "bad initialize" } });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "qrcanvas error: bad initialize");
  });
  it("maps an unparseable upstream response to a malformed-response error", async () => {
    const { client: c } = stubClient({ callBodyText: "<html>oops</html>" });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "qrcanvas error: malformed response");
  });
  it("maps a response with no result object to a malformed-response error", async () => {
    const { client: c } = stubClient({ callBodyText: '{"jsonrpc":"2.0","id":3,"result":null}' });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "qrcanvas error: malformed response");
  });
  it("maps a non-2xx upstream status to qrcanvas error text", async () => {
    const { client: c } = stubClient({ callBodyText: "internal error", callStatus: 500 });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "qrcanvas error: HTTP 500");
  });
  it("maps a throwing fetch to qrcanvas error text", async () => {
    const { client: c } = stubClient({ throwOn: "tools/call" });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.match(textOf(out), /^qrcanvas error: /);
  });
  it("maps a throwing initialize fetch to qrcanvas error text", async () => {
    const { client: c } = stubClient({ throwOn: "initialize" });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "qrcanvas error: socket hang up");
  });
  it("maps a timed-out call to qrcanvas error text", async () => {
    const { client: c } = stubClient({ hangOnCall: true }, { timeoutMs: 20 });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.match(textOf(out), /^qrcanvas error: /);
  });
});

/* ------------------------------------------------------------------ */

describe("parseRpcBody", () => {
  it("parses plain JSON and picks the message with the matching id", () => {
    assert.deepEqual(parseRpcBody('{"jsonrpc":"2.0","id":7,"result":{"ok":true}}', 7), { jsonrpc: "2.0", id: 7, result: { ok: true } });
  });
  it("parses SSE data lines", () => {
    assert.deepEqual(parseRpcBody('event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n', 2), { jsonrpc: "2.0", id: 2, result: { ok: true } });
  });
  it("picks the matching id among several SSE messages", () => {
    const body = 'data: {"jsonrpc":"2.0","id":1,"result":{"n":1}}\n\n' + 'data: {"jsonrpc":"2.0","id":2,"result":{"n":2}}\n\n';
    assert.deepEqual(parseRpcBody(body, 2), { jsonrpc: "2.0", id: 2, result: { n: 2 } });
  });
  it("ignores the SSE [DONE] sentinel", () => {
    assert.deepEqual(parseRpcBody('data: {"jsonrpc":"2.0","id":4,"result":{"ok":true}}\ndata: [DONE]\n', 4), { jsonrpc: "2.0", id: 4, result: { ok: true } });
  });
  it("returns null for empty and unparseable bodies", () => {
    assert.equal(parseRpcBody(""), null);
    assert.equal(parseRpcBody("not json at all"), null);
    assert.equal(parseRpcBody("[1,2,3]"), null);
  });
});

/* ------------------------------------------------------------------ */

describe("MCP layer validation", () => {
  it("rejects an unknown tool with MethodNotFound before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(() => handleCallTool(c, "not_a_tool", {}), (err: unknown) => err instanceof McpError && err.code === ErrorCode.MethodNotFound);
    assert.equal(upstream.calls.length, 0);
  });
  it("rejects array arguments with InvalidParams before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(() => handleCallTool(c, QR_TOOL, ["nope"]), (err: unknown) => err instanceof McpError && err.code === ErrorCode.InvalidParams);
    assert.equal(upstream.calls.length, 0);
  });
  it("rejects string arguments with InvalidParams before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(() => handleCallTool(c, "get_qr_code", "id=qr_9"), (err: unknown) => err instanceof McpError && err.code === ErrorCode.InvalidParams);
    assert.equal(upstream.calls.length, 0);
  });
  it("forwards a valid call through the MCP layer unchanged", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, QR_TOOL, { qr_data: "https://example.com" });
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.deepEqual(params.arguments, { qr_data: "https://example.com" });
  });
  it("treats omitted arguments as an empty object", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, LIST_TOOL, undefined);
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.deepEqual(params.arguments, {});
  });
});

/* ------------------------------------------------------------------ */

describe("CLI", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  function runCli(args: string[]) {
    return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], { cwd: root, encoding: "utf8", timeout: 30000 });
  }
  it("--version prints 0.1.0 and exits 0", () => {
    const res = runCli(["--version"]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout.trim(), "0.1.0");
    assert.equal(res.stdout.trim(), VERSION);
  });
  it("-v prints 0.1.0 and exits 0", () => {
    const res = runCli(["-v"]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout.trim(), "0.1.0");
  });
  it("an unknown command prints usage on stderr and exits 2", () => {
    const res = runCli(["not-a-tool"]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Usage:/);
  });
  it("a non-JSON argument exits 2", () => {
    const res = runCli([QR_TOOL, "not json"]);
    assert.equal(res.status, 2);
  });
  it("a JSON array argument exits 2", () => {
    const res = runCli([QR_TOOL, "[]"]);
    assert.equal(res.status, 2);
  });
  it("extra arguments after mcp exit 2", () => {
    const res = runCli(["mcp", "extra"]);
    assert.equal(res.status, 2);
  });
});

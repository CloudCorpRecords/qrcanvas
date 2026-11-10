# BUILD REPORT — qrcanvas

Rebuild of `com.hovercode/mcp` v1.0.1 (remote at
`https://hovercode.com/mcp/`) as `@reneturcios/qrcanvas` 0.1.0 /
`io.github.CloudCorpRecords/qrcanvas`. All 36 captured tools built.

## Fixture conflicts

**None.** The spec, the spec's required-field list, and the fixture
(`harness/fixtures/hovercode-tools-original.json`) agree on all 36 tool
names, their order, their descriptions and inputSchemas, and their
required fields. The capture carries NO `title` key on any tool; none
was invented — every served tool carries exactly the keys
`name`, `description`, `inputSchema` (asserted by test).

Required fields as served, taken from the fixture:

- `create_qr_code` — required: `qr_data`
- `build_page` — required: `title`, `blocks`
- `create_form` — required: `title`, `fields`
- `create_short_link` — required: `link`
- `set_workspace` — required: `workspace`
- `create_qr_codes_bulk` — required: `items`
- `download_qr`, `get_qr_code`, `update_qr_code`, `delete_qr_code`,
  `get_qr_activity`, `update_folder`, `delete_folder`, `update_form`,
  `get_form`, `get_form_responses`, `get_page`, `update_page`,
  `delete_page`, `get_short_link`, `update_short_link`,
  `delete_short_link`, `get_short_link_activity` — required: `id`
- `create_folder` — required: `name`
- `create_page` — required: `title`
- NO `required` key at all (served verbatim, none invented) —
  `list_workspaces`, `get_analytics`, `list_qr_codes`,
  `create_pdf_qr`, `list_templates`, `list_folders`, `list_tags`,
  `list_forms`, `list_pages`, `list_block_types`, `list_short_links`
  (11 tools; asserted per-tool by a dedicated test)

The fixture literals were generated programmatically from the fixture
JSON (parsed and re-serialised, never retyped) into `src/forward.ts`,
and verified by the registration-integrity test (served tools/list
deep-equals the fixture's 36 tool objects, in order) and again by the
parity harness.

## What was built

All 19 factory files under `builds/qrcanvas/`:

- `package.json` (`@reneturcios/qrcanvas` 0.1.0, bin
  `qrcanvas` → `dist/cli.js`, deps exactly `@modelcontextprotocol/sdk ^1`
  + `zod ^3`; devDeps `@types/node ^20`, `tsx ^4`, `typescript ^5`)
- `server.json` (description exactly the prescribed 93-char string
  "Create and manage QR codes, short links, landing pages and forms in your Hovercode workspace.";
  npm entry carries `"version": "0.1.0"`; OCI entry
  `ghcr.io/cloudcorprecords/qrcanvas:0.1.0` carries **no** version field)
- `Dockerfile` (node:20-alpine both stages; server-name label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/qrcanvas"`
  matches `server.json`)
- `tsconfig.json` (fleet-identical, 318 bytes), `.gitignore`,
  `package-lock.json`, `README.md` (fresh prose), `LICENSE` (MIT,
  Copyright (c) 2026 Rene Turcios), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-28)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core; exports `VERSION = "0.1.0"`)
- `test/forward.test.ts`
- `.github/workflows/{ci.yml, publish.yml, publish-container.yml,
  registry-publish.yml}` (container workflow: IMAGE
  `ghcr.io/cloudcorprecords/qrcanvas`, smoke assertion on server name
  `qrcanvas`)

Plus `BUILD-REPORT.md` (this file) and the `parity-out/` harness output.

## Design

- Forwarding client to `https://hovercode.com/mcp/` (pinned, trailing
  slash as recorded), overridable via `HOVERCODE_MCP_URL` (labelled
  reconstruction). tools/call is forwarded as a streamable-HTTP
  JSON-RPC client: initialize (protocolVersion `2025-03-26`,
  clientInfo `qrcanvas`) → notifications/initialized → tools/call,
  honouring `Mcp-Session-Id` when issued; session established lazily
  and reused per client. Plain-JSON and SSE replies both parsed; the
  matching-id message wins; upstream results pass through verbatim
  (including `isError` and extra fields such as `structuredContent`).
- Labelled reconstructions (from the spec):
  - `HOVERCODE_MCP_URL` env override of the pinned endpoint.
  - Token forwarding: when `HOVERCODE_API_TOKEN` is set (env NAME
    pinned by the registry record's package entry — "Hovercode API
    token … to skip the OAuth browser flow"), every upstream request
    carries `Authorization: Bearer <value>` (the header FORM is a
    labelled reconstruction — the record's remote pins no header and
    the capture was keyless). When unset, no key header is sent. No
    `X-API-Key` header is sent in either case. Both branches covered
    by tests.
  - Failure rendering: upstream failures (JSON-RPC error, non-2xx
    status, malformed body, throwing/timing-out fetch) surface as
    `qrcanvas error:` text results.
- Registration via the MCP SDK **low-level** `Server` API
  (`ListToolsRequestSchema` / `CallToolRequestSchema` handlers)
  serving the fixture literals exactly; no `McpServer` + zod
  registration. `src/mcp.ts` also exports `createServer` /
  `startMcpServer` / `handleCallTool` so the MCP layer is testable
  without a transport; the CLI's `mcp` subcommand starts it over stdio.
- Core takes an injectable fetch (`ForwardDeps.fetchFn`), so all tests
  run against a stubbed JSON-RPC upstream. No live network calls in
  tests; no live call claimed beyond the coordinator's tools/list
  capture. The built surface is CRUD over the caller's own Hovercode
  workspace (QR codes single/bulk/PDF, short links, block-built pages,
  forms and responses, folders, tags, templates, analytics); no
  payment, billing, plan or sending tool exists in the surface — none
  was added.

## Lockfile (Route 3, clean from birth)

Generated in the build dir with NO `node_modules` present and NO
pre-existing lockfile:
`npm install --package-lock-only --ignore-scripts --offline`.
Verified: parses, `name == @reneturcios/qrcanvas`,
**128 package entries**. Then `npm install --offline
--ignore-scripts` in the build dir for `node_modules`.

## Verification (all in the build dir unless noted)

- `npx tsc --noEmit` → exit 0
- `npm run build` → real `dist/` (cli.js, forward.js, mcp.js, all
  non-empty, with `.d.ts` + source maps)
- `node dist/cli.js --version` → `0.1.0`; unknown subcommand → usage on
  stderr, exit 2
- `npm test` → **49 tests, 49 pass, 0 fail** (8 suites: registration
  integrity — served tools deep-equal the fixture's full 36 tool
  objects, names in fixture order, exactly the fixture's keys with no
  title invented, required fields per tool incl. the 11-tool
  no-`required` assertion, every property key in order, isKnownTool;
  session establishment/reuse/session-id handling, clientInfo/protocol
  version; env URL override, explicit url override, explicit-over-env
  precedence, blank-env fallback; Authorization Bearer header present
  on every request when the token is set / absent when unset / no
  X-API-Key header in either case; verbatim argument forwarding incl.
  an empty-arguments list call; verbatim result pass-through incl.
  upstream isError and SSE; JSON-RPC/init/malformed/no-result/HTTP/
  throw/timeout failures → `qrcanvas error:`; parseRpcBody JSON + SSE
  + matching-id + [DONE] cases; MCP-layer MethodNotFound /
  InvalidParams validation; CLI --version / -v / unknown exit 2 /
  bad-JSON exit 2 / `mcp extra` exit 2)
- Parity: `python3 harness/parity.py --original
  harness/fixtures/hovercode-tools-original.json --rebuild
  "stdio:node builds/qrcanvas/dist/cli.js mcp" --out
  builds/qrcanvas/parity-out` (run from `~/workspace/mcp-rebuild-100`)
  → **PASS, parity 100.0, 36/36 identical, no missing/extra/schema
  diffs** (see `parity-out/parity.json`)
- Consistency sweep: package.json version = server.json top-level =
  npm-entry version = OCI tag = core `VERSION` = CHANGELOG heading
  (0.1.0); package.json `mcpName` = server.json `name` = Dockerfile
  label; server.json description measured at 93 chars; OCI entry
  confirmed to have no `version` field.

Clean-room: all prose and code written fresh for qrcanvas; only the
mechanics were patterned on the sibling carddata build, and only the
fixture's tool literals are served verbatim.

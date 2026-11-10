# qrcanvas

qrcanvas is a small local bridge to the hosted
Hovercode MCP server, which manages QR codes, short
links, landing pages and forms inside a Hovercode
workspace. From your agent you can mint a QR code —
static, or dynamic so its destination stays editable
and its scans are tracked — style it with colours,
patterns, eye shapes, frames and a logo, generate
codes in bulk, wrap a PDF in a code, and download the
rendered image. The same workspace holds short links,
landing pages assembled from typed blocks, and forms
whose responses you can read back, all organised with
folders and tags and measured with scan and link
analytics.

The bridge keeps no workspace data of its own. It
answers the tool list locally, exactly as captured
from the live endpoint, and forwards each tool call
upstream, returning whatever comes back untouched.
All 36 captured tools are part of this rebuild. The
surface is CRUD over your own workspace; no payment,
billing or sending tool exists in it.

## Tools

Workspaces and QR codes:

- `list_workspaces` — list the workspaces this account
  can access; the current one is marked. No required
  arguments.
- `set_workspace` — switch the current workspace.
  Required: `workspace`.
- `create_qr_code` — create a QR code and get its
  details plus a rendered PNG. Required: `qr_data`.
- `create_qr_codes_bulk` — create many codes at once.
  Required: `items`.
- `create_pdf_qr` — create a QR code for a PDF. No
  required arguments.
- `list_qr_codes` — list and search codes. No
  required arguments.
- `get_qr_code` / `update_qr_code` / `delete_qr_code`
  — read, change or remove one code. Required: `id`.
- `download_qr` — download a code's rendered image.
  Required: `id`.
- `get_qr_activity` — scan activity for one code.
  Required: `id`.
- `get_analytics` — workspace analytics. No required
  arguments.

Pages and forms:

- `build_page` — build and publish a landing page
  from ordered blocks. Required: `title`, `blocks`.
- `create_page` — create a page. Required: `title`.
- `get_page` / `update_page` / `delete_page` — read,
  change or remove one page. Required: `id`.
- `list_pages` — list pages. No required arguments.
- `list_block_types` — list the block types pages are
  built from. No required arguments.
- `create_form` — create a form. Required: `title`,
  `fields`.
- `update_form` — change a form. Required: `id`.
- `list_forms` — list forms. No required arguments.
- `get_form` — read one form. Required: `id`.
- `get_form_responses` — read a form's responses.
  Required: `id`.

Short links and organisation:

- `create_short_link` — create a short link.
  Required: `link`.
- `get_short_link` / `update_short_link` /
  `delete_short_link` — read, change or remove one
  link. Required: `id`.
- `list_short_links` — list and search links. No
  required arguments.
- `get_short_link_activity` — click activity for one
  link. Required: `id`.
- `list_templates` — list design templates. No
  required arguments.
- `list_folders` — list folders. No required
  arguments.
- `create_folder` — create a folder. Required:
  `name`.
- `update_folder` / `delete_folder` — rename, move or
  remove a folder. Required: `id`.
- `list_tags` — list tags. No required arguments.

## Configuration

- `HOVERCODE_MCP_URL` (optional) — override the
  upstream endpoint. Defaults to
  `https://hovercode.com/mcp/`. (The override hook is
  this rebuild's own labelled reconstruction.)
- `HOVERCODE_API_TOKEN` (optional) — when set, every
  upstream request carries an
  `Authorization: Bearer <token>` header carrying your
  Hovercode API token, which skips the OAuth browser
  flow. When it is not set, no key header is sent.
  (The env name is pinned by the original's registry
  record; the record's remote pins no header, so the
  Bearer header form is a labelled reconstruction —
  the original surface was captured keyless.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session upstream: a JSON-RPC `initialize`
request (protocolVersion `2025-03-26`, clientInfo
name `qrcanvas`), then a `notifications/initialized`
notification, then the `tools/call` request carrying
the caller's arguments unchanged. When the upstream
answers `initialize` with an `Mcp-Session-Id` header,
that value rides on every later request of the
session, which is reused for the life of the process.
Replies may arrive as plain JSON or as server-sent
events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `qrcanvas error:` (this rendering
is this rebuild's own labelled reconstruction).

## CLI

Each tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/qrcanvas list_workspaces '{}'
npx @reneturcios/qrcanvas create_qr_code '{"qr_data":"https://example.com","dynamic":true}'
npx @reneturcios/qrcanvas create_short_link '{"link":"https://example.com/a/very/long/path"}'
npx @reneturcios/qrcanvas get_qr_code '{"id":"qr_123"}'
npx @reneturcios/qrcanvas --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/qrcanvas mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "qrcanvas": {
      "command": "npx",
      "args": ["-y", "@reneturcios/qrcanvas", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/qrcanvas
docker run --rm ghcr.io/cloudcorprecords/qrcanvas --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.

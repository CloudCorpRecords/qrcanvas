# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted Hovercode MCP server, serving all 36 captured tools locally for tools/list and forwarding every tools/call upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when issued).
- Tools: workspaces (`list_workspaces`, `set_workspace`), QR codes (`create_qr_code`, `create_qr_codes_bulk`, `create_pdf_qr`, `list_qr_codes`, `get_qr_code`, `update_qr_code`, `delete_qr_code`, `download_qr`, `get_qr_activity`, `get_analytics`), pages (`build_page`, `create_page`, `get_page`, `update_page`, `delete_page`, `list_pages`, `list_block_types`), forms (`create_form`, `update_form`, `list_forms`, `get_form`, `get_form_responses`), short links (`create_short_link`, `get_short_link`, `list_short_links`, `update_short_link`, `delete_short_link`, `get_short_link_activity`), and organisation (`list_templates`, `list_folders`, `create_folder`, `update_folder`, `delete_folder`, `list_tags`).
- Upstream results pass through verbatim; upstream failures surface as `qrcanvas error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). Upstream endpoint overridable via `HOVERCODE_MCP_URL`; when `HOVERCODE_API_TOKEN` is set it is sent as an `Authorization: Bearer` header.

/**
 * qrcanvas core: a forwarding client for the hosted
 * Hovercode MCP server.
 *
 * Nothing is created or read locally. tools/list is
 * answered from the literal definitions below, taken
 * verbatim from a live capture of the upstream server
 * (name, description and inputSchema exactly as
 * captured; the capture carries no title key, so none
 * is served). A tools/call travels upstream over a
 * streamable-HTTP JSON-RPC session: an initialize POST,
 * a notifications/initialized POST, then the tools/call
 * POST, carrying the Mcp-Session-Id response header on
 * later requests when the upstream issues one. The
 * session opens lazily on the first forwarded call and
 * is reused for the client's life.
 *
 * The endpoint is pinned to https://hovercode.com/mcp/
 * and may be replaced with the HOVERCODE_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). When HOVERCODE_API_TOKEN is set
 * (env name pinned by the registry record's package
 * entry), every upstream request carries an
 * `Authorization: Bearer <token>` header (that header
 * form is a labelled reconstruction: the record's
 * remote pins no header and the capture was keyless).
 * When it is unset, no key header goes out.
 *
 * A successful upstream result is returned exactly as
 * received, isError flag and extra fields included.
 * Failures — an upstream JSON-RPC error, a non-2xx
 * status, a body that cannot be parsed, or a fetch that
 * throws or times out — become an isError result whose
 * text begins with `qrcanvas error:` (that rendering is
 * a labelled reconstruction). Replies may be plain JSON
 * or SSE (`data:` lines); the JSON-RPC message whose id
 * matches the request wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://hovercode.com/mcp/";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/hovercode-tools-original.json;          */
/* generated programmatically by parsing and re-serialising the        */
/* fixture JSON, never retyped)                                        */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "list_workspaces",
    "description": "List the workspaces this account can access, with their ids; the current (default) one is marked. Tools default to the current workspace, so you only need `workspace` to target a different one.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "create_qr_code",
    "description": "Create a Hovercode QR code and return its details plus a rendered PNG. `dynamic: true` makes the destination changeable later and tracks scans; `dynamic: false` (the default, 'static') encodes the destination directly into the code image — it can never be retargeted or tracked, and this choice can't be changed after creation. If the request doesn't make the choice clear, ask the user whether it should be trackable and editable later, or fixed permanently once printed. Dynamic codes count toward the workspace's dynamic-code limit (list_workspaces' `dynamic_qr_used`/`dynamic_qr_limit`); past that limit this call returns an error. Supports full design control (colors, pattern, eye style, frames with captions, logo). Not for Hovercode forms, pages, or short links: those already have their own QR code (returned as `qr_id` / `id`) — use download_qr or update_qr_code with that id instead.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "qr_data": {
          "type": "string",
          "description": "What the code encodes: a URL for qr_type 'Link', or the text for qr_type 'Text'. For 'vCard' send `vcard` instead."
        },
        "qr_type": {
          "type": "string",
          "enum": [
            "Link",
            "Text",
            "vCard"
          ],
          "description": "QR content type. Default 'Link'. 'vCard' encodes a contact card from `vcard`."
        },
        "vcard": {
          "type": "object",
          "description": "Contact details for qr_type 'vCard' (use instead of qr_data). Scanning saves the contact to the phone. `dynamic: true` makes the card editable later.",
          "properties": {
            "first_name": {
              "type": "string"
            },
            "last_name": {
              "type": "string"
            },
            "company_name": {
              "type": "string"
            },
            "position": {
              "type": "string"
            },
            "email": {
              "type": "string"
            },
            "mobile_number": {
              "type": "string"
            },
            "phone_number": {
              "type": "string"
            },
            "website": {
              "type": "string"
            },
            "street": {
              "type": "string"
            },
            "city": {
              "type": "string"
            },
            "state": {
              "type": "string"
            },
            "country": {
              "type": "string"
            },
            "post_code": {
              "type": "string"
            },
            "description": {
              "type": "string"
            }
          },
          "required": [
            "first_name"
          ]
        },
        "dynamic": {
          "type": "boolean",
          "description": "Editable destination + scan tracking; can't be switched after creation. Counts toward the workspace's dynamic-code limit. Default false (static: fixed forever, no tracking). Ask the user if their wording doesn't make the choice clear."
        },
        "display_name": {
          "type": "string",
          "description": "Internal name to find this code later."
        },
        "template": {
          "type": "string",
          "description": "Workspace template id to apply as design defaults (list_templates)."
        },
        "folder": {
          "type": "string",
          "description": "Folder id or slug to file the new code into (list_qr_codes shows each code's folder)."
        },
        "gps_tracking": {
          "type": "boolean",
          "description": "Prompt scanners to share location (dynamic codes)."
        },
        "tags": {
          "type": "array",
          "description": "Labels to attach (created if new) so you can find these later — list_qr_codes and list_short_links search by tag.",
          "items": {
            "type": "string"
          }
        },
        "primary_color": {
          "type": "string",
          "description": "Hex color for the QR pattern, e.g. #111111. Eyes and frame follow this automatically — one color request styles the whole code; only set `eye_color`/`frame_color` for a code that should use a *different* color for those, e.g. 'dark green with gold eyes'. See `color_scope` for language that names just the pattern."
        },
        "color_scope": {
          "type": "string",
          "enum": [
            "whole",
            "pattern_only"
          ],
          "description": "How far a `primary_color` change should reach; only relevant alongside `primary_color`. Default 'whole' matches whole-code language — 'make it red', 'make the QR code dark green' — so pattern, eyes, and frame all follow `primary_color` together. Set 'pattern_only' for language that names one part specifically — 'change the pattern color to red', 'just recolor the dots' — so eyes and frame are left exactly as they are."
        },
        "background_color": {
          "type": "string",
          "description": "Hex background color, or 'transparent'."
        },
        "eye_style": {
          "type": "string",
          "enum": [
            "Square",
            "Rounded",
            "Drop",
            "Leaf"
          ],
          "description": "Corner eye shape."
        },
        "eye_color": {
          "type": "string",
          "description": "Hex color for the corner eyes, if different from `primary_color` (which they follow by default)."
        },
        "pattern": {
          "type": "string",
          "enum": [
            "Original",
            "Squares",
            "Circles",
            "Lines",
            "Triangles",
            "Diamonds"
          ],
          "description": "Module pattern style."
        },
        "frame": {
          "type": "string",
          "description": "Frame slug. A caption (`text`) works on any frame — set `text` without a `frame` and one that can show it is chosen automatically. Frames that show a caption: card, card-above, speech-bubble, speech-bubble-above."
        },
        "frame_color": {
          "type": "string",
          "description": "Hex color for the frame, if different from `primary_color` (which it follows by default)."
        },
        "text": {
          "type": "string",
          "description": "Caption text. Renders on any frame that supports one; if `frame` isn't also given (or the one given can't show text), a frame that can is chosen automatically."
        },
        "text_secondary": {
          "type": "string",
          "description": "Secondary caption line, where the frame supports it."
        },
        "has_border": {
          "type": "boolean",
          "description": "Draw a border around the code."
        },
        "logo_url": {
          "type": "string",
          "description": "URL of a logo image to place in the center."
        },
        "error_correction": {
          "type": "string",
          "description": "QR error correction level: L, M, Q, or H (higher tolerates more damage but is denser). Already handled automatically — the renderer uses H whenever the code has a logo, Q otherwise — so leave this unset by default, including when adding or changing a logo in this same call; only set it to deliberately override that automatic choice."
        }
      },
      "required": [
        "qr_data"
      ]
    }
  },
  {
    "name": "build_page",
    "description": "Build a rich, on-brand landing page from an ordered list of typed blocks, publish it, and return its live URL + its own QR code (`qr_id`; style it with the QR design args here, restyle later with update_qr_code — don't create another). This is the 'make me a page for X' tool — e.g. an event, product, restaurant, link-in-bio, or a scan-to-enter sweepstakes. Each block is {type, content}; call list_block_types first to see every type and its content shape. Blocks render in order in a centered column; a 'header' block (name/bio/photo) is the profile.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "primary_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the QR pattern, e.g. #111111. Eyes and frame follow it automatically (rules as in create_qr_code)."
        },
        "background_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex background color, or 'transparent'."
        },
        "eye_style": {
          "type": "string",
          "enum": [
            "Square",
            "Rounded",
            "Drop",
            "Leaf"
          ],
          "description": "For the QR code this mints: Corner eye shape."
        },
        "eye_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the corner eyes, only if different from `primary_color`."
        },
        "pattern": {
          "type": "string",
          "enum": [
            "Original",
            "Squares",
            "Circles",
            "Lines",
            "Triangles",
            "Diamonds"
          ],
          "description": "For the QR code this mints: Module pattern style."
        },
        "frame": {
          "type": "string",
          "description": "For the QR code this mints: Frame slug, as in create_qr_code. Set `text` without a `frame` and one that can show it is chosen automatically."
        },
        "frame_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the frame, only if different from `primary_color`."
        },
        "text": {
          "type": "string",
          "description": "For the QR code this mints: Caption text; a frame that can show it is chosen automatically."
        },
        "text_secondary": {
          "type": "string",
          "description": "For the QR code this mints: Secondary caption line, where the frame supports it."
        },
        "has_border": {
          "type": "boolean",
          "description": "For the QR code this mints: Draw a border around the code."
        },
        "logo_url": {
          "type": "string",
          "description": "For the QR code this mints: URL of a logo image to place in the center."
        },
        "error_correction": {
          "type": "string",
          "description": "For the QR code this mints: QR error correction level (L, M, Q, H). Leave unset: it is chosen automatically (H with a logo, Q otherwise)."
        },
        "color_scope": {
          "type": "string",
          "enum": [
            "whole",
            "pattern_only"
          ],
          "description": "For the QR code this mints: 'whole' (default) or 'pattern_only', as in create_qr_code."
        },
        "title": {
          "type": "string",
          "description": "The page title (browser tab + SEO)."
        },
        "description": {
          "type": "string",
          "description": "Optional SEO/description text."
        },
        "blocks": {
          "type": "array",
          "description": "Ordered page blocks. Each is {type, content}. See list_block_types.",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "description": "Block type, e.g. header, link, text, video, faq, countdown."
              },
              "content": {
                "type": "object",
                "description": "The block's content, matching that type's schema."
              },
              "form": {
                "type": "string",
                "description": "For a 'form' block: the form id to embed."
              },
              "hidden": {
                "type": "boolean",
                "description": "Hide this block from the live page."
              },
              "visible_from": {
                "type": "string",
                "description": "Optional ISO date-time the block starts showing, e.g. 2030-05-01T09:00:00Z."
              },
              "visible_until": {
                "type": "string",
                "description": "Optional ISO date-time the block stops showing."
              },
              "full_width": {
                "type": "boolean",
                "description": "image/gallery/video/embed only: stretch to the screen edges."
              }
            },
            "required": [
              "type"
            ]
          }
        },
        "publish": {
          "type": "boolean",
          "description": "Publish immediately (default true). false leaves it a draft."
        },
        "bg_color": {
          "type": "string",
          "description": "Hex page background color."
        },
        "text_color": {
          "type": "string",
          "description": "Hex text color."
        },
        "domain": {
          "type": "string",
          "description": "Custom domain (else a default is used)."
        },
        "slug": {
          "type": "string",
          "description": "Custom URL slug (else auto-generated)."
        }
      },
      "required": [
        "title",
        "blocks"
      ]
    }
  },
  {
    "name": "create_form",
    "description": "Create a form, define its fields, brand it, publish it, and return a shareable short link + QR in one step. Use for 'make me a form to collect X, give me a link and QR to share it'. The result's `share_url` is the public link and `qr_id` is the form's own dynamic QR code (image included) — never call create_qr_code or create_short_link for a form's link; pass QR design args (primary_color, eye_style, frame, logo_url, …) here to style that code in the same call. Supports on-brand styling (theme/colors/logo), a `redirect_url` after submit, conditional logic (`show_when` on a field) and branching endings (`outcomes`), and a custom domain/slug. Publishing mints a dynamic short link and QR — always dynamic, no static option, since a form has to resolve somewhere live. Notifications are a separate, paid, verified-member setting. To change a form later, use update_form.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "primary_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the QR pattern, e.g. #111111. Eyes and frame follow it automatically (rules as in create_qr_code)."
        },
        "background_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex background color, or 'transparent'."
        },
        "eye_style": {
          "type": "string",
          "enum": [
            "Square",
            "Rounded",
            "Drop",
            "Leaf"
          ],
          "description": "For the QR code this mints: Corner eye shape."
        },
        "eye_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the corner eyes, only if different from `primary_color`."
        },
        "pattern": {
          "type": "string",
          "enum": [
            "Original",
            "Squares",
            "Circles",
            "Lines",
            "Triangles",
            "Diamonds"
          ],
          "description": "For the QR code this mints: Module pattern style."
        },
        "frame": {
          "type": "string",
          "description": "For the QR code this mints: Frame slug, as in create_qr_code. Set `text` without a `frame` and one that can show it is chosen automatically."
        },
        "frame_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the frame, only if different from `primary_color`."
        },
        "text": {
          "type": "string",
          "description": "For the QR code this mints: Caption text; a frame that can show it is chosen automatically."
        },
        "text_secondary": {
          "type": "string",
          "description": "For the QR code this mints: Secondary caption line, where the frame supports it."
        },
        "has_border": {
          "type": "boolean",
          "description": "For the QR code this mints: Draw a border around the code."
        },
        "logo_url": {
          "type": "string",
          "description": "URL of a logo image (JPEG/PNG/GIF/WebP) to show on the form."
        },
        "error_correction": {
          "type": "string",
          "description": "For the QR code this mints: QR error correction level (L, M, Q, H). Leave unset: it is chosen automatically (H with a logo, Q otherwise)."
        },
        "color_scope": {
          "type": "string",
          "enum": [
            "whole",
            "pattern_only"
          ],
          "description": "For the QR code this mints: 'whole' (default) or 'pattern_only', as in create_qr_code."
        },
        "title": {
          "type": "string",
          "description": "The form's title."
        },
        "description": {
          "type": "string",
          "description": "Optional description shown above the fields."
        },
        "fields": {
          "type": "array",
          "description": "The fields to collect, in order.",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string",
                "description": "The field's question/label."
              },
              "type": {
                "type": "string",
                "enum": [
                  "text",
                  "email",
                  "phone",
                  "number",
                  "textarea",
                  "select",
                  "radio",
                  "checkbox",
                  "date",
                  "time",
                  "url",
                  "rating",
                  "scale",
                  "yes_no",
                  "image_choice",
                  "ranking",
                  "statement",
                  "hidden",
                  "page_break",
                  "image"
                ],
                "description": "Field type. Default 'text'. Use select/radio/checkbox/ranking with `options`; image_choice with options carrying an `image` URL; scale with min_value/max_value and min_label/max_label (or nps: true)."
              },
              "required": {
                "type": "boolean",
                "description": "Whether an answer is required."
              },
              "placeholder": {
                "type": "string",
                "description": "Optional placeholder text."
              },
              "options": {
                "type": "array",
                "description": "Choices for select/radio/checkbox/ranking (strings or {value,label}); for image_choice pass {label, image} objects.",
                "items": {
                  "type": [
                    "string",
                    "object"
                  ]
                }
              },
              "nps": {
                "type": "boolean",
                "description": "Make this a Net Promoter Score question (0–10, standard labels)."
              },
              "min_label": {
                "type": "string",
                "description": "scale only: label under the lowest value"
              },
              "max_label": {
                "type": "string",
                "description": "scale only: label under the top value"
              },
              "show_when": {
                "type": "object",
                "description": "Conditional logic: show this field only while its conditions match EARLIER answers (e.g. a follow-up question, or a statement recommending a product). Omit to always show.",
                "properties": {
                  "match": {
                    "type": "string",
                    "enum": [
                      "all",
                      "any"
                    ],
                    "description": "Default 'all'."
                  },
                  "rules": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "field": {
                          "type": "string",
                          "description": "The question this condition looks at: its label, its id, or its 0-based position."
                        },
                        "op": {
                          "type": "string",
                          "enum": [
                            "eq",
                            "neq",
                            "contains",
                            "not_contains",
                            "gt",
                            "lt",
                            "is_empty",
                            "not_empty"
                          ],
                          "description": "eq / neq (is, is not), contains / not_contains (text or checkbox), gt / lt (numbers, ratings, dates), is_empty / not_empty (no value needed)."
                        },
                        "value": {
                          "type": "string",
                          "description": "Value to compare with (an option's value for choice questions)."
                        }
                      },
                      "required": [
                        "field",
                        "op"
                      ]
                    }
                  },
                  "action": {
                    "type": "string",
                    "enum": [
                      "show",
                      "require"
                    ],
                    "description": "'show' (default): shown only while the rules match. 'require': always shown, required only while they match. On a page_break field the rules skip the whole page."
                  }
                },
                "required": [
                  "rules"
                ]
              }
            },
            "required": [
              "label"
            ]
          }
        },
        "outcomes": {
          "type": "array",
          "description": "Pathways / branching endings. After submit the first outcome whose rules match decides the ending: its own thank-you title/message and/or a redirect_url (e.g. send people to a different product page per answer). If none match, the default thank-you page is shown.",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Short name, recorded on each response (e.g. 'Recommend Zero Sugar')."
              },
              "match": {
                "type": "string",
                "enum": [
                  "all",
                  "any"
                ],
                "description": "Default 'all'."
              },
              "rules": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "field": {
                      "type": "string",
                      "description": "The question this condition looks at: its label, its id, or its 0-based position."
                    },
                    "op": {
                      "type": "string",
                      "enum": [
                        "eq",
                        "neq",
                        "contains",
                        "not_contains",
                        "gt",
                        "lt",
                        "is_empty",
                        "not_empty"
                      ],
                      "description": "eq / neq (is, is not), contains / not_contains (text or checkbox), gt / lt (numbers, ratings, dates), is_empty / not_empty (no value needed)."
                    },
                    "value": {
                      "type": "string",
                      "description": "Value to compare with (an option's value for choice questions)."
                    }
                  },
                  "required": [
                    "field",
                    "op"
                  ]
                }
              },
              "thank_you_title": {
                "type": "string"
              },
              "thank_you_message": {
                "type": "string"
              },
              "redirect_url": {
                "type": "string",
                "description": "Optional page to send the respondent to."
              },
              "end_early": {
                "type": "boolean",
                "description": "Screening: end the form as soon as this matches (checked on every page change), not just at submit."
              }
            },
            "required": [
              "name",
              "rules"
            ]
          }
        },
        "theme": {
          "type": "string",
          "enum": [
            "light",
            "dark",
            "minimal",
            "bold"
          ],
          "description": "Named color preset. Explicit colors below override it."
        },
        "bg_color": {
          "type": "string",
          "description": "Hex background color."
        },
        "text_color": {
          "type": "string",
          "description": "Hex text color."
        },
        "button_color": {
          "type": "string",
          "description": "Hex submit-button color."
        },
        "button_text_color": {
          "type": "string",
          "description": "Hex button-text color."
        },
        "redirect_url": {
          "type": "string",
          "description": "URL to send respondents to after they submit."
        },
        "thank_you_message": {
          "type": "string",
          "description": "Shown after submitting (if no redirect)."
        },
        "domain": {
          "type": "string",
          "description": "Custom domain to publish on (else a default is used)."
        },
        "slug": {
          "type": "string",
          "description": "Custom short-link slug (else auto-generated)."
        }
      },
      "required": [
        "title",
        "fields"
      ]
    }
  },
  {
    "name": "get_analytics",
    "description": "Scan analytics over a period: totals, unique scanners, scans-by-day, and top countries/cities/OS/browsers. Pass a QR code `id` for one code, or omit it for the whole workspace (which also returns the top codes). Use this to answer 'how did my codes do this month and where were people scanning?'.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "id": {
          "type": "string",
          "description": "QR code id for per-code analytics; omit for workspace-wide."
        },
        "days": {
          "type": "integer",
          "description": "Look-back window in days (default 30, max 365)."
        },
        "start": {
          "type": "string",
          "description": "Range start, ISO date or datetime (e.g. 2026-08-03 or 2026-08-03T14:00:00Z). Use start/end together for a fixed window instead of the rolling `days` look-back."
        },
        "end": {
          "type": "string",
          "description": "Range end, ISO date/datetime. Defaults to now when only `start` is given."
        }
      }
    }
  },
  {
    "name": "list_qr_codes",
    "description": "List QR codes in a workspace, newest first. Optional `query` searches destination, name, and tags. `folder` narrows to one folder, `include_tags` adds each code's tags (its folder is always shown), and `include_scans` adds scan counts — use it instead of calling get_analytics once per code.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "query": {
          "type": "string",
          "description": "Search term (destination, display name, or tag)."
        },
        "folder": {
          "type": "string",
          "description": "Folder id or slug to filter by, or 'none' for codes in no folder."
        },
        "subfolders": {
          "type": "boolean",
          "description": "With `folder`, also include codes in its subfolders."
        },
        "include_scans": {
          "type": "boolean",
          "description": "Add total_scans and unique_scans (lifetime) to each code."
        },
        "include_tags": {
          "type": "boolean",
          "description": "Add each code's tags. (Each code's folder is always included.)"
        },
        "page": {
          "type": "integer",
          "description": "1-based page number."
        },
        "page_size": {
          "type": "integer",
          "description": "Results per page (max 200, default 25)."
        }
      }
    }
  },
  {
    "name": "create_short_link",
    "description": "Create a tracked short link for a URL. It comes with its own QR code (same id; use download_qr). Supports a custom slug and a custom domain. The destination can be changed later with update_short_link, and clicks are tracked. Never shorten a link that is already a Hovercode short link, form link, or page link — those are already tracked and already have a QR code.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "link": {
          "type": "string",
          "description": "The destination URL to shorten."
        },
        "display_name": {
          "type": "string",
          "description": "Internal name to find this link later."
        },
        "slug": {
          "type": "string",
          "description": "Custom slug (letters/numbers/hyphens) or auto-generated."
        },
        "domain": {
          "type": "string",
          "description": "Custom short-link domain; else a default is used."
        },
        "gps": {
          "type": "boolean",
          "description": "Prompt visitors to share their location."
        },
        "tags": {
          "type": "array",
          "description": "Labels to attach (created if new) so you can find these later — list_qr_codes and list_short_links search by tag.",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "link"
      ]
    }
  },
  {
    "name": "set_workspace",
    "description": "Switch the current (default) workspace by id or name. New codes, forms, and pages are created in the current workspace unless a tool is given an explicit `workspace`.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id or name to switch to."
        }
      },
      "required": [
        "workspace"
      ]
    }
  },
  {
    "name": "create_qr_codes_bulk",
    "description": "Create many QR codes at once from a list — e.g. 'make codes for these 20 product URLs in our brand colors'. All codes share the design/options you pass (colors, pattern, frame, dynamic, template). Returns the created codes and any per-item errors. Max 100 per call.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "items": {
          "type": "array",
          "description": "URLs to encode. Each item is a URL string, or an object {url, display_name}.",
          "items": {
            "type": [
              "string",
              "object"
            ]
          }
        },
        "dynamic": {
          "type": "boolean",
          "description": "Make all of them editable + tracked; can't be switched after creation. Free up to a per-plan limit, not paid-only — a large batch can exceed it partway through, which shows up as per-item errors, not a whole-batch failure."
        },
        "template": {
          "type": "string",
          "description": "Workspace template id to apply to all."
        },
        "idempotency_key": {
          "type": "string",
          "description": "Optional client key to make retries safe: if a previous call used the same key (same workspace), the earlier result is replayed instead of creating duplicate codes. Use a fresh key per distinct batch."
        },
        "tags": {
          "type": "array",
          "description": "Labels to attach (created if new) so you can find these later — list_qr_codes and list_short_links search by tag.",
          "items": {
            "type": "string"
          }
        },
        "primary_color": {
          "type": "string",
          "description": "Hex color for the QR pattern, e.g. #111111. Eyes and frame follow it automatically (rules as in create_qr_code)."
        },
        "color_scope": {
          "type": "string",
          "enum": [
            "whole",
            "pattern_only"
          ],
          "description": "'whole' (default) or 'pattern_only', as in create_qr_code."
        },
        "background_color": {
          "type": "string",
          "description": "Hex background color, or 'transparent'."
        },
        "eye_style": {
          "type": "string",
          "enum": [
            "Square",
            "Rounded",
            "Drop",
            "Leaf"
          ],
          "description": "Corner eye shape."
        },
        "eye_color": {
          "type": "string",
          "description": "Hex color for the corner eyes, only if different from `primary_color`."
        },
        "pattern": {
          "type": "string",
          "enum": [
            "Original",
            "Squares",
            "Circles",
            "Lines",
            "Triangles",
            "Diamonds"
          ],
          "description": "Module pattern style."
        },
        "frame": {
          "type": "string",
          "description": "Frame slug, as in create_qr_code. Set `text` without a `frame` and one that can show it is chosen automatically."
        },
        "frame_color": {
          "type": "string",
          "description": "Hex color for the frame, only if different from `primary_color`."
        },
        "text": {
          "type": "string",
          "description": "Caption text; a frame that can show it is chosen automatically."
        },
        "text_secondary": {
          "type": "string",
          "description": "Secondary caption line, where the frame supports it."
        },
        "has_border": {
          "type": "boolean",
          "description": "Draw a border around the code."
        },
        "logo_url": {
          "type": "string",
          "description": "URL of a logo image to place in the center."
        },
        "error_correction": {
          "type": "string",
          "description": "QR error correction level (L, M, Q, H). Leave unset: it is chosen automatically (H with a logo, Q otherwise)."
        }
      },
      "required": [
        "items"
      ]
    }
  },
  {
    "name": "download_qr",
    "description": "Get downloadable, print-ready image links for a QR code — a high-resolution PNG and a vector SVG (best for print/large sizes). Returns URLs you can share or save.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "QR code id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "create_pdf_qr",
    "description": "Create a dynamic QR code and short link for a PDF (menus, flyers, tickets). Host the PDF by passing `pdf_url` (a link Hovercode fetches) or `pdf_base64` (the file's base64 bytes). Returns a shareable short link plus a rendered QR. Because it's dynamic you can later swap the PDF without reprinting the code — always dynamic, no static option here. Counts toward the same workspace dynamic-code limit as create_qr_code (list_workspaces' `dynamic_qr_limit`); past that limit this call returns an error.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "pdf_url": {
          "type": "string",
          "description": "URL of a PDF to fetch and host. Use this or pdf_base64."
        },
        "pdf_base64": {
          "type": "string",
          "description": "Base64-encoded PDF bytes (data-URI prefix allowed), max 20 MB. Or use pdf_url."
        },
        "filename": {
          "type": "string",
          "description": "Name for the stored file, e.g. 'menu.pdf'."
        },
        "display_name": {
          "type": "string",
          "description": "Internal name to find this code later."
        },
        "domain": {
          "type": "string",
          "description": "Custom short-link domain (list_workspaces shows the plan)."
        },
        "tags": {
          "type": "array",
          "description": "Labels to attach (created if new) so you can find these later — list_qr_codes and list_short_links search by tag.",
          "items": {
            "type": "string"
          }
        }
      }
    }
  },
  {
    "name": "get_qr_code",
    "description": "Get one QR code's details and scan analytics (total and unique scans), plus a rendered PNG.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "QR code id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "update_qr_code",
    "description": "Update a QR code in place — the same code keeps working, so it's safe for already-printed codes. Changing `qr_data` retargets a DYNAMIC code's destination. Design fields (colors, pattern, eye style, frame, logo) restyle the code WITHOUT replacing it. Also supports renaming, toggling location tracking, moving it into a folder (`folder`, or 'none' to unfile), and adding/removing tags. Returns the re-rendered QR so you can preview the result. Any combination works in one call. Only include a design field when you actually intend to change it: every one you pass is applied exactly as given, even a color identical to what you set at creation — there's no way to tell 'leave this as-is' from 'set this back to what it already was'. In particular, someone may have since edited the design directly (a widget's own Edit panel can change eye/frame color, pattern, or frame without that edit ever appearing in this conversation) — resending a color or style you remember from an earlier turn will silently overwrite it. If you're not sure the design still matches what you last set, call get_qr_code first rather than restoring from memory.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "QR code id."
        },
        "qr_data": {
          "type": "string",
          "description": "New destination URL/text (dynamic codes only)."
        },
        "display_name": {
          "type": "string",
          "description": "New internal name."
        },
        "gps_tracking": {
          "type": "boolean",
          "description": "Enable/disable location prompt."
        },
        "folder": {
          "type": "string",
          "description": "Move the code into this folder (id or slug from list_folders); 'none' unfiles it."
        },
        "add_tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Tag titles to add (created in the workspace if new)."
        },
        "remove_tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Tags to remove from this code, by title, slug, or id."
        },
        "primary_color": {
          "type": "string",
          "description": "Hex color for the QR pattern, e.g. #111111. Eyes and frame follow this automatically — one color request styles the whole code; only set `eye_color`/`frame_color` for a code that should use a *different* color for those, e.g. 'dark green with gold eyes'. See `color_scope` for language that names just the pattern."
        },
        "color_scope": {
          "type": "string",
          "enum": [
            "whole",
            "pattern_only"
          ],
          "description": "How far a `primary_color` change should reach; only relevant alongside `primary_color`. Default 'whole' matches whole-code language — 'make it red', 'make the QR code dark green' — so pattern, eyes, and frame all follow `primary_color` together. Set 'pattern_only' for language that names one part specifically — 'change the pattern color to red', 'just recolor the dots' — so eyes and frame are left exactly as they are."
        },
        "background_color": {
          "type": "string",
          "description": "Hex background color, or 'transparent'."
        },
        "eye_style": {
          "type": "string",
          "enum": [
            "Square",
            "Rounded",
            "Drop",
            "Leaf"
          ],
          "description": "Corner eye shape."
        },
        "eye_color": {
          "type": "string",
          "description": "Hex color for the corner eyes, if different from `primary_color` (which they follow by default)."
        },
        "pattern": {
          "type": "string",
          "enum": [
            "Original",
            "Squares",
            "Circles",
            "Lines",
            "Triangles",
            "Diamonds"
          ],
          "description": "Module pattern style."
        },
        "frame": {
          "type": "string",
          "description": "Frame slug. A caption (`text`) works on any frame — set `text` without a `frame` and one that can show it is chosen automatically. Frames that show a caption: card, card-above, speech-bubble, speech-bubble-above."
        },
        "frame_color": {
          "type": "string",
          "description": "Hex color for the frame, if different from `primary_color` (which it follows by default)."
        },
        "text": {
          "type": "string",
          "description": "Caption text. Renders on any frame that supports one; if `frame` isn't also given (or the one given can't show text), a frame that can is chosen automatically."
        },
        "text_secondary": {
          "type": "string",
          "description": "Secondary caption line, where the frame supports it."
        },
        "has_border": {
          "type": "boolean",
          "description": "Draw a border around the code."
        },
        "logo_url": {
          "type": "string",
          "description": "URL of a logo image to place in the center."
        },
        "error_correction": {
          "type": "string",
          "description": "QR error correction level: L, M, Q, or H (higher tolerates more damage but is denser). Already handled automatically — the renderer uses H whenever the code has a logo, Q otherwise — so leave this unset by default, including when adding or changing a logo in this same call; only set it to deliberately override that automatic choice."
        },
        "logo_base64": {
          "type": "string",
          "description": "A logo image as base64 (JPEG/PNG/GIF/WebP, under 2 MB; a data: URI prefix is fine) to place in the center — use `logo_url` instead whenever the image is reachable at a URL. Producing this string means generating it yourself as text, and a single dropped or altered character anywhere in a long base64 string corrupts everything after it — the code then renders with a blank space where the logo should be, discovered only after the fact. If a call with this fails validation (e.g. 'corrupted or incomplete'), that's very likely this happening — retry by generating the string again rather than assuming the source image is bad."
        },
        "logo_round": {
          "type": "boolean",
          "description": "Force the logo into a circle."
        },
        "remove_logo": {
          "type": "boolean",
          "description": "Remove the code's logo."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "delete_qr_code",
    "description": "Delete a QR code. Dynamic codes stop redirecting after deletion.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "QR code id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "get_qr_activity",
    "description": "List recent scan events for a dynamic QR code (time, location, device). Use this to answer questions like where or when a code was scanned.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "QR code id."
        },
        "page": {
          "type": "integer",
          "description": "1-based page number."
        },
        "page_size": {
          "type": "integer",
          "description": "Events per page (max 200, default 25)."
        },
        "start": {
          "type": "string",
          "description": "Range start, ISO date or datetime (e.g. 2026-08-03 or 2026-08-03T14:00:00Z). Use start/end together for a fixed window instead of the rolling `days` look-back."
        },
        "end": {
          "type": "string",
          "description": "Range end, ISO date/datetime. Defaults to now when only `start` is given."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "list_templates",
    "description": "List the workspace's saved QR design templates. Pass a template id to create_qr_code to reuse its branding.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        }
      }
    }
  },
  {
    "name": "list_folders",
    "description": "List the workspace's folders with their full path, code count, id and slug. Use a folder's id or slug with create_qr_code / update_qr_code (`folder`) to file codes, or with list_qr_codes to filter.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        }
      }
    }
  },
  {
    "name": "create_folder",
    "description": "Create a folder to organise QR codes, optionally nested under a parent. Creating a folder that already exists (same name, same parent) returns the existing one, so it's safe to call repeatedly.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "name": {
          "type": "string",
          "description": "Folder name."
        },
        "parent": {
          "type": "string",
          "description": "Parent folder id or slug to nest under (optional)."
        }
      },
      "required": [
        "name"
      ]
    }
  },
  {
    "name": "update_folder",
    "description": "Rename a folder and/or move it under another folder. `parent` 'none' moves it to the top level. Codes inside keep their filing.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Folder id (from list_folders)."
        },
        "name": {
          "type": "string",
          "description": "New folder name."
        },
        "parent": {
          "type": "string",
          "description": "New parent folder id or slug, or 'none' for top level."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "delete_folder",
    "description": "Delete a folder. The codes in it (and in its subfolders) are NOT deleted — they become unfiled — and its subfolders move up to its parent.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Folder id (from list_folders)."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "list_tags",
    "description": "List the workspace's tags (title + id). Tags are attached with create_qr_code (`tags`) or update_qr_code (`add_tags` / `remove_tags`), and list_qr_codes searches by tag.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        }
      }
    }
  },
  {
    "name": "update_form",
    "description": "Change an existing form without recreating it: edit its fields, settings (redirect, thank-you, title), or branding (theme/colors/logo), or close/reopen it. If you pass `fields`, provide the COMPLETE desired list — include each existing field's `id` (from get_form) to keep it; omit a field to remove it; leave `id` off a new field. If the form is already published, edits are re-published so they go live.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Form id."
        },
        "status": {
          "type": "string",
          "enum": [
            "close",
            "reopen"
          ],
          "description": "Close (stop responses) or reopen. When set, other edits are ignored."
        },
        "title": {
          "type": "string",
          "description": "New title."
        },
        "description": {
          "type": "string",
          "description": "New description."
        },
        "fields": {
          "type": "array",
          "description": "Complete desired field list (see note); create_form shape plus an optional `id`.",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Existing field id to keep/update; omit if new."
              },
              "label": {
                "type": "string",
                "description": "The field's question/label."
              },
              "type": {
                "type": "string",
                "enum": [
                  "text",
                  "email",
                  "phone",
                  "number",
                  "textarea",
                  "select",
                  "radio",
                  "checkbox",
                  "date",
                  "time",
                  "url",
                  "rating",
                  "scale",
                  "yes_no",
                  "image_choice",
                  "ranking",
                  "statement",
                  "hidden",
                  "page_break",
                  "image"
                ],
                "description": "Field type."
              },
              "required": {
                "type": "boolean",
                "description": "Whether an answer is required."
              },
              "options": {
                "type": "array",
                "description": "Choices for select/radio/checkbox/ranking; {label, image} objects for image_choice.",
                "items": {
                  "type": [
                    "string",
                    "object"
                  ]
                }
              },
              "nps": {
                "type": "boolean",
                "description": "Net Promoter Score preset (0–10, standard labels)."
              },
              "min_label": {
                "type": "string",
                "description": "scale only: label under the lowest value"
              },
              "max_label": {
                "type": "string",
                "description": "scale only: label under the top value"
              },
              "show_when": {
                "type": "object",
                "description": "Conditional logic: show this field only while its conditions match EARLIER answers (e.g. a follow-up question, or a statement recommending a product). Omit to always show.",
                "properties": {
                  "match": {
                    "type": "string",
                    "enum": [
                      "all",
                      "any"
                    ],
                    "description": "Default 'all'."
                  },
                  "rules": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "field": {
                          "type": "string",
                          "description": "The question this condition looks at: its label, its id, or its 0-based position."
                        },
                        "op": {
                          "type": "string",
                          "enum": [
                            "eq",
                            "neq",
                            "contains",
                            "not_contains",
                            "gt",
                            "lt",
                            "is_empty",
                            "not_empty"
                          ],
                          "description": "eq / neq (is, is not), contains / not_contains (text or checkbox), gt / lt (numbers, ratings, dates), is_empty / not_empty (no value needed)."
                        },
                        "value": {
                          "type": "string",
                          "description": "Value to compare with (an option's value for choice questions)."
                        }
                      },
                      "required": [
                        "field",
                        "op"
                      ]
                    }
                  },
                  "action": {
                    "type": "string",
                    "enum": [
                      "show",
                      "require"
                    ],
                    "description": "'show' (default): shown only while the rules match. 'require': always shown, required only while they match. On a page_break field the rules skip the whole page."
                  }
                },
                "required": [
                  "rules"
                ]
              }
            },
            "required": [
              "label"
            ]
          }
        },
        "outcomes": {
          "type": "array",
          "description": "Pathways / branching endings. After submit the first outcome whose rules match decides the ending: its own thank-you title/message and/or a redirect_url (e.g. send people to a different product page per answer). If none match, the default thank-you page is shown.",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Short name, recorded on each response (e.g. 'Recommend Zero Sugar')."
              },
              "match": {
                "type": "string",
                "enum": [
                  "all",
                  "any"
                ],
                "description": "Default 'all'."
              },
              "rules": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "field": {
                      "type": "string",
                      "description": "The question this condition looks at: its label, its id, or its 0-based position."
                    },
                    "op": {
                      "type": "string",
                      "enum": [
                        "eq",
                        "neq",
                        "contains",
                        "not_contains",
                        "gt",
                        "lt",
                        "is_empty",
                        "not_empty"
                      ],
                      "description": "eq / neq (is, is not), contains / not_contains (text or checkbox), gt / lt (numbers, ratings, dates), is_empty / not_empty (no value needed)."
                    },
                    "value": {
                      "type": "string",
                      "description": "Value to compare with (an option's value for choice questions)."
                    }
                  },
                  "required": [
                    "field",
                    "op"
                  ]
                }
              },
              "thank_you_title": {
                "type": "string"
              },
              "thank_you_message": {
                "type": "string"
              },
              "redirect_url": {
                "type": "string",
                "description": "Optional page to send the respondent to."
              },
              "end_early": {
                "type": "boolean",
                "description": "Screening: end the form as soon as this matches (checked on every page change), not just at submit."
              }
            },
            "required": [
              "name",
              "rules"
            ]
          }
        },
        "theme": {
          "type": "string",
          "enum": [
            "light",
            "dark",
            "minimal",
            "bold"
          ],
          "description": "Named color preset. Explicit colors below override it."
        },
        "bg_color": {
          "type": "string",
          "description": "Hex background color."
        },
        "text_color": {
          "type": "string",
          "description": "Hex text color."
        },
        "button_color": {
          "type": "string",
          "description": "Hex submit-button color."
        },
        "button_text_color": {
          "type": "string",
          "description": "Hex button-text color."
        },
        "logo_url": {
          "type": "string",
          "description": "URL of a logo image (JPEG/PNG/GIF/WebP) to show on the form."
        },
        "redirect_url": {
          "type": "string",
          "description": "URL to send respondents to after they submit."
        },
        "thank_you_message": {
          "type": "string",
          "description": "Shown after submitting (if no redirect)."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "list_forms",
    "description": "List the forms in a workspace, newest first. Optional `query` searches by title.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "query": {
          "type": "string",
          "description": "Search term (matches the form title)."
        },
        "page": {
          "type": "integer",
          "description": "1-based page number."
        },
        "page_size": {
          "type": "integer",
          "description": "Results per page (max 100, default 25)."
        }
      }
    }
  },
  {
    "name": "get_form",
    "description": "Get one form's details: status, response count, share link, and QR.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Form id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "get_form_responses",
    "description": "List a form's submissions (newest first) so you can read or summarize them — e.g. 'summarize this week's feedback' or 'any complaints in the responses?'.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Form id."
        },
        "page": {
          "type": "integer",
          "description": "1-based page number."
        },
        "page_size": {
          "type": "integer",
          "description": "Responses per page (max 100, default 25)."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "create_page",
    "description": "Create a published micro landing page (link-in-bio style) with a title and a list of links, and return its live URL (`share_url`) + its own QR code (`qr_id`; style it with the QR design args here; don't create another). Use this for 'make me a page with these links and a QR to share it'. The page is a dynamic destination you can keep; it counts toward the workspace's page limit.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "primary_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the QR pattern, e.g. #111111. Eyes and frame follow it automatically (rules as in create_qr_code)."
        },
        "background_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex background color, or 'transparent'."
        },
        "eye_style": {
          "type": "string",
          "enum": [
            "Square",
            "Rounded",
            "Drop",
            "Leaf"
          ],
          "description": "For the QR code this mints: Corner eye shape."
        },
        "eye_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the corner eyes, only if different from `primary_color`."
        },
        "pattern": {
          "type": "string",
          "enum": [
            "Original",
            "Squares",
            "Circles",
            "Lines",
            "Triangles",
            "Diamonds"
          ],
          "description": "For the QR code this mints: Module pattern style."
        },
        "frame": {
          "type": "string",
          "description": "For the QR code this mints: Frame slug, as in create_qr_code. Set `text` without a `frame` and one that can show it is chosen automatically."
        },
        "frame_color": {
          "type": "string",
          "description": "For the QR code this mints: Hex color for the frame, only if different from `primary_color`."
        },
        "text": {
          "type": "string",
          "description": "For the QR code this mints: Caption text; a frame that can show it is chosen automatically."
        },
        "text_secondary": {
          "type": "string",
          "description": "For the QR code this mints: Secondary caption line, where the frame supports it."
        },
        "has_border": {
          "type": "boolean",
          "description": "For the QR code this mints: Draw a border around the code."
        },
        "logo_url": {
          "type": "string",
          "description": "For the QR code this mints: URL of a logo image to place in the center."
        },
        "error_correction": {
          "type": "string",
          "description": "For the QR code this mints: QR error correction level (L, M, Q, H). Leave unset: it is chosen automatically (H with a logo, Q otherwise)."
        },
        "color_scope": {
          "type": "string",
          "enum": [
            "whole",
            "pattern_only"
          ],
          "description": "For the QR code this mints: 'whole' (default) or 'pattern_only', as in create_qr_code."
        },
        "title": {
          "type": "string",
          "description": "The page's heading."
        },
        "description": {
          "type": "string",
          "description": "Optional text shown under the title."
        },
        "links": {
          "type": "array",
          "description": "The link buttons on the page, in order.",
          "items": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string",
                "description": "Destination URL."
              },
              "title": {
                "type": "string",
                "description": "Button label (defaults to the URL)."
              },
              "type": {
                "type": "string",
                "description": "Optional link type, e.g. Website, Instagram, YouTube."
              }
            },
            "required": [
              "url"
            ]
          }
        },
        "bg_color": {
          "type": "string",
          "description": "Hex background color."
        },
        "text_color": {
          "type": "string",
          "description": "Hex text color."
        },
        "domain": {
          "type": "string",
          "description": "Custom page domain (else a default is used)."
        },
        "slug": {
          "type": "string",
          "description": "Custom URL slug (else auto-generated)."
        }
      },
      "required": [
        "title"
      ]
    }
  },
  {
    "name": "get_page",
    "description": "Get one landing page's details: status, live URL, QR, and its blocks (each block's id + type) so you can edit it with update_page.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Page id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "update_page",
    "description": "Change an existing landing page without recreating it: edit its blocks, title, description, or colors, and publish/unpublish it. Use for 'fix the typo on my page', 'add a section', or 'take the page down'. If you pass `blocks`, provide the COMPLETE desired list (same {type, content} shape as build_page; include each block's `id` from get_page to keep it, omit to remove) — leaving `blocks` off keeps the existing blocks untouched. If the page is already published, edits are re-published so they go live; pass publish:false to take it offline.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Page id."
        },
        "title": {
          "type": "string",
          "description": "New page title."
        },
        "description": {
          "type": "string",
          "description": "New SEO/description text."
        },
        "blocks": {
          "type": "array",
          "description": "Complete desired block list (see note); each is {type, content} + optional id.",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Existing block id to keep/update; omit if new."
              },
              "type": {
                "type": "string",
                "description": "Block type (see list_block_types)."
              },
              "content": {
                "type": "object",
                "description": "The block's content for that type."
              },
              "form": {
                "type": "string",
                "description": "For a 'form' block: the form id to embed."
              },
              "hidden": {
                "type": "boolean",
                "description": "Hide this block from the live page."
              },
              "visible_from": {
                "type": "string",
                "description": "Optional ISO date-time the block starts showing, e.g. 2030-05-01T09:00:00Z."
              },
              "visible_until": {
                "type": "string",
                "description": "Optional ISO date-time the block stops showing."
              },
              "full_width": {
                "type": "boolean",
                "description": "image/gallery/video/embed only: stretch to the screen edges."
              }
            },
            "required": [
              "type"
            ]
          }
        },
        "bg_color": {
          "type": "string",
          "description": "Hex page background color."
        },
        "text_color": {
          "type": "string",
          "description": "Hex text color."
        },
        "publish": {
          "type": "boolean",
          "description": "true = publish/re-publish so edits go live; false = take offline (draft)."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "delete_page",
    "description": "Delete a landing page. Its live URL stops serving and it leaves the workspace's page list. Use for 'delete that page' / 'remove the landing page'.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Page id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "list_pages",
    "description": "List the landing pages in a workspace, newest first.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        }
      }
    }
  },
  {
    "name": "list_block_types",
    "description": "List the page BLOCK TYPES available to build_page, each with its content JSON Schema. Call this first when composing a rich page so you know the vocabulary (header, link, text, image, button, video, gallery, faq, countdown, socials, divider, form, …).",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "get_short_link",
    "description": "Get one short link's details, destination, click counts, and QR.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Short link id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "list_short_links",
    "description": "List short links in a workspace, newest first. Optional `query` searches URL, name, and slug.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "workspace": {
          "type": "string",
          "description": "Workspace id. Optional when the account has one workspace; use list_workspaces to resolve otherwise."
        },
        "query": {
          "type": "string",
          "description": "Search term (destination, name, or slug)."
        },
        "page": {
          "type": "integer",
          "description": "1-based page number."
        },
        "page_size": {
          "type": "integer",
          "description": "Results per page (max 200, default 25)."
        }
      }
    }
  },
  {
    "name": "update_short_link",
    "description": "Update a short link. Changing `link` retargets it — the short URL keeps working, it just points somewhere new. Also supports renaming and toggling location tracking.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Short link id."
        },
        "link": {
          "type": "string",
          "description": "New destination URL."
        },
        "display_name": {
          "type": "string",
          "description": "New internal name."
        },
        "gps": {
          "type": "boolean",
          "description": "Enable/disable the location prompt."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "delete_short_link",
    "description": "Delete a short link. It stops redirecting after deletion.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Short link id."
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "get_short_link_activity",
    "description": "List recent click events for a short link (time, location, device).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Short link id."
        },
        "page": {
          "type": "integer",
          "description": "1-based page number."
        },
        "page_size": {
          "type": "integer",
          "description": "Events per page (max 200, default 25)."
        },
        "start": {
          "type": "string",
          "description": "Range start, ISO date or datetime (e.g. 2026-08-03 or 2026-08-03T14:00:00Z). Use start/end together for a fixed window instead of the rolling `days` look-back."
        },
        "end": {
          "type": "string",
          "description": "Range end, ISO date/datetime. Defaults to now when only `start` is given."
        }
      },
      "required": [
        "id"
      ]
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` belongs to the captured surface. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `qrcanvas error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Read a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * present, otherwise the last parseable message, otherwise
 * null when nothing in the body parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not a JSON payload; skip this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client that holds a single upstream
 * session, opened lazily on first use and reused from
 * then on (for the process lifetime in the MCP server,
 * or for a single invocation in the CLI).
 */
export class QrcanvasClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).HOVERCODE_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private apiKey(): string | null {
    const raw = (this.deps.env ?? process.env).HOVERCODE_API_TOKEN;
    if (raw && raw.trim() !== "") return raw.trim();
    return null;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const key = this.apiKey();
    if (key !== null) headers["Authorization"] = `Bearer ${key}`;
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "qrcanvas", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // Nothing needed from the notification response body.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Hand the upstream result back exactly as received.
    return result;
  }
}

/** Build a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): QrcanvasClient {
  return new QrcanvasClient(deps);
}

/** One-shot helper: a fresh client for a single call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new QrcanvasClient(deps).callTool(name, args);
}

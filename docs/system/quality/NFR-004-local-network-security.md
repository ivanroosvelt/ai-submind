---
id: NFR-004
type: quality-attribute
name: "Local network security"
status: active
evidence: declared-doc
summary: "HTTP on loopback only, per-session token and Host/Origin validation."
aliases: ["loopback", "token", "dns rebinding", "origin"]
tags: [security]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Whether exposing on another interface with an explicit flag is allowed."
  - "How the browser receives the token (startup URL, cookie, header)."
---

# NFR-004 · Local network security

## Requirement
The daemon listens only on 127.0.0.1 (DEC-005); every HTTP/MCP request requires the random session token stored in `knowledge/.ai-submind/runtime.json` (permissions 0600); `Host` and `Origin` are validated (anti DNS-rebinding); no open CORS.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Request with foreign Origin/Host | rejected (403) | S7 test |
| Request without a valid token | rejected | S7 test |
| Listening interfaces | loopback only | S7 test |

## Scope
Daemon, API-001 (Streamable HTTP), API-002.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.

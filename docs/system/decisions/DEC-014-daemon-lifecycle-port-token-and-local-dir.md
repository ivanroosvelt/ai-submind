---
id: DEC-014
type: decision
name: "Daemon lifecycle, port, browser token and self-ignored local directory"
status: active
evidence: declared-doc
summary: "The daemon stops on `ai-submind stop` or after 30 min idle; listens on 127.0.0.1:7777 falling back to a free port; the browser trades a one-time `?token=` URL for an HttpOnly SameSite=Strict cookie; runtime files live in `knowledge/.ai-submind/`, which ignores itself through its own `.gitignore`."
aliases: [daemon, idle, port, 7777, token, cookie, runtime.json, lockfile, gitignore]
tags: [architecture, security, process]
relations:
  affects: [REQ-001, REQ-002, REQ-004, REQ-037, NFR-004, FEAT-001, API-001, API-002, API-003]
  supersedes: []
uncertainties: []
---

# DEC-014 · Daemon lifecycle, port, browser token and self-ignored local directory

## Context
- DEC-005 fixed one daemon per project with `runtime.json` (pid, port, token) in `knowledge/.ai-submind/`,
  but left open its shutdown, its port and how the browser receives the token (REQ-001, REQ-004, REQ-037,
  NFR-004 uncertainties) [declared].
- REQ-002 criterion 1 asks that starting without `knowledge/` creates no document, yet the daemon needs a
  place for its lockfile and `runtime.json` [declared].
- The user chose on 2026-10-14: stop + inactivity, port 7777 with fallback, URL → cookie, and
  `knowledge/.ai-submind/` self-ignored [declared].

## Alternatives considered
1. **Shutdown**: manual only (forgotten processes); on last client close (frequent restarts);
   **manual + inactivity** (chosen).
2. **Port**: free port from the OS (URL changes every start); **fixed 7777 with fallback** (chosen).
3. **Browser token**: fragment read by JS and sent as a header; **one-time URL exchanged for a cookie** (chosen).
4. **Runtime files without `knowledge/`**: per-user cache directory (platform code, changes DEC-005);
   requiring `init` (contradicts REQ-002); **`knowledge/.ai-submind/` with its own `.gitignore`** (chosen).

## Decision
- **Shutdown**: `ai-submind stop`, SIGINT/SIGTERM, or inactivity: no authenticated request in flight and none
  started during the idle period (default 30 min; `--idle <minutes>`, `0` disables). Long-lived streams
  (MCP, live refresh) count as in flight while open.
- **Port**: `127.0.0.1:7777` by default; if it is busy, a free port assigned by the OS. An explicit
  `--port <n>` fails if busy. The port in use is published in `runtime.json`.
- **Token**: 32 random bytes (base64url) per daemon start. Clients send `Authorization: Bearer <token>`.
  The URL printed on stderr carries `?token=<token>` once; the daemon answers with a cookie
  `ai-submind-<port>=<token>; HttpOnly; SameSite=Strict; Path=/` and a redirect without the token.
  Comparison in constant time. Missing or wrong token → 401; `Host` other than `127.0.0.1:<port>` or
  `localhost:<port>`, or an `Origin` other than `http://` plus one of those → 403.
- **Local directory**: `serve` and `init` create `knowledge/.ai-submind/` with a `.gitignore` containing `*`;
  git sees nothing, so `init` does not edit the root `.gitignore`. Without `knowledge/`, `serve` creates only
  that directory (mode 0700) and no document. It holds `daemon.lock` (published with `link()` from a temporary
  file that already holds the pid; a lock whose pid is dead is removed only under an exclusive
  `daemon.lock.recover` guard, after re-reading that it still holds the same dead pid), `runtime.json` (pid,
  port, token, URL, version; mode 0600, atomic write) and, for daemons started by `ensureDaemon`, `daemon.log`
  (mode 0600, it contains the token URL).
- Requests that cannot be parsed get 400 and handler failures 500; neither stops the daemon.
- No automatic browser opening (P11): the URL is printed on stderr.

## Consequences
- Positive: stable URL for the usual single project; no tokens in browser history after the redirect; no
  processes left running forever; `knowledge/` never shows untracked files.
- Negative / costs: a second project gets a random port; a pid reused by another process makes an orphan
  lock look alive until that process ends (the client then waits and fails with an explicit message).
  Browsers send cookies by host, not by port: any other HTTP service on `127.0.0.1` that the browser visits
  receives the cookie; the per-port name only avoids collisions between daemons.
- MCP (DEC-016): `/mcp` is stateless, so a connected stdio proxy holds no daemon state and does not block the
  idle shutdown; when the daemon is gone or restarted, the proxy starts or finds it again with `ensureDaemon` and
  retries the request once.

## Affected elements
REQ-001, REQ-002 (criterion 2: the `.gitignore` lives in `.ai-submind/`), REQ-004, REQ-037, NFR-004, FEAT-001, API-001,
API-002, API-003; `src/daemon/`, `src/cli/`.

## Verification
PLAN-002 S7 tests in `test/daemon/`.

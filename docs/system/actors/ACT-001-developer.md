---
id: ACT-001
type: actor
name: "Developer"
status: active
evidence: declared-doc
summary: "Person who launches ai-submind in their project, explores diagrams in the UI and adjusts their layout."
aliases: ["user", "person"]
tags: [person]
relations:
  specializes: []
uncertainties: []
---

# ACT-001 · Developer

## Description
Person working on the host project: runs `npx ai-submind`, opens the local UI and versions
`knowledge/` with Git. There are no internal roles nor end-user authentication (single local user) [inferred].

## Goals
Understand and document the system through diagrams versioned alongside the code.

## Permissions

| Resource / operation | Allowed | Conditions |
|---------------------|-----------|-------------|
| CLI (`serve`, `mcp`, `init`, `status`, `stop`, validate) | yes | API-003 |
| UI: read models, diagrams, validation | yes | API-002, loopback + token |
| UI: modify layout | yes | layout only (REQ-029) |
| UI: create/modify/delete model elements | no | REQ-032 (DEC-006) |
| Edit `knowledge/` by hand, commit, merge | yes | outside ai-submind; revalidated (REQ-007) |

---
id: ACT-003
type: actor
name: "Host Git repository"
status: active
evidence: declared-doc
summary: "Passive system that alters knowledge/ (checkout, pull, merge) and may leave conflicts."
aliases: ["git", "repository", "merge", "checkout"]
tags: [external-system]
relations:
  specializes: []
uncertainties: []
---

# ACT-003 · Host Git repository

## Description
Git of the host project: it is the history of `knowledge/` (DEC-004). It does not invoke ai-submind; its operations
change files on disk and ai-submind must detect them (REQ-007, REQ-034..036).

## Goals
Preserve the evolution of the knowledge alongside the code.

## Permissions

| Resource / operation | Allowed | Conditions |
|---------------------|-----------|-------------|
| Modify files in `knowledge/` | yes (external) | ai-submind revalidates and does not silently repair |

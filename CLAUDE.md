# CLAUDE.md — adaptador para Claude Code

Las instrucciones canónicas del repositorio están en `AGENTS.md` y se cargan con la
importación nativa de Claude Code:

@AGENTS.md

## Solo para Claude Code

- Agentes: `.claude/agents/*.md` (subagentes nativos; invocar con la herramienta Agent y
  `subagent_type` = nombre del agente). Skills: `.claude/skills/*/SKILL.md` (herramienta Skill).
  IDs y estado en `.ai/registry/components.yaml`.
- Revisión independiente (AGENTS.md §10): lanzar `change-verifier` como subagente con contexto
  limpio; no autoaprobar cambios del entorno desde la misma sesión que los produjo.
- `.claude/settings*.json` no se modifica sin aprobación humana (permisos = política de seguridad).
- Instrucciones globales del usuario (`~/.claude/CLAUDE.md`) aplican también; si contradicen a
  `AGENTS.md` en algo propio de este repositorio, reportarlo antes de actuar.

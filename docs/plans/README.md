# Planes

- `active/` — planes en curso (`proposed`, `ready`, `in_progress`, `blocked`, `verified`).
- `archive/` — planes cerrados (`completed`, `cancelled`, `superseded`). Histórico: no se reescribe.

Procedimiento: skill `staged-plan` (`.claude/skills/staged-plan/SKILL.md`). Plantilla:
`docs/templates/plan.md`. El validador comprueba ubicación, estados, evidencias y `next_action`.

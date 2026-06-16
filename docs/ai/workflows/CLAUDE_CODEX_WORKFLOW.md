# Claude + Codex Workflow

## Roles

Codex:
- Code-level audit
- File inventory
- Small implementations
- Tests
- Report generation
- Handoff writing

Claude:
- Architecture review
- Security review
- Challenge unsupported claims
- Turn audit into prioritized backlog
- Review Codex diffs
- Write next Codex prompts

## Standard Loop

1. Codex performs code-only audit.
2. Codex writes audit report and verified memory files.
3. Claude reviews the report and challenges weak evidence.
4. Codex fills gaps or fixes one issue per branch.
5. Claude reviews the diff.
6. Human approves merge.
7. Memory and handoff are updated.

## Rule

Never let Claude and Codex edit the same branch at the same time.

# Kiro Tool Mapping

Skills speak in actions ("invoke a skill", "dispatch a subagent", "create a
todo", "read a file"). On Kiro these resolve to the tools below. Kiro is an
IDE-based harness (built on VS Code) with native skills, steering, hooks, and
subagents.

| Action skills request | Kiro equivalent |
| --- | --- |
| Invoke / load a skill | Kiro auto-activates a skill by matching your request against the skill's `description`, and loads the full `SKILL.md` on demand. You can also trigger one explicitly: a skill named `brainstorming` is available as the `/brainstorming` slash command. When a skill applies, let it activate (or invoke it by name) — see "Invoking skills" below. |
| Read a file | `readFile` (single file) / `readMultipleFiles`. Prefer these over `cat`/`head`/`tail`. |
| Create / write a file | `fsWrite` (full-file write; creates parent dirs). |
| Edit a file | `strReplace` (targeted edit) or `fsAppend` (append). Prefer these over `sed`/`awk`. |
| Delete a file | `deleteFile`. |
| Move / rename a file (update imports) | `smartRelocate`. Rename a symbol across the codebase: `semanticRename`. |
| Run a shell command | `executeBash`. Use `cwd` rather than `cd`; never use `cd`. Set `run_in_background: true` for long-running processes (dev servers, watchers). |
| Search file contents (grep) | `grepSearch` (ripgrep-backed regex). Prefer over shell `grep`/`rg`/`ag`. |
| Find files by name (glob) | `fileSearch` (path substring) / `listDirectory`. Prefer over `find`/`ls`. |
| Fetch a URL | `webFetch`. |
| Web search | `webSearch` (a.k.a. remote web search). |
| Dispatch a subagent | `invokeSubAgent` with a `name` (agent type) — see "Subagents" below. |
| Create / update todos ("create a todo", "mark complete") | `todoList` with commands `create` / `add` / `complete` / `remove` / `list`. Treat older `TodoWrite` references as this action. |
| Update session status shown to the user | `updateSessionInformation` (optional; title/description/status). |
| Create a hook | `createHook` — writes `.kiro/hooks/<id>.json`. Do not hand-write hook files. |

## Invoking skills

Kiro uses **progressive disclosure**: at session start it loads only each
skill's `name` + `description`; when your request matches a description it loads
the full `SKILL.md`. This means the "check for a relevant skill before acting"
rule is honored by letting the matching skill activate — you do **not** need to
manually read `SKILL.md` with a file tool to use a skill.

When a skill's reference/prompt/template files are named (e.g.
`./implementer-prompt.md`, `references/foo.md`), read those with `readFile` when
the skill directs you to — that is loading a resource the active skill points at,
not bypassing the skill mechanism.

## Subagents

Kiro ships a native `invokeSubAgent` tool. Available agent `name` values include:

- `general-task-execution` — general-purpose agent with access to all tools; use
  this as the implementer/worker when a skill says to "dispatch a subagent" or
  references a `Subagent (general-purpose):` template.
- `context-gatherer` — read-only codebase investigation; use for research/analysis
  tasks that only need to understand existing code.
- `semantic_reviewer` — reviews code changes at the behavioral level; a natural fit
  where a skill dispatches a code reviewer.
- `introspect` — answers questions about Kiro itself only.
- `custom-agent-creator` — creates new custom agents.

Notes:

- Give each subagent a clean, self-contained prompt: it does not inherit your
  session's conversation history, so include exactly the context and task it needs.
- Subagents are available only in Autopilot mode. If subagent dispatch is
  unavailable (e.g. Supervised mode), do **not** fabricate a `Task`/dispatch call —
  execute the work inline in the current session, or say the capability is
  unavailable. Skills like `subagent-driven-development` and
  `dispatching-parallel-agents` have inline/`executing-plans` fallbacks for this.
- You can issue multiple independent `invokeSubAgent` calls to parallelize
  independent work streams.

## Task lists

Use `todoList` for task tracking. At the start of a multi-step task, `create` a
todo per step; `complete` each as you finish it; `add`/`remove` as the plan
changes. Do not print your own task list — Kiro renders it for the user. Older
Superpowers docs may say `TodoWrite`; treat that as the `todoList` action above.

## Environment detection (worktrees / finishing branches)

Skills that create worktrees or finish branches should detect their environment
with read-only git commands via `executeBash` before proceeding:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- `GIT_DIR != GIT_COMMON` → already in a linked worktree (skip creation)
- `BRANCH` empty → detached HEAD (cannot branch/push/PR)

See `using-git-worktrees` and `finishing-a-development-branch` for how each skill
uses these signals.

---
name: superpowers
description: Use when the user wants a disciplined software-development methodology for a project - installs and activates the Superpowers system (15 composable skills + an always-on bootstrap) into the current workspace's .kiro/ so brainstorming, writing-plans, executing-plans, subagent-driven-development, test-driven-development, systematic-debugging, code review and branch-finishing skills auto-trigger. Actions: activate superpowers, install superpowers, enable the development methodology, "use my superpowers", set up brainstorming/TDD/planning workflow for this project.
license: MIT
metadata:
  version: "1.0"
  author: vic-alonso
  based_on: obra/superpowers (MIT)
---

# superpowers

Superpowers is a complete software-development methodology made of composable
**skills** plus a bootstrap that makes the agent actually use them. This skill is
the **activator**: activating it installs the full system into the current
workspace so every other Superpowers skill can auto-trigger for the rest of the
project.

Activating this skill does not, by itself, run brainstorming or any workflow. It
**sets up** the system. After activation, the individual skills
(`brainstorming`, `writing-plans`, etc.) take over based on what the user asks.

## Why this step exists

Kiro loads skills from `.kiro/skills/` and always-on instructions from
`.kiro/steering/` in the workspace root. The Superpowers bootstrap
(`superpowers-bootstrap.md`, `inclusion: always`) is what makes the skills fire
at the right moments. Until those files exist in the target workspace's `.kiro/`,
nothing auto-triggers — which is why simply having the package on disk does not
activate anything.

## What to do when this skill is activated

The package source is the `superpowers-skills` directory. This skill lives in
its `activator/` subfolder, so the package root is the **parent** of the folder
containing this `SKILL.md`. Resolve it as `PKG` below.

1. **Locate the package.** `PKG` is the parent of the directory containing this
   `SKILL.md` — i.e. the `superpowers-skills` root (the global skill symlink
   `superpowers` points at `superpowers-skills/activator`). `PKG` must contain
   `skills/` and `steering/` subdirectories and `install.sh`.

2. **Pick the target workspace.** Default to the current workspace root the user
   is working in. Confirm with the user only if it is ambiguous.

3. **Install by running the package's install script** with `executeBash`:

   ```bash
   bash <PKG>/install.sh <TARGET_WORKSPACE>
   ```

   The script copies `skills/` → `<target>/.kiro/skills/` and `steering/` →
   `<target>/.kiro/steering/superpowers-bootstrap.md`. Re-running it updates in
   place; unrelated files in `.kiro/` are left untouched. To enable Superpowers
   for **every** workspace instead of one, run it against the home directory:
   `bash <PKG>/install.sh ~`.

4. **Verify the install.** Confirm these exist in the target:
   - `<target>/.kiro/steering/superpowers-bootstrap.md`
   - `<target>/.kiro/skills/using-superpowers/SKILL.md`
   - `<target>/.kiro/skills/using-superpowers/references/kiro-tools.md`

5. **Tell the user it is active and how to use it.** The bootstrap
   (`inclusion: always`) loads in every *new* session in that workspace, so the
   skills auto-trigger from then on. In the current session you can start
   immediately by invoking the relevant skill by name (e.g. `/brainstorming`).

## The skills you just enabled

These are registered globally with the `superpwr-` prefix (e.g.
`superpwr-brainstorming`), so they appear individually in Kiro's global skill
list and can be invoked by name.

- **superpwr-using-superpowers** — the rule engine: check for a relevant skill
  before any action; it is loaded every session by the bootstrap.
- **superpwr-brainstorming** — refine a rough idea into a design before any code.
- **superpwr-writing-plans** — break work into small, verifiable tasks.
- **superpwr-executing-plans** / **superpwr-subagent-driven-development** —
  execute the plan inline or with a fresh subagent per task plus review.
- **superpwr-test-driven-development** — RED → GREEN → REFACTOR.
- **superpwr-systematic-debugging** — root-cause a bug instead of patching symptoms.
- **superpwr-using-git-worktrees** — isolated branch workspace.
- **superpwr-requesting-code-review** / **superpwr-receiving-code-review** —
  review between tasks.
- **superpwr-verification-before-completion** — confirm the work truly meets the goal.
- **superpwr-finishing-a-development-branch** — merge / PR / cleanup.
- **superpwr-dispatching-parallel-agents**, **superpwr-writing-skills**,
  **superpwr-diagnosing-superpowers** — supporting skills.

## Typical flow after activation

1. `superpwr-brainstorming` — refine the idea.
2. `superpwr-using-git-worktrees` — isolated branch.
3. `superpwr-writing-plans` — small, verifiable tasks.
4. `superpwr-subagent-driven-development` / `superpwr-executing-plans` — build it.
5. `superpwr-test-driven-development` — throughout.
6. `superpwr-requesting-code-review` / `superpwr-receiving-code-review` — between tasks.
7. `superpwr-finishing-a-development-branch` — merge / PR / cleanup.

## Platform notes (Kiro)

- Subagents map to `invokeSubAgent` and are only available in **Autopilot** mode;
  in Supervised mode the subagent-based skills fall back to inline execution.
- The tool-mapping reference the skills use is
  `.kiro/skills/using-superpowers/references/kiro-tools.md` (installed in step 3).

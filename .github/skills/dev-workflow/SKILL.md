---
name: dev-workflow
description: 'Development workflow for making and validating code changes. USE FOR: any code change, bug fix, feature addition, or refactoring task. DO NOT USE FOR: pure research, documentation-only changes, or git operations.'
argument-hint: 'Describe the code change needed, e.g. "fix decoration loading in solver" or "add filter by element type"'
---

# Development Workflow Skill

Ensures every code change is validated through build, test, and visual inspection before being considered complete.

## Procedure

1. **Understand the change** — Read relevant source files to understand the current behavior and the scope of changes needed.

1. **Make the code change** — Edit the necessary files. Follow project conventions from `.github/copilot-instructions.md`.

1. **Build the project** — Run the production build to catch compilation errors:
   ```powershell
   npx ng build --configuration production 2>&1 | Select-String "ERROR|Output location"
   ```
   - If errors are found, fix them before proceeding.

1. **Run unit tests** — Execute tests related to the changed code:
   ```powershell
   npx ng test --no-watch 2>&1
   ```
   - If tests fail, fix the code or update the tests as appropriate.
   - If the change affects the Build Solver, run solver-specific tests:
     ```powershell
     npx ng test --include="**/build-solver.service*.spec.ts" --no-watch 2>&1
     ```

1. **Start the dev server** — Launch the development server for visual validation:
   ```powershell
   npm start
   ```
   - Wait for the server to report `Local: http://localhost:4200/`

1. **Validate with Chrome DevTools MCP** — Use the Chrome DevTools MCP server to visually verify the change:
   1. Navigate to `http://localhost:4200/`
   1. Take a screenshot to confirm the UI renders correctly
   1. Check the browser console for JavaScript errors via `list_console_messages`
   1. If the change affects a specific UI component (e.g., Build Solver modal), interact with it:
      - Click the relevant button to open the component
      - Take a screenshot of the component in its active state
      - Test the specific interaction that was changed
   1. If errors are found, fix and repeat from step 3

1. **Report results** — Summarize what was changed and confirm the validation passed.

## Rules

- Always use `--no-pager` with git commands
- Use PowerShell commands only (Windows environment)
- Never skip the build step — compilation errors must be caught before visual validation
- Never skip the Chrome DevTools validation — visual confirmation is required
- If the dev server is already running, reuse it instead of starting a new one
- Kill stale Chrome processes before launching Chrome DevTools MCP if connection fails

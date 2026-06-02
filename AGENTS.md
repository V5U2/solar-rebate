# AGENTS.md

Project-level instructions for coding agents working in this repository.

## Repo Shape

- This is a dependency-free static web app for an Australian battery rebate calculator.
- Runtime files are `index.html`, `styles.css`, and `app.js`.
- Calculation and persistence coverage lives in `app.test.js`.
- There is no build step, CI config, docs directory, release automation, or package manager install requirement beyond Node's built-in test runner.

## Command Inventory

- Run tests: `npm test`
- Run the local static app: `python3 -m http.server 8080`
- Browser smoke check: open `http://127.0.0.1:8080/` and verify the calculator renders, updates results, and has no console warnings or horizontal overflow.

## Working Rules

- Keep `AGENTS.md` concise and navigational. Add durable product or setup detail to versioned docs only when those docs exist or are created for a real need.
- Documentation is part of the change: if behavior, setup, supported jurisdictions, official-source assumptions, or public copy changes, update the relevant in-repo text in the same task.
- Use official government sources for rebate rules and avoid adding non-official assumptions to calculations.
- Prefer small, reversible edits. Do not add dependencies, frameworks, bundlers, or package scripts unless the task clearly requires them.
- Preserve browser-storage behavior when changing form inputs: new persisted settings should be included in the storage field list and covered by tests.
- Keep user-facing calculator copy plain and specific. Do not hide eligibility uncertainty; show it as a warning or source note.

## Verification Rules

- Run the narrowest meaningful check first, usually `npm test` for calculator logic or persistence changes.
- For UI changes, also perform a browser smoke check against the local static server when practical.
- For responsive UI changes, check at least one desktop-width and one mobile-width view, and verify there is no horizontal overflow.
- If a check cannot be run, state that explicitly in the final handoff.
- Do not claim a rebate, state program, or source is current without checking official sources when the fact could have changed.

## Harness And Release Rules

- Prefer executable feedback loops over reminders: tests and browser smoke checks should catch calculator regressions where possible.
- If repeated review feedback appears, promote it into tests, source notes, or this file.
- Keep local agent state and browser-test artifacts out of version control via `.gitignore`.
- Do not bump versions, tag releases, publish artifacts, initialize hosting, or set up CI unless explicitly asked.

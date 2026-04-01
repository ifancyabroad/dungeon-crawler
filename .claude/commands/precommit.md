# precommit

Review the current uncommitted changes and improve them where necessary before commit.

Focus on high-value improvements:

- potential bugs
- unnecessary complexity
- redundant or duplicated code
- simplification opportunities
- poor separation of concerns
- architecture violations
- missing validation

Apply fixes directly where they are clear and safe.

Keep changes minimal and limited to the files already being modified.
Avoid large refactors or rewriting unrelated code.
Do not focus on minor style or formatting issues.
Prefer the smallest clear fix rather than introducing new abstractions.

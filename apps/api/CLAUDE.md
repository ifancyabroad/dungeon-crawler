# API Validation Rules

All client input is untrusted.

For every action request:

1. Parse using Zod (prefer schemas from `@app/shared`).
2. Validate legality against current authoritative state.
3. Apply action using shared engine.
4. Persist:
    - updated state snapshot
    - appended action log (enables replay and debugging)
5. Return authoritative state.
6. On parse/legality/engine failure, respond with a 4xx status and a structured error payload (include the engine `reason` when available).

Never:

- Trust client-computed results.
- Accept client-provided RNG seeds.
- Skip validation for user-controlled endpoints.

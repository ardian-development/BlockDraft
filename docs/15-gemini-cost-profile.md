# Gemini cost profile

BlockDraft uses a fast, low-cost generation profile by default. The server calls the stable `gemini-3.1-flash-lite` model, requests structured JSON in one pass and caps the response at 3,000 output tokens. Prompt text is capped at 600 characters and the BuildSpec remains bounded to 32 blocks per axis and 200 operations.

This is intentionally a text-only path: there is no automatic vision review, photo-to-3D call or second repair request in the fast profile. That keeps latency and spend predictable while the product is tested locally.

## Quality switch

Set these server-only values in `.env.local` when a quality test is needed:

```text
GEMINI_PROFILE=quality
GEMINI_MODEL=gemini-3.5-flash
```

The quality profile allows a larger response and slightly higher temperature. It should be reserved for complex prompts, character/prop modes and a future “Improve match” action. A later router can select quality only after a validator failure or when the user explicitly spends a credit.

## Cost controls

- Keep one generation call as the default.
- Keep the prompt concise and the output schema bounded.
- Do not send reference photos to the fast text route.
- Add a single repair call only behind an explicit quality path.
- Enforce per-user daily quotas before enabling public hosting.

Google currently lists Gemini 3.1 Flash-Lite at $0.25 per 1 million input tokens and $1.50 per 1 million output tokens on the standard paid tier; the exact cost of one build depends on its token count and account tier. See the [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) and [official pricing](https://ai.google.dev/gemini-api/docs/pricing?authuser=3). Model availability and prices can change.

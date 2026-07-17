# Project-owner inputs and open items

## Required before the real cloud connection

1. Firebase project ID. Local development can continue with the `demo-` emulator project; production Firebase is needed for the online alpha.
2. Login decision: the current recommendation is email/password plus Google.
3. AI provider and API key: Gemini is the default recommendation; OpenAI remains an interchangeable adapter. Keys must be stored server-side only.
4. Minecraft target version: default recommendation is Java Edition 1.21.x. The exact minor version must be fixed before production export tests are accepted.
5. Product name and domain: **BlockDraft**, primary domain `blockdraft.com`.
6. Legal/imprint details: operator name, contact address, privacy policy and cancellation requirements.

## Current product defaults

- Product language: English. Developer documentation may contain German notes during the migration, but all public UI and customer-facing copy must be English.
- Registration: required when generating or saving a build.
- Photo: reference mode first; reconstruction mode later with explicit warnings.
- Photo retention: temporary with automatic deletion; persistent storage only by opt-in.
- Free limit: one text build and one photo reference build per day during alpha testing.
- Public gallery: private by default; manual approval for featured content.
- Payments: disabled until retention and AI cost data are measured.

## Not required for the local MVP

- Firebase account
- AI API key
- Domain registration
- Payment provider
- Minecraft server
- Social-media accounts

## Never share these in chat or commit them to the repository

Only store them in `.env.local` or a secret manager:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
GEMINI_API_KEY or OPENAI_API_KEY (server-side only)
```

The Firebase browser configuration is not an admin credential, but it still belongs in the local environment file rather than in chat transcripts.

## Product decisions for acceptance

- Is Java Edition 1.21.x the first export target?
- Should the first photo mode focus on style/reference or best-effort reconstruction?
- Which three building categories should lead the first marketing campaign?
- Should the first public alpha stay local-only or go online with Firebase accounts?

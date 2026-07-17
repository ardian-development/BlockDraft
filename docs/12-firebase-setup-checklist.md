# Firebase setup checklist for BlockDraft

The first cloud phase uses Firebase Authentication, Firestore and Cloud Storage. The local MVP continues to work without Firebase. Do not send passwords, service-account JSON files or AI provider keys in chat.

## What the project owner needs to do

### 1. Create the Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project with a name such as `BlockDraft`.
3. Choose a globally unique project ID, for example `blockdraft-prod-2026` or `blockdraft-app`.
4. Google Analytics is optional for the first local connection; enable it only if you want product analytics immediately.

Firebase project IDs cannot be changed after creation. Firebase's official web setup then requires registering a Web app to obtain the configuration object.

### 2. Register the Web app

1. In the project overview, choose the Web icon (`</>`).
2. Use an internal nickname such as `BlockDraft Web`.
3. Do not enable Firebase Hosting yet; we can keep local/LAN development separate.
4. Copy the Web SDK configuration values into the local `.env.local` file described below.

### 3. Enable Authentication

In **Build > Authentication > Sign-in method**, enable:

- Email/Password
- Google

Keep other providers disabled for now. Add the local development host and future production hosts under **Authentication > Settings > Authorized domains**:

- `localhost`
- the LAN hostname/IP if Firebase accepts it for the test setup
- `blockdraft.com`
- `www.blockdraft.com` if it will redirect to the canonical host

### 4. Create Firestore

1. Open **Build > Firestore Database**.
2. Create the database in production mode.
3. Choose a region close to the first users. This cannot be changed casually later.
4. Do not manually create collections yet; the application schema and security rules will do that.

### 5. Cloud Storage (only when photo uploads go online)

Cloud Storage for Firebase currently requires the pay-as-you-go Blaze plan. Do **not** upgrade or add a billing account just for the first Auth/Firestore test. The local emulator already covers Storage without a production bucket.

When we are ready to test online photo uploads:

1. Set a Google Cloud budget alert before enabling Blaze.
2. Open **Build > Storage** and create the default bucket.
3. Keep user-uploaded photos private by default.
4. The application will enforce file type, size and temporary retention rules. The first photo pipeline limit is one JPG/PNG/WebP file up to 8 MB.

This requirement is documented by Firebase's current Storage setup and pricing guidance; no-cost usage can still apply on Blaze, but it is not a hard spending cap.

### 6. Create a local environment file

From `E:\codekreativ\2026-07-VoxelBlueprint`, copy `.env.example` to `.env.local` and replace the fake values:

```text
VITE_FIREBASE_API_KEY=your_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
# Leave blank until the online Storage bucket is created on Blaze.
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_web_app_id
VITE_USE_FIREBASE_EMULATORS=false
```

The Firebase Web configuration contains project/app identifiers, not an admin credential. It still belongs in `.env.local` and must not be committed. `.gitignore` already excludes local environment files.

### 7. Optional: connect the Firebase CLI

Run these commands in PowerShell on the development machine:

```powershell
cd E:\codekreativ\2026-07-VoxelBlueprint
firebase login
firebase projects:list
firebase use --add
firebase emulators:start --project your_project_id
```

Choose the new project when `firebase use --add` asks. Never create or share a service-account key for this initial browser-auth phase.

## What the project owner should give the developer

Preferred handoff:

1. Confirm the chosen Firebase project ID.
2. Confirm that Email/Password and Google providers are enabled.
3. Create `.env.local` locally using the Web config values.
4. Tell the developer that the file is ready; do not paste passwords or AI keys into chat.

If the shared workspace is not available to the developer, send only these six Web config values through an approved private channel: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`. Never send a Firebase Admin service-account JSON or `GEMINI_API_KEY`/`OPENAI_API_KEY` in chat.

## What happens after the handoff

1. Verify email/password and Google sign-in locally.
2. Connect Firestore user/project documents with the existing rules.
3. Connect Storage photo upload with private paths and automatic cleanup.
4. Add App Check and server-side generation endpoints before any public launch.
5. Add `blockdraft.com` to the production hosting and auth configuration once DNS is available.

## Official references

- [Add Firebase to a JavaScript project](https://firebase.google.com/docs/web/setup)
- [Firebase Authentication for websites](https://firebase.google.com/docs/auth/web/start)
- [Firebase CLI reference](https://firebase.google.com/docs/cli)

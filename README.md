# PulseBridge

PulseBridge is a full-stack global communication platform with:

- WebSocket-based real-time messaging
- WebRTC voice and video calling
- End-to-end encrypted messages using RSA-OAEP + AES-GCM
- JWT authentication
- Supabase Postgres persistence for users, conversations, and encrypted message envelopes
- AI translation and smart replies with a pluggable provider or mock mode
- Global Rooms, offline draft sync, ephemeral messages, browser notifications, and a privacy dashboard
- A single-origin website deployment where Express serves the React app and API together

## Stack

- Frontend: React + TypeScript + Vite + Socket.IO client + Framer Motion
- Backend: Node.js + Express + Socket.IO + Supabase Postgres via `pg`
- Realtime: Socket.IO over WebSocket transport
- Calling: WebRTC with STUN/TURN configuration from backend
- Encryption: Web Crypto API in the browser
- Deployment shape: one website, one origin, one backend host
- Scale path: optional Redis adapter for multi-instance socket fan-out

## Folder Structure

```text
pulsebridge/
├─ client/
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ chat/
│  │  │  └─ panels/
│  │  ├─ context/
│  │  ├─ lib/
│  │  ├─ pages/
│  │  └─ styles/
│  ├─ .env.example
│  ├─ index.html
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ vite.config.ts
├─ server/
│  ├─ src/
│  │  ├─ config/
│  │  ├─ middleware/
│  │  ├─ models/
│  │  ├─ routes/
│  │  ├─ services/
│  │  └─ socket/
│  ├─ .env.example
│  ├─ package.json
│  └─ tsconfig.json
├─ shared/
│  └─ realtime-protocol.md
├─ .gitignore
├─ package.json
└─ README.md
```

## Security Model

1. During registration, the client generates an RSA public/private key pair.
2. The public key is sent to the backend.
3. The private key is encrypted on-device with a password-derived AES key and only the encrypted bundle is stored.
4. For each message, the sender creates a fresh AES-GCM content key.
5. The message body and attachment payloads are encrypted with AES-GCM.
6. The AES key is wrapped once per participant using each participant’s public RSA key.
7. The backend stores only ciphertext, IV, metadata, and wrapped recipient keys.
8. The receiver decrypts locally with their private key after unlocking their session.

## Core API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Users

- `GET /api/users/discover?q=optional`

### Conversations

- `GET /api/conversations`
- `POST /api/conversations/direct`
- `POST /api/conversations/group`
- `POST /api/conversations/rooms/:roomId/join`
- `GET /api/conversations/:conversationId/messages`
- `POST /api/conversations/:conversationId/messages`

### AI

- `POST /api/ai/translate`
- `POST /api/ai/smart-replies`

### Realtime / Calling Config

- `GET /api/config/realtime`

### Health

- `GET /health`

## Socket Events

Client emits:

- `conversation:join`
- `typing:start`
- `typing:stop`
- `message:published`
- `receipt:read`
- `call:initiate`
- `call:accept`
- `call:decline`
- `call:signal`
- `call:end`

Server emits:

- `presence:update`
- `typing:update`
- `message:new`
- `receipt:update`
- `call:incoming`
- `call:accepted`
- `call:declined`
- `call:signal`
- `call:ended`

## Local Setup

### 1. Install dependencies

From the repo root:

```bash
npm install
```

### 2. Configure environment variables

Create these files:

- `server/.env`

Use the included examples:

```bash
cp server/.env.example server/.env
```

Or let PulseBridge create the missing server env file for you:

```bash
npm run setup
```

On Windows PowerShell systems where `npm.ps1` is blocked by execution policy, use the bundled command wrappers instead:

```powershell
.\setup.cmd
```

### 3. Set backend environment values

Minimum required in `server/.env`:

```env
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
DATABASE_SSL=true
AI_MODE=mock
STUN_URLS=stun:stun.l.google.com:19302,stun:global.stun.twilio.com:3478
```

Run the SQL in [server/supabase/schema.sql](/C:/Users/chans/Downloads/pulsebridge/server/supabase/schema.sql) in your Supabase project before starting the app.

Optional for production-grade calls:

```env
TURN_URL=turn:your-turn-server:3478
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-password
REDIS_URL=redis://...
```

Optional for live LLM features:

```env
AI_MODE=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your-key
AI_MODEL=gpt-4o-mini
```

### 4. Start the app

Run from the root:

```bash
npm run dev
```

Frontend dev site:

- [http://localhost:5173](http://localhost:5173)

Backend API / Socket.IO:

- [http://localhost:4000](http://localhost:4000)

In development, Vite proxies `/api`, `/health`, and `/socket.io` to the backend, so the browser still behaves like a single website.

### 5. Build the unified production site

From the root:

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

That server will:

- serve the built React app from `client/dist`
- expose the API under `/api`
- expose Socket.IO under `/socket.io`
- run the whole site from one origin

### 6. One-command automated launch

If `server/.env` is present and has a real `DATABASE_URL` plus `JWT_SECRET`, you can let the repo validate, build, and start the merged site in one step:

```bash
npm run launch
```

Helpful automation commands:

- `npm run setup` creates `server/.env` from the example if it is missing
- `npm run check` validates the required unified app environment values
- `npm run launch` runs setup, validation, build, and production start in one flow

Windows PowerShell fallback commands:

- [setup.cmd](/C:/Users/chans/Downloads/pulsebridge/setup.cmd)
- [check.cmd](/C:/Users/chans/Downloads/pulsebridge/check.cmd)
- [launch.cmd](/C:/Users/chans/Downloads/pulsebridge/launch.cmd)
- [serve.cmd](/C:/Users/chans/Downloads/pulsebridge/serve.cmd)
- [stop.cmd](/C:/Users/chans/Downloads/pulsebridge/stop.cmd)
- [PulseBridge.cmd](/C:/Users/chans/Downloads/pulsebridge/PulseBridge.cmd)
- [PulseBridge.vbs](/C:/Users/chans/Downloads/pulsebridge/PulseBridge.vbs)

Recommended Windows entrypoint:

- Double-click [PulseBridge.cmd](/C:/Users/chans/Downloads/pulsebridge/PulseBridge.cmd) or [PulseBridge.vbs](/C:/Users/chans/Downloads/pulsebridge/PulseBridge.vbs)
- If PulseBridge is already running, it just opens [http://localhost:4000](http://localhost:4000)
- If the build already exists but the server is down, it starts the server in the background and waits for health
- If the build is missing, use [launch.cmd](/C:/Users/chans/Downloads/pulsebridge/launch.cmd) once to build and start it
- Logs are written to `.pulsebridge/server.out.log` and `.pulsebridge/server.err.log`

## Production Deployment

### Unified Deploy on Render or Railway

Deploy the repository as one web service so the frontend and backend share the same domain.

1. Build command:

```bash
npm install && npm run build
```

2. Start command:

```bash
npm start
```

3. Add environment variables from `server/.env.example`.
4. Create a Supabase project and apply [server/supabase/schema.sql](/C:/Users/chans/Downloads/pulsebridge/server/supabase/schema.sql).
5. Set `DATABASE_URL` to your Supabase Postgres connection string.
5. Add Redis if you want horizontal Socket.IO scaling.
6. Point users to the single deployed site URL. No separate backend URL is needed.

## Feature Notes

### Messaging

- One-to-one direct chats
- Group chats
- Global Rooms
- Typing indicators
- Presence state
- Read receipts
- Offline draft queue and resend on reconnect
- Ephemeral message expiry timestamps
- **Emoji reactions** — react/un-react to any message with quick emoji picker (👍 ❤️ 😂 😮 😢 🔥)

### Calling

- One-to-one voice and video calls
- WebRTC signaling over backend sockets
- STUN/TURN support via `/api/config/realtime`

### AI

- Message translation after local decryption
- Smart reply suggestions from recent decrypted context
- Mock mode for development without an API key

### Files & Media

- Attachments bundled into the encrypted message payload
- **Media previews** — inline image thumbnails, native video player, audio player
- **File attachments** — PDFs and docs shown with download link
- Enhanced composer attachment strip with thumbnails and remove buttons
- Enter to send / Shift+Enter for new line

### Auth & Security

- RSA-OAEP + AES-GCM end-to-end encryption
- **Refresh tokens** — 30-day rotating tokens stored hashed in DB; silent auto-renewal on app startup
- `POST /api/auth/refresh` — consumes and rotates a refresh token
- `POST /api/auth/logout` — revokes all refresh tokens for the user

### Rate Limiting

- Auth routes: 20 req / 15 min (prevents brute-force)
- AI routes: 60 req / 15 min
- All other API routes: 300 req / 15 min

### PWA

- `manifest.json` — installable as a standalone app on Android, iOS, and desktop
- Service worker — caches the app shell for offline access; bypasses API and socket routes

## Database Migration

If you are upgrading an existing installation, run the SQL in [server/supabase/schema_additions.sql](/C:/Users/chans/Downloads/pulsebridge/server/supabase/schema_additions.sql) in your Supabase SQL editor **before** starting the updated server.

New installs only need the original `schema.sql`.

## Verification

The following checks were completed in this workspace:

- Server TypeScript build passed (0 errors)
- Client TypeScript build passed (0 errors)
- Client production bundle built successfully (410 kB JS, 15 kB CSS)

## Recommended Next Enhancements

- Move encrypted attachment blobs to object storage (S3/R2/Supabase Storage)
- Add service-worker-based push delivery with VAPID keys
- Add true multi-party WebRTC mesh or SFU integration for group calls
- Add moderation and rate limiting for public rooms (admin/ban/delete)
- Add PWA icons (icon-192.png, icon-512.png) to `client/public/` for full install experience


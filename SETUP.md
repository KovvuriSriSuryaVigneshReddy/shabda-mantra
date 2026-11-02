# ShabdaMantra: Setup Guide

This guide takes you from a fresh clone to a running ShabdaMantra app, and covers configuration, deployment, and troubleshooting.

## 1. Prerequisites

| Requirement | Version | Check with |
| --- | --- | --- |
| Node.js | 20.9 or newer (required by Next.js 16) | `node -v` |
| npm | Ships with Node.js | `npm -v` |
| Anthropic API key | — | [console.anthropic.com](https://console.anthropic.com) |
| Modern browser | Chrome, Edge, Safari, or Firefox | — |

Install Node.js from [nodejs.org](https://nodejs.org) if you don't have it.

## 2. Get the code

```bash
git clone <your-repository-url> shabda-mantra
cd shabda-mantra
```

If you already have the project folder, `cd` into it instead.

## 3. Check `package.json`

The project needs these entries in `package.json`. They should already be there; if you're creating the project from scratch, add them:

```json
{
  "name": "shabda-mantra",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "lucide-react": "^1.16.0",
    "next": "16.4.2",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@tailwindcss/turbopack": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.4.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

What each dependency does:

- **`next`**: the framework. The App Router serves `app/page.tsx` and `app/api/identify/route.ts`.
- **`react`, `react-dom`**: the UI library.
- **`@anthropic-ai/sdk`**: the official Anthropic client used by the API route.
- **`lucide-react`**: the icons (camera, upload, speaker, and so on).
- **`tailwindcss`, `@tailwindcss/turbopack`**: styling. Tailwind v4 is configured through `app/globals.css`.
- **`typescript`, `@types/*`**: type checking for `.ts` and `.tsx` files.

## 4. Install dependencies

```bash
npm install
```

This creates `node_modules/` and uses `package-lock.json` to pin exact versions. Commit the lockfile.

## 5. Create `.env.local`

Next.js reads `.env.local` automatically on startup. Create it in the project root, next to `package.json`:

```bash
touch .env.local
```

Add your API key:

```bash
# .env.local

# Option 1: Google Gemini Vision (Recommended - Free tier available)
# Get a key in 30 seconds at https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaSy...

# Option 2: Anthropic Claude (Requires paid billing credits)
# ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional fallback to local demo response if credits are exhausted
FALLBACK_TO_MOCK_ON_ERROR=true
```

Rules for this file:

- Set `GEMINI_API_KEY` for free Google Gemini 2.5 Flash vision.
- No quotes are needed around the value, and there must be no spaces around `=`.
- Never commit this file. The repo's `.gitignore` already excludes `.env*`.
- Environment variables are read at startup, so restart the dev server after editing the file.

## 6. Run the app

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

To try it:

1. Click **Upload image** and choose a photo, or click **Use camera** to capture one.
2. Optionally type a question, such as "What material is this made of?"
3. Click **Identify**.
4. When the results appear, click **Pronounce name** (English) or **नाम सुनें** (Hindi) to hear the name.

## 7. Production build

```bash
npm run build
npm run start
```

`npm run build` compiles and type-checks the app. `npm run start` serves the production build on port 3000. Run the build before starting. Set `ANTHROPIC_API_KEY` in the environment of the machine that runs `npm run start`.

## 8. Deploying

ShabdaMantra works on any host that runs Next.js, such as Vercel.

1. Push the repository to GitHub.
2. Import it into your hosting provider.
3. Add `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL` if you use it) in the project's environment variable settings. Don't put the key in the repository.
4. Deploy.

Camera access only works over HTTPS, so use an HTTPS host for remote access.

Before you make the app public, add authentication or rate limiting. Every identification makes a paid API call, and the app has no protections today.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "ANTHROPIC_API_KEY is not configured on the server." | `.env.local` is missing, misnamed, or the server wasn't restarted. | Check the file name and variable name, then restart `npm run dev`. |
| "Claude API error: 401 … invalid x-api-key" | The key is wrong, revoked, or has extra spaces or quotes. | Copy the key again into `.env.local` and restart. |
| "Claude API error: 404 … model" | The configured model isn't available to your account. | Set `ANTHROPIC_MODEL` to a model your account can access. |
| "Claude API error: 429 …" | Rate limit reached. | Wait and try again, or check your usage limits in the console. |
| "Unsupported image type" | The file isn't JPEG, PNG, WebP, or GIF. | Convert the image, such as HEIC to JPEG. |
| "Image is too large. The limit is 5 MB." | The file is bigger than 5 MB. | Resize or compress it. |
| Camera button shows "permission was denied" | The browser blocked camera access. | Allow camera access for `localhost` in the browser's site settings, then try again. |
| Camera button shows "Could not open a camera" | No camera is connected, or another app is using it. | Close other apps that use the camera, or use upload instead. |
| Speech buttons do nothing or sound wrong | The OS has no voice for that language. | Install a Hindi voice (see below), then reload. |
| `Route segment config "runtime" is not compatible` | A `runtime` export was added to the route. | Remove it. The Node.js runtime is the default. |
| Port 3000 is already in use | Another process is using the port. | Run `npm run dev -- -p 3001` or stop the other process. |

### Installing a Hindi voice

Speech is generated by your operating system, so install a Hindi voice if you hear silence or English-sounding speech:

- **macOS:** System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → Hindi.
- **Windows:** Settings → Time & language → Speech → Manage voices → Add voices → Hindi.
- **Android, iOS, ChromeOS:** install the Hindi text-to-speech voice in the system's speech settings.

Reload the page after installing a voice.

## 10. Verifying the API route directly

You can test the API without the UI. Use any small JPEG or PNG encoded as base64. This command sends a 1×1 PNG:

```bash
curl -X POST http://localhost:3000/api/identify \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==","prompt":"What is this?"}'
```

A successful response contains `englishName`, `hindiName`, `english`, and `hindi`. Each request makes one API call, so it uses a small amount of your quota.

Request fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `imageBase64` | string | Yes | Raw base64, or a full `data:image/...;base64,...` URL. |
| `mediaType` | string | If `imageBase64` is raw base64 | `image/jpeg`, `image/png`, `image/webp`, or `image/gif`. Ignored when a data URL is sent. |
| `prompt` | string | No | Up to 500 characters. Defaults to a general identification request. |

## 11. Next steps

- Run `npm run build` before each release to catch type errors.
- Keep `.env.local` out of version control, and rotate the key if it's ever exposed.
- Read [README.md](./README.md) for the architecture overview and feature list.

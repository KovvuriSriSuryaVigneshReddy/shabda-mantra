# ShabdaMantra

ShabdaMantra is a web app that identifies the main object in a photo and names it in **English and Hindi**. It reads the name aloud in both languages using your browser's built-in speech synthesis.

Take a photo with your device camera or upload an image. Claude's vision model describes what it sees, and the app shows the name and a short description in English and Hindi with buttons to hear each name.

## Features

- **Two ways to add an image:** upload a file (JPEG, PNG, WebP, or GIF, up to 5 MB) or capture a snapshot from a live camera preview.
- **Vision analysis:** Claude returns a short object name plus a detailed description, in English and Hindi (Devanagari).
- **Bilingual pronunciation:** the speech buttons read only the object name, in `en-US` for English and `hi-IN` for Hindi, using `window.speechSynthesis`.
- **Optional question:** ask something specific about the image, such as "What brand is this?"
- **Interactive UI:** a 3D starfield canvas that drifts with your mouse, behind a glassmorphic card with a dark cosmic theme.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js](https://nextjs.org) 16 (App Router) |
| UI | React 19, [Tailwind CSS](https://tailwindcss.com) v4 |
| Icons | [lucide-react](https://lucide.dev) |
| AI | [Anthropic SDK](https://www.npmjs.com/package/@anthropic-ai/sdk) (`@anthropic-ai/sdk`) |
| Speech | Browser `window.speechSynthesis` |

## Project structure

```
.
├── app/
│   ├── api/
│   │   └── identify/
│   │       └── route.ts   # Server route: validates the image, calls Claude, parses the reply
│   ├── layout.tsx         # Root layout and page metadata
│   ├── globals.css        # Tailwind import and base styles
│   └── page.tsx           # Client UI: starfield, camera/upload, results, speech
├── public/                # Static assets
├── package.json
├── tsconfig.json
└── SETUP.md               # Step-by-step installation and configuration
```

## How it works

1. The browser captures or reads the image and converts it to a data URL.
2. `app/page.tsx` sends it to `POST /api/identify` as JSON, with an optional question.
3. The route checks the media type, the base64 data, and the decoded size (5 MB limit). It then sends the image to Claude with a system prompt asking for JSON containing `englishName`, `hindiName`, `english`, and `hindi`.
4. The route parses Claude's reply. If the model doesn't return valid JSON, the whole reply is shown as the English description and the Hindi fields stay empty.
5. The page shows the names and descriptions. The speech buttons read only the names, using the matching language tag.

The Anthropic API key is read only on the server, in `app/api/identify/route.ts`. It never reaches the browser.

## Quick start

```bash
npm install
# create .env.local in the project root and set ANTHROPIC_API_KEY (see SETUP.md)
npm run dev
```

Open http://localhost:3000.

For full instructions, including prerequisites, `package.json` setup, and troubleshooting, see **[SETUP.md](./SETUP.md)**.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key. Keep it in `.env.local`. |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-5-5` | Claude model used for vision analysis. |

The default model is `claude-sonnet-5-5`. The originally requested `claude-3-5-sonnet-20241022` is no longer available from Anthropic, so set `ANTHROPIC_MODEL` only if you have access to a different model.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build (run `npm run build` first) |

## Limits and notes

- Images must be JPEG, PNG, WebP, or GIF and no larger than 5 MB.
- Camera access requires a secure context: `localhost` or HTTPS.
- Speech quality depends on the voices installed on your device. Hindi needs a Hindi voice (see [SETUP.md](./SETUP.md#troubleshooting)).
- Each identification makes one paid call to the Anthropic API.
- The app has no login, storage, or rate limiting. Don't deploy it publicly with your API key unless you add those protections.

## Security

- `.env.local` is gitignored (`.env*` in `.gitignore`). Never commit API keys.
- The API route validates the media type, base64 format, and size before calling Claude.
- Error messages from the API are shown to the user, so avoid putting secrets in them.

## License

Private project. Add a license here if you plan to share it.
# shabda-mantra

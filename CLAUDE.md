# obsidian-document-chat — CLAUDE.md

## Purpose

Obsidian desktop plugin that lets you chat with vault documents (markdown, PDF, images, code files) using Claude AI. Two modes:
- **In-Obsidian chat**: sends documents to the Claude API via an Anthropic API key.
- **Bridge to Claude.ai**: spins up a local HTTP server on port 27184, passes files (base64-encoded) to a companion Chrome extension that auto-attaches them to a new claude.ai conversation — no API key needed.

## Stack and languages

- **TypeScript** — plugin source (`main.ts`, `ChatView.ts`)
- **Obsidian API** — views, ribbon, commands, settings, vault access
- **Node.js built-ins** — `http` module for the bridge server (available in Obsidian desktop)
- **esbuild** — bundler, configured in `esbuild.config.mjs`
- **Chrome extension** — vanilla JS (`claude-bridge-extension/`)
- No React, no framework — plain DOM manipulation in `ChatView.ts`

## Folder structure

```
obsidian-document-chat/
├── main.ts                  # Plugin entry point, settings, bridge server, commands
├── ChatView.ts              # ItemView subclass — all UI logic for the chat panel
├── styles.css               # Panel styles
├── esbuild.config.mjs       # Build config (bundles to main.js)
├── manifest.json            # Obsidian plugin manifest (id: "document-chat")
├── package.json
├── tsconfig.json
├── main.js                  # Compiled output — committed for manual install
└── claude-bridge-extension/ # Companion Chrome extension
    ├── manifest.json
    ├── content.js           # Polls localhost:27184/files and attaches them on claude.ai
    ├── popup.html
    └── popup.js
```

## Build commands

```bash
npm install          # install devDependencies
npm run dev          # watch mode (esbuild, no type-check)
npm run build        # type-check + production bundle
```

The build output is `main.js` in the repo root. It is committed intentionally so users can install manually without a build step.

## Key architecture decisions

- Bridge server runs on `127.0.0.1:27184`. The plugin stores files in `pendingFiles[]` and clears them on the first `GET /files` request — the Chrome extension polls that endpoint immediately after `claude.ai/new` loads.
- The plugin is `isDesktopOnly: true` because it uses Node's `http` module and `Buffer`/`ArrayBuffer` APIs not available on mobile.
- Available models are hardcoded in `AVAILABLE_MODELS` in `main.ts`; update them there when new Claude models are released.
- `maxTokens` default is 4096; slider range is 1024–64000 in 1024 steps.

## Development workflow

1. Build with `npm run build`.
2. Copy `main.js`, `manifest.json`, `styles.css` into `.obsidian/plugins/document-chat/` in your vault.
3. In Obsidian: disable → re-enable the plugin to reload.
4. For the Chrome extension: load `claude-bridge-extension/` as an unpacked extension in `chrome://extensions`.

## Conventions

- No framework, no JSX — use the Obsidian API (`createEl`, `createDiv`, etc.) for DOM.
- Keep `main.ts` thin (plugin lifecycle, settings, commands). Put all UI in `ChatView.ts`.
- `main.js` is committed; run `npm run build` before every commit that changes TypeScript.
- Do not commit `.env` files or API keys (`.gitignore` already covers `.env`).

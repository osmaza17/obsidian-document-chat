# Document Chat — Obsidian Plugin

Chat with your vault documents using Claude AI. Load notes, PDFs and images into a chat panel inside Obsidian, or send them directly to [claude.ai](https://claude.ai) as attachments with one click — using your existing Claude subscription instead of API tokens.

---

## What this plugin does

- **In-Obsidian chat**: Load files from your vault and ask questions about them via the Anthropic API (requires an API key).
- **Send to Claude.ai**: Send all documents loaded in the panel to claude.ai as file attachments with a single button click, using your Claude subscription.
- **Multiple file types**: Markdown notes, plain text, PDFs, images, and most code files.
- **@-mention**: Type `@` in the chat box to search and load any note in your vault.
- **Drag & drop**: Drag files from the Obsidian file explorer directly into the panel.

---

## Requirements

- [Obsidian](https://obsidian.md/) desktop (Windows or macOS — the plugin uses Node.js APIs, mobile is not supported)
- [Node.js](https://nodejs.org/) — required only if you want to build from source
- [Google Chrome](https://www.google.com/chrome/) — required for the "Send to Claude.ai" feature
- A [Claude subscription](https://claude.ai) (for the claude.ai bridge) and/or an [Anthropic API key](https://console.anthropic.com) (for in-Obsidian chat)

---

## Installation

### Part 1 — Obsidian Plugin

There are two ways to install the plugin:

#### Option A — Manual install (recommended, no build needed)

1. Download this repository as a ZIP from GitHub:
   **[https://github.com/osmaza17/obsidian-document-chat/archive/refs/heads/master.zip](https://github.com/osmaza17/obsidian-document-chat/archive/refs/heads/master.zip)**

2. Extract the ZIP. You need three files from the root of the extracted folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`

3. Create a folder for the plugin inside your vault:
   ```
   <your-vault>/.obsidian/plugins/document-chat/
   ```

4. Copy the three files into that folder.

5. Open Obsidian → **Settings → Community plugins** → toggle on **Document Chat**.

#### Option B — Build from source

1. Make sure [Node.js](https://nodejs.org/) is installed. Verify with:
   ```bash
   node --version
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/osmaza17/obsidian-document-chat.git
   cd obsidian-document-chat
   ```

3. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

4. Copy `main.js`, `manifest.json` and `styles.css` into your vault's plugin folder:
   ```
   <your-vault>/.obsidian/plugins/document-chat/
   ```

5. Enable the plugin in Obsidian → **Settings → Community plugins**.

---

### Part 2 — Chrome Extension (required for "Send to Claude.ai")

The Chrome extension acts as a bridge between Obsidian and claude.ai. When you click **"↗ Open in Claude.ai"** in the plugin panel, the extension automatically attaches your loaded documents to a new claude.ai conversation.

#### Install steps

1. Download or clone this repository if you haven't already (see Part 1 above).

2. Open Chrome and go to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (toggle in the top-right corner).

4. Click **"Load unpacked"** and select the `claude-bridge-extension` folder from this repository.

5. The extension icon will appear in your Chrome toolbar. No further configuration is needed.

#### How it works

When you click **"↗ Open in Claude.ai"** in the Obsidian panel:

1. The plugin stores the loaded documents in memory via a local HTTP server running on `localhost:27184`.
2. Chrome opens `claude.ai/new` automatically.
3. The extension's content script reads the files from the local server and attaches them to claude.ai's file input — exactly as if you had dragged the files in manually.
4. Your files appear as attachments, ready for you to type your question and send.

> **Note:** The local server only accepts connections from `127.0.0.1` and clears file data immediately after the extension reads it. No data is ever sent to any external server by the bridge.

---

## Plugin setup

### API Key (for in-Obsidian chat)

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an API key.
2. In Obsidian, open **Settings → Document Chat** and paste your key.

You can skip this if you only plan to use the claude.ai bridge.

### Choosing a model

Use the dropdown in the plugin panel header to switch between available Claude models. The model only affects in-Obsidian chat — claude.ai uses whatever model you have configured there.

---

## Usage

### In-Obsidian chat

1. Open the **Document Chat** panel from the left ribbon (💬 icon) or via **Ctrl+P → Open Document Chat panel**.
2. Load documents using any of these methods:
   - Click **＋ Load active file** to load the currently open note.
   - Type `@notename` in the chat box to search and load any vault file.
   - Drag a file from the Obsidian file explorer onto the panel.
3. Type your question and press **Enter** (or **Shift+Enter** for a new line).

### Send to Claude.ai

1. Load one or more documents into the panel (step 2 above).
2. Click **↗ Open in Claude.ai**.
3. Chrome opens a new claude.ai conversation with your files already attached.
4. Type your question and send.

If no documents are loaded in the panel, the button sends the currently active file instead.

You can also trigger this from anywhere via **Ctrl+P → Send active note to Claude (Bridge)**.

### Bridge status indicator

The small dot in the panel header shows whether the local bridge server is running:
- 🟢 **Green** — bridge active, the Chrome extension can connect.
- ⚫ **Grey** — bridge inactive. Try reloading the plugin (disable and re-enable in Settings → Community plugins).

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Send message | Enter |
| New line in input | Shift+Enter |
| Mention a note | @ |
| Navigate mention list | ↑ / ↓ |
| Select mention | Enter or Tab |
| Dismiss mention popup | Escape |
| Stop generation | Click "■ Stop" |

---

## Supported file types

| Category | Extensions |
|---|---|
| Notes | `.md`, `.txt`, `.markdown`, `.org` |
| Code | `.js`, `.ts`, `.py`, `.rb`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.cs`, `.swift`, `.kt` and more |
| Data | `.json`, `.yaml`, `.toml`, `.xml`, `.csv` |
| Web | `.html`, `.css`, `.scss` |
| PDFs | `.pdf` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |

---

## Troubleshooting

**The bridge status dot is grey**
Disable and re-enable the plugin in **Settings → Community plugins**. If port `27184` is already in use by another application, the server cannot start.

**Files are not being attached in claude.ai**
Claude.ai may have updated their interface. Check that the extension is enabled in `chrome://extensions` and that you are on a `claude.ai` page when the files are sent. If the problem persists, open an issue on this repository.

**"No API key set" error in the chat panel**
Go to **Settings → Document Chat** and enter your Anthropic API key from [console.anthropic.com](https://console.anthropic.com).

---

## License

MIT

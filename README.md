# Document Chat — Obsidian Plugin

Chat with your vault documents using Claude AI. Load notes, PDFs and images into a chat panel inside Obsidian, or send them directly to [claude.ai](https://claude.ai) as attachments with one click — using your existing Claude subscription instead of API tokens.

---

## What this plugin does

- **In-Obsidian chat**: Load files from your vault and ask Claude questions about them (requires an Anthropic API key).
- **Send to Claude.ai**: Send your loaded documents to claude.ai as file attachments with one click, using your Claude subscription — no API key needed.
- **Supported file types**: Markdown notes, plain text, PDFs, images, and most code files.
- **@-mention**: Type `@` in the chat box to search and load any note from your vault.
- **Drag & drop**: Drag files from the Obsidian file explorer directly into the panel.

> **Platform note:** This plugin uses Node.js features that are only available on the Obsidian desktop app (Windows and macOS). It does not work on mobile.

---

## What you need before starting

- [Obsidian](https://obsidian.md/) installed on your computer (desktop version)
- [Google Chrome](https://www.google.com/chrome/) — only needed for the "Send to Claude.ai" feature
- A [Claude subscription](https://claude.ai) (for the Claude.ai bridge) and/or an [Anthropic API key](https://console.anthropic.com) (for the in-Obsidian chat)

---

## Installation

The installation has two parts: the **Obsidian plugin** and the **Chrome extension**. You need both if you want to use the "Send to Claude.ai" feature. If you only want in-Obsidian chat, you only need Part 1.

---

### Part 1 — Obsidian Plugin

#### Step 1 — Download the plugin files

Go to this address in your browser and download the ZIP file:

**[https://github.com/osmaza17/obsidian-document-chat/archive/refs/heads/master.zip](https://github.com/osmaza17/obsidian-document-chat/archive/refs/heads/master.zip)**

Once downloaded, extract the ZIP. You will get a folder called `obsidian-document-chat-master` with several files inside. **You only need three of them:**

- `main.js`
- `manifest.json`
- `styles.css`

You can ignore everything else.

#### Step 2 — Create the plugin folder in your vault

Obsidian stores plugins in a hidden folder called `.obsidian` inside your vault. You need to create a subfolder for this plugin.

1. Open your vault folder in Windows Explorer (it's the folder you chose when you created your vault in Obsidian).
2. Make hidden folders visible: in Windows Explorer, click **View → Show → Hidden items**.
3. Open the `.obsidian` folder, then open the `plugins` folder inside it. If the `plugins` folder does not exist, create it.
4. Inside `plugins`, create a new folder called exactly `document-chat`.

Your folder structure should look like this:
```
Your Vault/
└── .obsidian/
    └── plugins/
        └── document-chat/       ← create this
```

#### Step 3 — Copy the files

Copy the three files you extracted earlier (`main.js`, `manifest.json`, `styles.css`) into the `document-chat` folder you just created.

#### Step 4 — Enable the plugin in Obsidian

1. Open Obsidian.
2. Go to **Settings** (gear icon at the bottom left).
3. Click **Community plugins** in the left sidebar.
4. If it says "Restricted mode is on", click **Turn on community plugins**.
5. Find **Document Chat** in the list and toggle it on.

The plugin icon (💬) will appear in the left ribbon of Obsidian.

---

### Part 2 — Chrome Extension

The Chrome extension is needed to send your documents from Obsidian to claude.ai automatically. Without it, clicking "↗ Open in Claude.ai" will open claude.ai but the files won't be attached.

#### Step 1 — Get the extension files

You already downloaded and extracted the ZIP in Part 1. Inside the extracted folder, find the subfolder called `claude-bridge-extension`. You will need this entire folder.

#### Step 2 — Install the extension in Chrome

1. Open Google Chrome.
2. Type `chrome://extensions` in the address bar and press Enter.
3. In the top-right corner, enable **Developer mode** (toggle switch).
4. Click the **"Load unpacked"** button that appears.
5. In the file picker, navigate to the `claude-bridge-extension` folder and select it.
6. The extension will appear in Chrome with the name "Obsidian → Claude Bridge".

You do not need to configure anything else. The extension works automatically in the background whenever you are on claude.ai.

---

## Setup

### API Key — for in-Obsidian chat

If you want to chat with documents directly inside Obsidian (without switching to the browser), you need an Anthropic API key:

1. Go to [console.anthropic.com](https://console.anthropic.com), create an account and generate an API key.
2. In Obsidian, go to **Settings → Community plugins → Document Chat → Settings** (gear icon next to the plugin).
3. Paste your API key in the "Anthropic API Key" field.

You can skip this entirely if you only plan to use the "Send to Claude.ai" button.

---

## How to use it

### Loading documents

Open the Document Chat panel by clicking the 💬 icon in the left ribbon, or via **Ctrl+P → Open Document Chat panel**.

You can load documents in three ways:
- **Click "＋ Load active file"** — loads the note you currently have open.
- **Type `@` in the chat box** — a search popup appears, type to find any file in your vault and press Enter to load it.
- **Drag a file** from the Obsidian file explorer and drop it onto the panel.

Loaded files appear as chips at the top of the panel. You can remove them individually or click "Remove all".

### Chatting inside Obsidian

Once you have loaded at least one document, type your question in the text box and press **Enter** to send. Press **Shift+Enter** for a new line.

Claude will respond based on the content of your loaded documents. You can keep asking follow-up questions in the same conversation.

### Sending documents to Claude.ai

1. Load the documents you want (as described above).
2. Click **"↗ Open in Claude.ai"**.
3. Chrome opens `claude.ai/new` and the extension automatically attaches your files.
4. Type your question in Claude.ai and send.

If you have no documents loaded, the button sends the file you currently have open in Obsidian instead.

You can also trigger this with the command **Ctrl+P → Send active note to Claude (Bridge)**, which always sends the currently open file.

### Bridge status indicator

The small dot in the top-right of the plugin panel tells you whether the bridge is working:

- **Green dot** — the bridge is active and the Chrome extension can receive files.
- **Grey dot** — the bridge is not running. Fix: go to **Settings → Community plugins**, disable Document Chat and enable it again.

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Send message | Enter |
| New line in input | Shift+Enter |
| Open @-mention search | @ |
| Navigate mention list | ↑ / ↓ |
| Select a mention | Enter or Tab |
| Close mention popup | Escape |
| Stop a response | Click "■ Stop" |

---

## Supported file types

| Type | Extensions |
|---|---|
| Notes | `.md` `.txt` `.markdown` `.org` |
| Code | `.js` `.ts` `.py` `.rb` `.java` `.go` `.rs` `.cpp` `.c` `.cs` `.swift` `.kt` and more |
| Data | `.json` `.yaml` `.toml` `.xml` `.csv` |
| Web | `.html` `.css` `.scss` |
| PDF | `.pdf` |
| Images | `.png` `.jpg` `.jpeg` `.gif` `.webp` |

---

## Troubleshooting

**The plugin does not appear in the Community plugins list**
Make sure you placed the three files (`main.js`, `manifest.json`, `styles.css`) directly inside `.obsidian/plugins/document-chat/` and that the folder is named exactly `document-chat`.

**The bridge status dot is grey**
Disable and re-enable the plugin in **Settings → Community plugins**. If it remains grey, port `27184` may be in use by another application — try restarting your computer.

**Files are not being attached in Claude.ai**
Make sure the Chrome extension is enabled in `chrome://extensions`. If it is enabled but files are still not attaching, Claude.ai may have updated their interface in a way that breaks the extension — open an issue on this repository and we will look into it.

**"No API key set" error in the chat panel**
Go to **Settings → Community plugins → Document Chat settings** and enter your Anthropic API key from [console.anthropic.com](https://console.anthropic.com).

---

## For developers — building from source

If you want to modify the plugin code:

1. Install [Node.js](https://nodejs.org/) (LTS version recommended).
2. Clone the repository:
   ```bash
   git clone https://github.com/osmaza17/obsidian-document-chat.git
   cd obsidian-document-chat
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build:
   ```bash
   npm run build
   ```
5. Copy the resulting `main.js`, `manifest.json` and `styles.css` into your vault's plugin folder.

---

## License

MIT

import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { createServer, Server } from "http";
import { ChatView, CHAT_VIEW_TYPE } from "./ChatView";

export interface DocumentChatSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
}

export const AVAILABLE_MODELS: { value: string; label: string }[] = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

export const DEFAULT_SETTINGS: DocumentChatSettings = {
  apiKey: "",
  model: "claude-sonnet-4-6",
  maxTokens: 4096,
  systemPrompt:
    "You are a helpful assistant that answers questions about the provided document(s). Be concise but thorough. Use markdown formatting when appropriate.",
};

const BRIDGE_PORT = 27184;

export interface BridgeFile {
  name: string;
  mimeType: string;
  data: string; // base64
}

export default class DocumentChatPlugin extends Plugin {
  settings: DocumentChatSettings;
  bridgeRunning = false;
  private bridgeServer: Server | null = null;
  private pendingFiles: BridgeFile[] = [];

  async onload() {
    await this.loadSettings();
    this.startBridgeServer();
    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));
    this.addRibbonIcon("message-circle", "Document Chat", () => this.activateChatView());

    this.addCommand({
      id: "push-note-to-claude",
      name: "Send active note to Claude (Bridge)",
      callback: () => this.pushActiveNoteToClaude(),
    });

    this.addCommand({
      id: "open-document-chat",
      name: "Open Document Chat panel",
      callback: () => this.activateChatView(),
    });

    this.addCommand({
      id: "add-active-document",
      name: "Add active document to chat",
      callback: async () => {
        await this.activateChatView();
        setTimeout(() => {
          const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
          if (leaves.length > 0) (leaves[0].view as ChatView).loadActiveDocument();
        }, 100);
      },
    });

    this.addSettingTab(new DocumentChatSettingTab(this.app, this));
  }

  async activateChatView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
        leaf = rightLeaf;
      }
    }
    if (leaf) workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Called by the command (sends just the active file)
  async pushActiveNoteToClaude() {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice("No active file open."); return; }

    const ext = file.extension.toLowerCase();
    const IMAGE_MIME: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    };
    let mimeType: string;
    let data: string;

    if (ext === "pdf" || IMAGE_MIME[ext]) {
      mimeType = IMAGE_MIME[ext] ?? "application/pdf";
      const buffer = await this.app.vault.readBinary(file);
      data = arrayBufferToBase64(buffer);
    } else {
      mimeType = ext === "md" ? "text/markdown" : "text/plain";
      const text = await this.app.vault.read(file);
      data = textToBase64(text);
    }

    this.pushFilesToClaude([{ name: file.name, mimeType, data }]);
  }

  // Called by the ChatView button (sends all loaded documents)
  pushFilesToClaude(files: BridgeFile[]) {
    this.pendingFiles = files;
    window.open("https://claude.ai/new");
  }

  private startBridgeServer() {
    this.bridgeServer = createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      if (req.method === "GET" && req.url === "/files") {
        const payload = JSON.stringify({ files: this.pendingFiles, available: this.pendingFiles.length > 0 });
        this.pendingFiles = [];
        res.writeHead(200);
        res.end(payload);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.bridgeServer.listen(BRIDGE_PORT, "127.0.0.1", () => {
      this.bridgeRunning = true;
    });

    this.bridgeServer.on("error", (err: NodeJS.ErrnoException) => {
      this.bridgeRunning = false;
      if (err.code === "EADDRINUSE") {
        console.warn(`[Document Chat] Port ${BRIDGE_PORT} already in use — bridge server not started.`);
      }
    });
  }

  onunload() {
    this.bridgeServer?.close();
    this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

class DocumentChatSettingTab extends PluginSettingTab {
  plugin: DocumentChatPlugin;

  constructor(app: App, plugin: DocumentChatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Document Chat — Settings" });

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Your API key from console.anthropic.com.")
      .addText((text) => {
        text
          .setPlaceholder("sk-ant-api03-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .setName("Max response tokens")
      .setDesc("Maximum length of Claude's responses. 1k–64k in 1k steps.")
      .addSlider((slider) =>
        slider
          .setLimits(1024, 64000, 1024)
          .setValue(this.plugin.settings.maxTokens)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxTokens = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("System prompt")
      .setDesc("Instructions for Claude's behaviour.")
      .addTextArea((ta) => {
        ta.setValue(this.plugin.settings.systemPrompt).onChange(async (value) => {
          this.plugin.settings.systemPrompt = value;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 4;
        ta.inputEl.style.width = "100%";
      });

    containerEl.createEl("p", {
      text: "💡 Tip: change the model directly from the chat panel header.",
      cls: "setting-item-description",
    });
  }
}

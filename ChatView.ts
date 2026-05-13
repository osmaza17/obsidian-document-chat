import { FuzzySuggestModal, ItemView, MarkdownRenderer, Notice, setIcon, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import type DocumentChatPlugin from "./main";
import { AVAILABLE_MODELS } from "./main";
import type { BridgeFile } from "./main";

export const CHAT_VIEW_TYPE = "document-chat-view";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiContentBlock {
  type: "text" | "document" | "image";
  text?: string;
  source?: { type: "base64"; media_type: string; data: string };
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string | ApiContentBlock[];
}

interface LoadedDocument {
  id: string;
  filePath: string;
  fileName: string;
  fileType: "text" | "pdf" | "image";
  contentBlock: ApiContentBlock;
  estimatedTokens: number;
}

interface ChatTurn {
  userText: string;
  assistantText: string;
}

// ─── File type helpers ─────────────────────────────────────────────────────────

const TEXT_EXTS = new Set([
  "md","txt","markdown","org",
  "js","ts","jsx","tsx","mjs","cjs",
  "py","rb","php","java","kt","swift","go","rs","cpp","c","h","cs",
  "json","yaml","yml","toml","xml","csv","html","css","scss","sass",
  "sh","bash","zsh","fish","ps1","bat","cmd",
  "sql","graphql","env","ini","cfg","conf",
  "r","m","jl","lua","vim","el",
]);

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const PDF_EXTS = new Set(["pdf"]);

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp",
};

// ─── ChatView ─────────────────────────────────────────────────────────────────

export class ChatView extends ItemView {
  private plugin: DocumentChatPlugin;
  private documents: LoadedDocument[] = [];
  private turns: ChatTurn[] = [];
  private isLoading = false;
  private abortController: AbortController | null = null;

  // DOM refs
  private rootEl: HTMLElement;
  private messagesEl: HTMLElement;
  private chipsEl: HTMLElement;
  private sourcesHeaderEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private loadBtn: HTMLButtonElement;
  private inputAreaEl: HTMLElement;
  private bridgeIndicatorEl: HTMLElement;
  private bridgeStatusInterval: number | null = null;

  // Model dropdown
  private modelDropdownOpen = false;
  private modelTriggerEl: HTMLElement;
  private modelMenuEl: HTMLElement;
  private modelOutsideHandler: ((e: MouseEvent) => void) | null = null;

  // @-mention state
  private mentionPopup: HTMLElement | null = null;
  private mentionStartPos: number = -1;
  private mentionResults: TFile[] = [];
  private mentionSelectedIdx: number = 0;
  private mentionOutsideHandler: ((e: MouseEvent) => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DocumentChatPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return CHAT_VIEW_TYPE; }
  getDisplayText() { return "Document Chat"; }
  getIcon() { return "message-circle"; }

  // ── UI build ──────────────────────────────────────────────────────────────

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("dc-root");
    this.rootEl = root;

    // Header with title + custom model dropdown
    const header = root.createDiv("dc-header");
    header.createDiv("dc-header-title").setText("Document Chat");
    this.buildModelDropdown(header);

    this.bridgeIndicatorEl = header.createDiv("dc-bridge-indicator");
    this.updateBridgeIndicator();
    this.bridgeStatusInterval = window.setInterval(() => this.updateBridgeIndicator(), 3000);

    const settingsBtn = header.createEl("button", { cls: "dc-settings-btn" });
    settingsBtn.setAttribute("aria-label", "Open plugin settings");
    settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    settingsBtn.onclick = () => {
      // Open Obsidian settings navigated to this plugin's tab
      (this.app as any).setting?.open();
      (this.app as any).setting?.openTabById("document-chat");
    };

    // Sources area
    const sourcesArea = root.createDiv("dc-sources");
    this.sourcesHeaderEl = sourcesArea.createDiv("dc-sources-header");
    this.chipsEl = sourcesArea.createDiv("dc-chips");

    // Controls
    const controls = root.createDiv("dc-controls");
    const btnRow = controls.createDiv("dc-btn-row");

    this.loadBtn = btnRow.createEl("button", { cls: "dc-btn dc-btn-primary dc-btn-icon" });
    setIcon(this.loadBtn, "file-plus");
    this.loadBtn.setAttribute("aria-label", "Load active file");
    this.loadBtn.onclick = () => this.loadActiveDocument();

    const folderBtn = btnRow.createEl("button", { cls: "dc-btn dc-btn-ghost dc-btn-icon" });
    setIcon(folderBtn, "folder-open");
    folderBtn.setAttribute("aria-label", "Load folder");
    folderBtn.onclick = () => new FolderPickerModal(this.app, (folder) => this.loadFolder(folder)).open();

    const bridgeBtn = btnRow.createEl("button", { cls: "dc-btn dc-btn-ghost dc-btn-icon dc-btn-bridge" });
    setIcon(bridgeBtn, "external-link");
    bridgeBtn.setAttribute("aria-label", "Open in Claude.ai");
    bridgeBtn.onclick = () => {
      if (this.documents.length === 0) {
        this.plugin.pushActiveNoteToClaude();
        return;
      }
      this.plugin.pushFilesToClaude(this.buildBridgeFiles());
    };

    const clearBtn = btnRow.createEl("button", { cls: "dc-btn dc-btn-ghost dc-btn-icon" });
    setIcon(clearBtn, "trash-2");
    clearBtn.setAttribute("aria-label", "Clear chat");
    clearBtn.onclick = () => this.clearChat();

    // Messages
    this.messagesEl = root.createDiv("dc-messages");
    this.renderWelcome();

    // Input
    this.inputAreaEl = root.createDiv("dc-input-area");
    this.inputEl = this.inputAreaEl.createEl("textarea", { cls: "dc-textarea" });
    this.inputEl.placeholder = "Ask something… (@ to mention a note)";
    this.inputEl.rows = 3;
    this.inputEl.addEventListener("keydown", (e) => this.handleInputKeydown(e));
    this.inputEl.addEventListener("input", () => this.handleMentionInput());

    const inputFooter = this.inputAreaEl.createDiv("dc-input-footer");
    inputFooter.createSpan("dc-hint").setText("Shift+Enter for newline · @ to mention");
    this.sendBtn = inputFooter.createEl("button", { cls: "dc-btn dc-btn-send" });
    this.sendBtn.setText("Send ↵");
    this.sendBtn.onclick = () => this.handleSend();

    this.renderSources();
    this.setupDragAndDrop();
  }

  // ── Model dropdown (custom, fully styled) ─────────────────────────────────

  private buildModelDropdown(parent: HTMLElement) {
    const wrapper = parent.createDiv("dc-model-wrapper");

    this.modelTriggerEl = wrapper.createDiv("dc-model-trigger");
    this.modelTriggerEl.createSpan("dc-model-label").setText(this.currentModelLabel());
    this.modelTriggerEl.createSpan("dc-model-arrow").setText("▾");

    this.modelMenuEl = wrapper.createDiv("dc-model-menu");

    this.renderModelMenu();

    this.modelTriggerEl.onclick = (e) => {
      e.stopPropagation();
      this.toggleModelDropdown();
    };

    this.modelOutsideHandler = () => {
      if (this.modelDropdownOpen) this.closeModelDropdown();
    };
    document.addEventListener("click", this.modelOutsideHandler);
  }

  private renderModelMenu() {
    this.modelMenuEl.empty();
    for (const m of AVAILABLE_MODELS) {
      const item = this.modelMenuEl.createDiv("dc-model-item");
      item.setText(m.label);
      if (m.value === this.plugin.settings.model) item.addClass("dc-model-item-active");
      item.onclick = async (e) => {
        e.stopPropagation();
        this.plugin.settings.model = m.value;
        await this.plugin.saveSettings();
        // Update trigger label
        const labelEl = this.modelTriggerEl.querySelector(".dc-model-label");
        if (labelEl) labelEl.textContent = this.currentModelLabel();
        this.renderModelMenu();
        this.closeModelDropdown();
      };
    }
  }

  private toggleModelDropdown() {
    this.modelDropdownOpen ? this.closeModelDropdown() : this.openModelDropdown();
  }

  private openModelDropdown() {
    this.modelDropdownOpen = true;
    this.modelMenuEl.addClass("dc-model-menu-open");
    this.modelTriggerEl.addClass("dc-model-trigger-open");
  }

  private closeModelDropdown() {
    this.modelDropdownOpen = false;
    this.modelMenuEl.removeClass("dc-model-menu-open");
    this.modelTriggerEl.removeClass("dc-model-trigger-open");
  }

  private currentModelLabel(): string {
    return AVAILABLE_MODELS.find((m) => m.value === this.plugin.settings.model)?.label
      ?? this.plugin.settings.model;
  }

  // ── Load document ─────────────────────────────────────────────────────────

  public openFolderPicker() {
    new FolderPickerModal(this.app, (folder) => this.loadFolder(folder)).open();
  }

  public async loadActiveDocument() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) { this.pushError("No active file. Open a file first."); return; }
    await this.loadDocument(activeFile);
  }

  public async loadDocument(file: TFile) {
    if (this.documents.find((d) => d.filePath === file.path)) {
      this.pushSystemMsg(`⚠️ **${file.name}** is already loaded.`);
      return;
    }

    this.loadBtn.disabled = true;

    try {
      const ext = file.extension.toLowerCase();
      let doc: LoadedDocument;

      if (TEXT_EXTS.has(ext) || (!PDF_EXTS.has(ext) && !IMAGE_EXTS.has(ext))) {
        const text = await this.app.vault.read(file);
        doc = {
          id: generateId(), filePath: file.path, fileName: file.name, fileType: "text",
          contentBlock: { type: "text", text: `<document filename="${file.name}">\n${text}\n</document>` },
          estimatedTokens: Math.ceil(text.length / 4),
        };
      } else if (PDF_EXTS.has(ext)) {
        const buffer = await this.app.vault.readBinary(file);
        const b64 = arrayBufferToBase64(buffer);
        doc = {
          id: generateId(), filePath: file.path, fileName: file.name, fileType: "pdf",
          contentBlock: { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          estimatedTokens: Math.ceil(buffer.byteLength / 30),
        };
      } else {
        const buffer = await this.app.vault.readBinary(file);
        const b64 = arrayBufferToBase64(buffer);
        const mime = IMAGE_MIME[ext] ?? "image/png";
        doc = {
          id: generateId(), filePath: file.path, fileName: file.name, fileType: "image",
          contentBlock: { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          estimatedTokens: 1500,
        };
      }

      this.documents.push(doc);
      if (this.documents.length === 1 && this.turns.length === 0) this.messagesEl.empty();
      this.pushSystemMsg(`📎 Added **${file.name}** to context.`);
      this.renderSources();
    } catch (err) {
      this.pushError(`Failed to load file: ${(err as Error).message}`);
    } finally {
      this.loadBtn.disabled = false;
      this.inputEl.focus();
    }
  }

  async loadFolder(folder: TFolder) {
    const SUPPORTED = new Set([
      ...Array.from(TEXT_EXTS), ...Array.from(IMAGE_EXTS), ...Array.from(PDF_EXTS),
    ]);
    const MAX_FILES = 20;

    const files: TFile[] = [];
    const collect = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile && SUPPORTED.has(child.extension.toLowerCase())) files.push(child);
        else if (child instanceof TFolder) collect(child);
      }
    };
    collect(folder);

    if (files.length === 0) {
      new Notice(`No supported files found in "${folder.name}".`);
      return;
    }
    if (files.length > MAX_FILES) {
      new Notice(`"${folder.name}" has ${files.length} files — loading the first ${MAX_FILES}.`);
      files.splice(MAX_FILES);
    }

    this.loadBtn.disabled = true;
    let loaded = 0;
    for (const file of files) {
      await this.loadDocument(file);
      loaded++;
    }
    this.loadBtn.disabled = false;
    new Notice(`Loaded ${loaded} file(s) from "${folder.name}".`);
  }

  private removeDocument(id: string) {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return;
    this.documents = this.documents.filter((d) => d.id !== id);
    this.pushSystemMsg(`🗑 Removed **${doc.fileName}** from context.`);
    this.renderSources();
    if (this.documents.length === 0 && this.turns.length === 0) this.renderWelcome();
  }

  // ── Input handling ────────────────────────────────────────────────────────

  private handleInputKeydown(e: KeyboardEvent) {
    if (this.mentionPopup) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.mentionSelectedIdx = (this.mentionSelectedIdx + 1) % Math.max(this.mentionResults.length, 1);
        this.renderMentionItems(); return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.mentionSelectedIdx = (this.mentionSelectedIdx - 1 + this.mentionResults.length) % Math.max(this.mentionResults.length, 1);
        this.renderMentionItems(); return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && this.mentionResults.length > 0) {
        e.preventDefault(); this.selectMention(this.mentionResults[this.mentionSelectedIdx]); return;
      }
      if (e.key === "Escape") { e.preventDefault(); this.hideMentionPopup(); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
  }

  private handleMentionInput() {
    const value = this.inputEl.value;
    const cursorPos = this.inputEl.selectionStart ?? value.length;
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const ch = value[i];
      if (ch === "@") { atPos = i; break; }
      if (ch === " " || ch === "\n" || ch === "\t") break;
    }
    if (atPos === -1 || (atPos > 0 && !/\s/.test(value[atPos - 1]))) {
      this.hideMentionPopup(); return;
    }
    this.mentionStartPos = atPos;
    const query = value.slice(atPos + 1, cursorPos).toLowerCase();
    this.mentionResults = this.app.vault.getFiles()
      .map((f) => ({ file: f, score: scoreFile(f, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.file);
    this.mentionSelectedIdx = 0;
    this.showMentionPopup();
  }

  private showMentionPopup() {
    if (!this.mentionPopup) {
      this.mentionPopup = this.inputAreaEl.createDiv("dc-mention-popup");
      this.mentionOutsideHandler = (e: MouseEvent) => {
        if (this.mentionPopup && !this.mentionPopup.contains(e.target as Node) && e.target !== this.inputEl)
          this.hideMentionPopup();
      };
      document.addEventListener("mousedown", this.mentionOutsideHandler);
    }
    this.renderMentionItems();
  }

  private renderMentionItems() {
    if (!this.mentionPopup) return;
    this.mentionPopup.empty();
    if (this.mentionResults.length === 0) {
      this.mentionPopup.createDiv("dc-mention-empty").setText("No matches"); return;
    }
    this.mentionResults.forEach((file, idx) => {
      const item = this.mentionPopup!.createDiv("dc-mention-item");
      if (idx === this.mentionSelectedIdx) item.addClass("dc-mention-selected");
      item.createSpan("dc-mention-icon").setText(getFileIcon(file));
      const main = item.createDiv("dc-mention-main");
      main.createDiv("dc-mention-name").setText(file.basename);
      main.createDiv("dc-mention-path").setText(file.path);
      item.onmousedown = (e) => { e.preventDefault(); this.selectMention(file); };
    });
  }

  private async selectMention(file: TFile) {
    const value = this.inputEl.value;
    const cursorPos = this.inputEl.selectionStart ?? value.length;
    const before = value.slice(0, this.mentionStartPos);
    const after = value.slice(cursorPos);
    this.inputEl.value = before + after;
    this.inputEl.setSelectionRange(before.length, before.length);
    this.hideMentionPopup();
    await this.loadDocument(file);
    this.inputEl.focus();
  }

  private hideMentionPopup() {
    this.mentionPopup?.remove();
    this.mentionPopup = null;
    if (this.mentionOutsideHandler) {
      document.removeEventListener("mousedown", this.mentionOutsideHandler);
      this.mentionOutsideHandler = null;
    }
    this.mentionResults = [];
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  private setupDragAndDrop() {
    this.rootEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.rootEl.addClass("dc-drag-over");
    });
    this.rootEl.addEventListener("dragleave", (e) => {
      if (e.target === this.rootEl) this.rootEl.removeClass("dc-drag-over");
    });
    this.rootEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.rootEl.removeClass("dc-drag-over");
      let path = (e.dataTransfer?.getData("text/plain") || "").trim();
      if (!path) return;
      if (path.startsWith("[[") && path.endsWith("]]")) path = path.slice(2, -2);
      const pipeIdx = path.indexOf("|");
      if (pipeIdx !== -1) path = path.slice(0, pipeIdx);
      const direct = this.app.vault.getAbstractFileByPath(path);
      const file = direct instanceof TFile ? direct
        : this.app.metadataCache.getFirstLinkpathDest(path, "");
      if (file instanceof TFile) this.loadDocument(file);
      else this.pushError(`Could not find a file matching "${path}".`);
    });
  }

  // ── Send message ──────────────────────────────────────────────────────────

  private async handleSend() {
    if (this.isLoading) return;
    const text = this.inputEl.value.trim();
    if (!text) return;
    if (!this.plugin.settings.apiKey) {
      this.pushError("No API key set. Go to Settings → Document Chat."); return;
    }

    this.inputEl.value = "";
    this.setLoading(true);
    this.pushMessage("user", text);

    const wrapper = this.messagesEl.createDiv("dc-msg-wrapper dc-msg-assistant");
    wrapper.createDiv("dc-msg-label").setText("Claude");
    const bubble = wrapper.createDiv("dc-bubble dc-bubble-assistant");
    const streamingEl = bubble.createDiv("dc-stream-text");
    const dotsEl = bubble.createDiv("dc-typing-dots");
    dotsEl.innerHTML = "<span></span><span></span><span></span>";
    this.scrollToBottom();

    try {
      const { text: fullText, aborted } = await this.callClaudeStreaming(text, (_, accumulated) => {
        if (dotsEl.parentElement) dotsEl.remove();
        streamingEl.setText(accumulated);
        this.scrollToBottom();
      });

      const displayText = aborted ? fullText + "\n\n*[Stopped]*" : fullText;
      bubble.empty();
      if (displayText.trim()) {
        await MarkdownRenderer.render(this.app, displayText, bubble, "", this);
      } else {
        bubble.setText("[no response]");
      }
      this.addCopyButton(bubble, () => fullText);
      if (fullText.trim()) this.turns.push({ userText: text, assistantText: fullText });
      this.renderSources();
    } catch (err) {
      wrapper.remove();
      console.error("[Document Chat] API error:", err);
      this.pushError(`${(err as Error).message}`);
    }

    this.setLoading(false);
    this.inputEl.focus();
  }

  // ── Streaming API call ────────────────────────────────────────────────────

  private async callClaudeStreaming(
    userQuestion: string,
    onChunk: (chunk: string, accumulated: string) => void
  ): Promise<{ text: string; aborted: boolean }> {
    const { apiKey, model, maxTokens, systemPrompt } = this.plugin.settings;
    const messages = this.buildMessages(userQuestion);
    const hasPdf = this.documents.some((d) => d.fileType === "pdf");

    const headers: Record<string, string> = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    if (hasPdf) headers["anthropic-beta"] = "pdfs-2024-09-25";

    this.abortController = new AbortController();
    let fullText = "";
    let aborted = false;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers,
        body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages, stream: true }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const t = await response.text();
          try { errMsg = JSON.parse(t)?.error?.message ?? errMsg; } catch { errMsg = `${errMsg}: ${t.slice(0, 300)}`; }
        } catch {}
        throw new Error(errMsg);
      }

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;
          try {
            const event = JSON.parse(dataStr);
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              const chunk = event.delta.text as string;
              fullText += chunk;
              onChunk(chunk, fullText);
            } else if (event.type === "error") throw new Error(event.error?.message || "Stream error");
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") aborted = true;
      else throw err;
    } finally {
      this.abortController = null;
    }

    return { text: fullText, aborted };
  }

  private buildMessages(newUserQuestion: string): ApiMessage[] {
    const docBlocks: ApiContentBlock[] = this.documents.map((d) => d.contentBlock);
    if (this.turns.length === 0) {
      return [{ role: "user", content: [...docBlocks, { type: "text", text: newUserQuestion }] }];
    }
    const msgs: ApiMessage[] = [];
    msgs.push({ role: "user", content: [...docBlocks, { type: "text", text: this.turns[0].userText }] });
    msgs.push({ role: "assistant", content: this.turns[0].assistantText });
    for (let i = 1; i < this.turns.length; i++) {
      msgs.push({ role: "user", content: this.turns[i].userText });
      msgs.push({ role: "assistant", content: this.turns[i].assistantText });
    }
    msgs.push({ role: "user", content: newUserQuestion });
    return msgs;
  }

  // ── Sources area ──────────────────────────────────────────────────────────

  private renderSources() {
    this.chipsEl.empty();
    this.sourcesHeaderEl.empty();
    const count = this.documents.length;
    const tokens = this.estimateTotalTokens();

    if (count === 0) {
      this.sourcesHeaderEl.createSpan("dc-sources-empty").setText("No sources loaded");
    } else {
      this.sourcesHeaderEl.createSpan("dc-sources-count").setText(
        `${count} source${count > 1 ? "s" : ""} · ~${formatTokens(tokens)} tokens`
      );
      const right = this.sourcesHeaderEl.createSpan("dc-sources-clear");
      right.setText("Remove all");
      right.onclick = () => this.removeAllDocuments();
    }

    for (const doc of this.documents) {
      const chip = this.chipsEl.createDiv("dc-chip");
      chip.createSpan("dc-chip-icon").setText(doc.fileType === "pdf" ? "📕" : doc.fileType === "image" ? "🖼" : "📄");
      chip.createSpan("dc-chip-name").setText(doc.fileName);
      const close = chip.createSpan("dc-chip-close");
      close.setText("×");
      close.onclick = (e) => { e.stopPropagation(); this.removeDocument(doc.id); };
    }
  }

  private removeAllDocuments() {
    if (this.documents.length === 0) return;
    this.documents = [];
    this.pushSystemMsg(`🗑 All sources removed.`);
    this.renderSources();
    if (this.turns.length === 0) this.renderWelcome();
  }

  private estimateTotalTokens(): number {
    let total = 0;
    for (const doc of this.documents) total += doc.estimatedTokens;
    for (const turn of this.turns)
      total += Math.ceil((turn.userText.length + turn.assistantText.length) / 4);
    return total;
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  private pushMessage(role: "user" | "assistant", content: string) {
    const wrapper = this.messagesEl.createDiv(`dc-msg-wrapper dc-msg-${role}`);
    wrapper.createDiv("dc-msg-label").setText(role === "user" ? "You" : "Claude");
    const bubble = wrapper.createDiv(`dc-bubble dc-bubble-${role}`);
    if (role === "assistant") {
      MarkdownRenderer.render(this.app, content, bubble, "", this);
      this.addCopyButton(bubble, () => content);
    } else {
      bubble.setText(content);
    }
    this.scrollToBottom();
  }

  private addCopyButton(bubble: HTMLElement, getText: () => string) {
    const btn = bubble.createEl("button", { cls: "dc-copy-btn" });
    btn.setText("Copy");
    btn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(getText());
        btn.setText("✓ Copied");
        btn.addClass("dc-copy-btn-success");
        setTimeout(() => { btn.setText("Copy"); btn.removeClass("dc-copy-btn-success"); }, 1500);
      } catch { btn.setText("Failed"); }
    };
  }

  private pushSystemMsg(content: string) {
    const el = this.messagesEl.createDiv("dc-system-msg");
    MarkdownRenderer.render(this.app, content, el, "", this);
    this.scrollToBottom();
  }

  private pushError(content: string) {
    this.messagesEl.createDiv("dc-error-msg").setText("⚠️  " + content);
    this.scrollToBottom();
  }

  private renderWelcome() {
    this.messagesEl.empty();
    const welcome = this.messagesEl.createDiv("dc-welcome");
    welcome.createDiv("dc-welcome-icon").setText("💬");
    welcome.createEl("h3", { text: "Document Chat" });
    welcome.createEl("p", { text: "Load files from your vault and ask questions about them." });
    const tipsEl = welcome.createDiv("dc-supported");
    tipsEl.createEl("strong", { text: "Three ways to add a source:" });
    const list = tipsEl.createEl("ul");
    ["Click ＋ Load active file", "Type @ in the chat box to mention a note", "Drag a file from the explorer onto this panel"]
      .forEach((item) => list.createEl("li", { text: item }));
  }

  private clearChat() {
    this.turns = [];
    this.abortController?.abort();
    this.messagesEl.empty();
    if (this.documents.length > 0) {
      this.pushSystemMsg(`Chat cleared — sources still loaded: **${this.documents.map((d) => d.fileName).join(", ")}**`);
    } else {
      this.renderWelcome();
    }
    this.renderSources();
  }

  private setLoading(loading: boolean) {
    this.isLoading = loading;
    this.loadBtn.disabled = loading;
    if (loading) {
      this.sendBtn.setText("■ Stop");
      this.sendBtn.removeClass("dc-btn-send"); this.sendBtn.addClass("dc-btn-stop");
      this.sendBtn.onclick = () => this.abortController?.abort();
    } else {
      this.sendBtn.setText("Send ↵");
      this.sendBtn.removeClass("dc-btn-stop"); this.sendBtn.addClass("dc-btn-send");
      this.sendBtn.onclick = () => this.handleSend();
    }
  }

  private scrollToBottom() { this.messagesEl.scrollTop = this.messagesEl.scrollHeight; }

  private updateBridgeIndicator() {
    const running = this.plugin.bridgeRunning;
    this.bridgeIndicatorEl.className = `dc-bridge-indicator ${running ? "dc-bridge-on" : "dc-bridge-off"}`;
    this.bridgeIndicatorEl.setAttribute("aria-label", running ? "Bridge: active" : "Bridge: inactive");
    this.bridgeIndicatorEl.setAttribute("title", running ? "Chrome bridge active" : "Chrome bridge inactive — reload the plugin");
  }

  private buildBridgeFiles(): BridgeFile[] {
    const MIME_MAP: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
      md: "text/markdown", markdown: "text/markdown",
    };

    return this.documents.map((doc) => {
      if (doc.fileType === "pdf") {
        return { name: doc.fileName, mimeType: "application/pdf", data: doc.contentBlock.source!.data };
      }
      if (doc.fileType === "image") {
        return { name: doc.fileName, mimeType: doc.contentBlock.source!.media_type, data: doc.contentBlock.source!.data };
      }
      // text — strip the <document> wrapper added on load
      const raw = doc.contentBlock.text ?? "";
      const clean = raw.replace(/^<document filename="[^"]*">\n/, "").replace(/\n<\/document>$/, "");
      const ext = doc.fileName.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = MIME_MAP[ext] ?? "text/plain";
      return { name: doc.fileName, mimeType, data: textToBase64(clean) };
    });
  }

  async onClose() {
    this.abortController?.abort();
    this.hideMentionPopup();
    if (this.modelOutsideHandler) document.removeEventListener("click", this.modelOutsideHandler);
    if (this.bridgeStatusInterval !== null) window.clearInterval(this.bridgeStatusInterval);
  }
}

// ─── Folder picker modal ───────────────────────────────────────────────────────

class FolderPickerModal extends FuzzySuggestModal<TFolder> {
  private onChoose: (folder: TFolder) => void;

  constructor(app: any, onChoose: (folder: TFolder) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type a folder name…");
  }

  getItems(): TFolder[] {
    const folders: TFolder[] = [];
    const collect = (f: TFolder) => {
      folders.push(f);
      for (const child of f.children) {
        if (child instanceof TFolder) collect(child);
      }
    };
    collect(this.app.vault.getRoot());
    return folders.slice(1); // exclude vault root
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onChoose(folder);
  }
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return window.btoa(binary);
}

function generateId(): string { return Math.random().toString(36).slice(2, 10); }

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function scoreFile(file: TFile, query: string): number {
  if (!query) return 1;
  const name = file.basename.toLowerCase(), path = file.path.toLowerCase();
  if (name === query) return 1000;
  if (name.startsWith(query)) return 500;
  if (name.includes(query)) return 200;
  if (path.includes(query)) return 50;
  return 0;
}

function getFileIcon(file: TFile): string {
  const ext = file.extension.toLowerCase();
  if (PDF_EXTS.has(ext)) return "📕";
  if (IMAGE_EXTS.has(ext)) return "🖼";
  return "📄";
}

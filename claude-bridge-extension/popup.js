const statusEl = document.getElementById("status");
const sendBtn  = document.getElementById("sendBtn");

let noteContent = "";

async function checkBridge() {
  try {
    const res = await fetch("http://localhost:27184/files");
    if (!res.ok) throw new Error("Server error");
    const data = await res.json();

    if (data.available && data.files?.length) {
      noteContent = JSON.stringify(data.files); // store raw for re-use
      statusEl.textContent = `${data.files.length} file(s) ready to attach.`;
      statusEl.className = "ok";
      sendBtn.disabled = false;
    } else {
      statusEl.textContent = "No files queued. Use the Obsidian button first.";
      statusEl.className = "";
      sendBtn.disabled = true;
    }
  } catch {
    statusEl.textContent = "Obsidian not running or plugin not loaded.";
    statusEl.className = "err";
    sendBtn.disabled = true;
  }
}

sendBtn.addEventListener("click", async () => {
  sendBtn.disabled = true;
  statusEl.textContent = "Sending…";
  statusEl.className = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://claude.ai")) {
    statusEl.textContent = "Open claude.ai first, then try again.";
    statusEl.className = "err";
    sendBtn.disabled = false;
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectContent,
      args: [noteContent],
    });
    statusEl.textContent = "Note injected into Claude!";
    statusEl.className = "ok";
  } catch (err) {
    statusEl.textContent = "Injection failed. Make sure claude.ai is open.";
    statusEl.className = "err";
    sendBtn.disabled = false;
  }
});

// Injected into the claude.ai tab
function injectContent(text) {
  // ProseMirror contenteditable div used by claude.ai
  const editor = document.querySelector('div[contenteditable="true"]');
  if (!editor) {
    alert("Could not find Claude's input field. Make sure you're on a chat page.");
    return;
  }

  editor.focus();

  // Select all existing content and replace
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
}

checkBridge();

function base64ToFile(name, mimeType, b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: mimeType });
}

function waitFor(selector, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) { clearInterval(timer); resolve(el); }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error(`${selector} not found`)); }
    }, 300);
  });
}

async function main() {
  try {
    const res = await fetch("http://localhost:27184/files");
    if (!res.ok) return;
    const { available, files } = await res.json();
    if (!available || !files?.length) return;

    // Wait for claude.ai to render the hidden file input
    const input = await waitFor('input[type="file"]');

    const dt = new DataTransfer();
    for (const f of files) {
      dt.items.add(base64ToFile(f.name, f.mimeType, f.data));
    }

    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } catch {
    // Bridge not running or no files queued — do nothing silently
  }
}

main();

import { loadAI, askGemma, unloadAI, isReady, clearChat } from './ai-engine.js';

const ui = {
  chat: document.getElementById('chat-container'),
  input: document.getElementById('user-input'),
  send: document.getElementById('send-btn'),
  install: document.getElementById('install-btn'),
  progressBox: document.getElementById('progress-container'),
  progressBar: document.getElementById('dl-bar'),
  statusText: document.getElementById('status-text')
};

// 1. Service Worker (Required for PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}

// 2. Install Button Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e; ui.install.style.display = 'block';
});
ui.install.onclick = async () => {
  if(deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; ui.install.style.display='none'; }
};

// 3. Chat Logic
let idleTimer;
const resetIdle = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { 
    unloadAI(); 
    appendMessage("System", "💤 AI went to sleep to save battery. Type to wake it up."); 
  }, 5 * 60 * 1000); // 5 mins
};

function appendMessage(sender, text) {
  const div = document.createElement('div');
  div.className = `message ${sender.toLowerCase()}`;
  div.innerText = text;
  ui.chat.appendChild(div);
  ui.chat.scrollTop = ui.chat.scrollHeight;
}

ui.send.onclick = async () => {
  const text = ui.input.value.trim();
  if(!text) return;

  ui.input.value = '';
  appendMessage('user', text);
  ui.send.disabled = true; 
  
  try {
    if(!isReady()) {
      ui.progressBox.style.display = 'block';
      await loadAI(
        (msg) => ui.statusText.textContent = msg,
        (pct) => ui.progressBar.value = pct
      );
      ui.progressBox.style.display = 'none';
    }
    
    // Tiny delay to let UI update
    ui.statusText.textContent = "Thinking...";
    const reply = await askGemma(text);
    appendMessage('ai', reply);
    
  } catch(e) { 
    appendMessage('ai', "Error: " + e.message); 
    ui.progressBox.style.display = 'none';
  } finally {
    ui.send.disabled = false; resetIdle();
  }
};

document.getElementById('clear-btn').onclick = () => { 
  clearChat(); 
  ui.chat.innerHTML = ''; 
  appendMessage('ai', "Chat cleared!");
};

// 4. Initial Boot
ui.progressBox.style.display = 'block';
loadAI(
  (msg) => ui.statusText.textContent = msg,
  (pct) => ui.progressBar.value = pct
).then(() => {
  ui.progressBox.style.display = 'none';
  appendMessage('ai', "Hello! I'm ready to help. (Offline Mode Active)");
  resetIdle();
});
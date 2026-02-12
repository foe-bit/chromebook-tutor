import { loadAI, askGemma, unloadAI, isReady, clearChat } from './ai-engine.js';

const ui = {
  chat: document.getElementById('chat-container'),
  input: document.getElementById('user-input'),
  send: document.getElementById('send-btn'),
  status: document.getElementById('status-bar'),
  install: document.getElementById('install-btn')
};

// 1. Service Worker & Install
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js');
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e; ui.install.style.display = 'block';
});
ui.install.onclick = async () => {
  if(deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; ui.install.style.display='none'; }
};

// 2. Chat Logic
let idleTimer;
const resetIdle = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { unloadAI(); ui.status.textContent = "💤 Sleeping..."; ui.status.style.display='block'; }, 300000); // 5 mins
};

ui.send.onclick = async () => {
  const text = ui.input.value.trim();
  if(!text) return;
  ui.input.value = '';
  ui.chat.innerHTML += `<div class="message user">${text}</div>`;
  ui.send.disabled = true; ui.status.style.display = 'block'; ui.status.textContent = "Thinking...";
  
  try {
    if(!isReady()) await loadAI(msg => ui.status.textContent = msg);
    const reply = await askGemma(text);
    ui.chat.innerHTML += `<div class="message ai">${reply}</div>`;
    ui.status.style.display = 'none';
  } catch(e) { ui.chat.innerHTML += `<div class="message ai">Error: ${e.message}</div>`; }
  
  ui.send.disabled = false; resetIdle();
};

document.getElementById('clear-btn').onclick = () => { clearChat(); ui.chat.innerHTML = ''; };

// 3. Start
ui.status.style.display = 'block';
loadAI(msg => ui.status.textContent = msg).then(() => {
  ui.status.style.display = 'none'; resetIdle();
});
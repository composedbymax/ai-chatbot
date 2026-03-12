import { ConversationManager, SidebarUI } from './sidebar.js';
import { SettingsModal } from './settings.js';
import { DraftSaver } from './draft.js';
import { MarkdownFormatter } from './formatter.js';
import { WelcomeMessage } from './welcome.js';
import { VoiceInput } from './voice.js';
import { ShareableLink } from './link.js';
import { ToolsEngine } from './tools.js';
const apiEndpoint = './api/api.php';
let conversationManager;
let sidebarUI;
let draftSaver;
let welcomeMessage;
let voiceInput;
let shareableLink;
let modelSelect, form, input, messagesDiv, sendBtn;
const formatter = new MarkdownFormatter();
window.toolsEngine = SettingsModal.getSetting('setting-tools-enabled')
  ? new ToolsEngine()
  : null;
function createAppStructure() {
  const appDiv = document.getElementById('app');
  appDiv.innerHTML = `
    <main class="app">
      <section id="chatBox" class="chat-box">
        <div id="messages" class="messages" role="log" aria-live="polite"></div>
        <form id="inputForm" class="input-form" autocomplete="off">
          <select id="modelSelect" aria-label="Select model">
            <option value="">Loading models…</option>
          </select>
          <textarea id="userInput" placeholder="Type your message... " required rows="1" autofocus></textarea>
          <button type="submit" id="sendBtn" class="send-btn" aria-label="Send message">
            <span class="send-btn__arrow">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="send-btn__dots" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
        </form>
      </section>
    </main>
  `;
}
function initDOMReferences() {
  modelSelect = document.getElementById('modelSelect');
  form = document.getElementById('inputForm');
  input = document.getElementById('userInput');
  messagesDiv = document.getElementById('messages');
  sendBtn = document.getElementById('sendBtn');
  AutoModelSetting();
}
function AutoModelSetting() {
  const autoModel = SettingsModal.getSetting('setting-auto-model');
  modelSelect.style.display = autoModel ? 'none' : '';
}
function setSendButtonLoading(isLoading) {
  if (isLoading) {
    sendBtn.classList.add('send-btn--loading');
    sendBtn.disabled = true;
  } else {
    sendBtn.classList.remove('send-btn--loading');
    sendBtn.disabled = false;
  }
}
function appendMessage(text, sender, meta = '') {
  if (welcomeMessage) {
    welcomeMessage.hide();
  }
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'message ' + (sender === 'user' ? 'user' : 'ai');
  const contentDiv = document.createElement('div');
  if (sender === 'ai') {
    const formattedText = formatter.format(text);
    contentDiv.innerHTML = formattedText;
  } else {
    contentDiv.textContent = text;
  }
  if (meta) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = meta;
    contentDiv.appendChild(m);
  }
  messageWrapper.appendChild(contentDiv);
  messagesDiv.appendChild(messageWrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function appendElement(el) {
  if (welcomeMessage) welcomeMessage.hide();
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'message ai';
  messageWrapper.appendChild(el);
  messagesDiv.appendChild(messageWrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function appendElementWithBanner(el, calledAt) {
  if (welcomeMessage) welcomeMessage.hide();
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'message ai';
  messageWrapper.appendChild(el);
  if (calledAt) {
    const banner = document.createElement('div');
    banner.className = 'tool-cache-banner';
    const d = new Date(calledAt);
    banner.textContent = `Tool called at ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    messageWrapper.appendChild(banner);
  }
  messagesDiv.appendChild(messageWrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function clearMessages() {
  messagesDiv.innerHTML = '';
}
function populateModels(models) {
  modelSelect.innerHTML = '';
  if (!models || !models.length) {
    modelSelect.innerHTML = '<option value="">No free models available</option>';
    return;
  }
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.provider_id;
    opt.textContent = m.llm_name;
    modelSelect.appendChild(opt);
  }
  if (!modelSelect.value && modelSelect.options.length) modelSelect.selectedIndex = 0;
}
async function initializeApp() {
  try {
    const res = await fetch(apiEndpoint + '?action=init');
    const json = await res.json();
    if (json.error) {
      modelSelect.innerHTML = '<option value="">Error loading models</option>';
      console.error(json.error);
      return;
    }
    populateModels(json.models || []);
  } catch (e) {
    console.error(e);
    modelSelect.innerHTML = '<option value="">Unable to load models</option>';
  }
}
async function sendMessage(message, model) {
  appendMessage(message, 'user');
  await conversationManager.saveMessage('user', message);
  setSendButtonLoading(true);
  try {
    let messages = [];
    if (conversationManager.currentConversationId) {
      const conversation = await conversationManager.getConversation(conversationManager.currentConversationId);
      if (conversation && conversation.messages) {
        messages = conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      }
    }
    const matchedTools = window.toolsEngine ? window.toolsEngine.detectTools(message) : [];
    const toolPrompt = window.toolsEngine ? window.toolsEngine.buildToolPrompt(matchedTools) : null;
    const augmentedMessage = toolPrompt
      ? `${toolPrompt}\n\nUser message: ${message}`
      : message;
    if (window.toolsEngine) await window.toolsEngine.ready();
    const apiMessages = [
      ...messages.slice(0, -1),
      { role: 'user', content: augmentedMessage }
    ];
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        messages: apiMessages,
        model
      })
    });
    const json = await res.json();
    setSendButtonLoading(false);
    if (json.error) {
      appendMessage(json.error, 'ai');
      await conversationManager.saveMessage('assistant', json.error);
    } else {
      const reply = json.reply || 'No response from model';
      if (matchedTools.length && window.toolsEngine) {
        const cacheEnabled = SettingsModal.getSetting('setting-cache-tools');
        if (cacheEnabled) {
          const result = await window.toolsEngine.tryRender(reply, { cache: true });
          if (result?.el) {
            appendElementWithBanner(result.el, result.calledAt);
            const cachePayload = JSON.stringify({
              __toolCache: true,
              cache: result.cache,
              calledAt: result.calledAt,
              originalReply: reply
            });
            await conversationManager.saveMessage('assistant', cachePayload);
            if (json.rate_limit_message) appendMessage(json.rate_limit_message, 'ai');
            return;
          }
        } else {
          const toolEl = await window.toolsEngine.tryRender(reply);
          if (toolEl) {
            appendElement(toolEl);
            await conversationManager.saveMessage('assistant', reply);
            if (json.rate_limit_message) appendMessage(json.rate_limit_message, 'ai');
            return;
          }
        }
      }
      appendMessage(reply, 'ai');
      await conversationManager.saveMessage('assistant', reply);
    }
    if (json.rate_limit_message) {
      appendMessage(json.rate_limit_message, 'ai');
    }
  } catch (err) {
    console.error(err);
    setSendButtonLoading(false);
    const errorMsg = 'Error connecting to server';
    appendMessage(errorMsg, 'ai');
    await conversationManager.saveMessage('assistant', errorMsg);
  }
}
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  const maxHeight = 200;
  const newHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = newHeight + 'px';
}
async function loadConversationIntoUI(conversation) {
  clearMessages();
  if (conversation.messages && conversation.messages.length > 0) {
    if (window.toolsEngine) await window.toolsEngine.ready();
    for (const msg of conversation.messages) {
      if (msg.role === 'assistant') {
        let cachedPayload = null;
        try {
          const candidate = JSON.parse(msg.content);
          if (candidate?.__toolCache === true) cachedPayload = candidate;
        } catch {}
        if (cachedPayload && window.toolsEngine) {
          const el = window.toolsEngine.renderFromCache(cachedPayload);
          if (el) {
            appendElementWithBanner(el, cachedPayload.calledAt);
            continue;
          }
        }
        const rendered = window.toolsEngine ? await window.toolsEngine.tryRender(msg.content) : null;
        rendered ? appendElement(rendered) : appendMessage(msg.content, 'ai');
      } else {
        appendMessage(msg.content, 'user');
      }
    }
  } else {
    if (welcomeMessage) welcomeMessage.show();
  }
  if (draftSaver) draftSaver.deleteDraft();
}
async function init() {
  createAppStructure();
  initDOMReferences();
  voiceInput = new VoiceInput();
  voiceInput.attachToInput(input);
  welcomeMessage = new WelcomeMessage();
  welcomeMessage.show();
  conversationManager = new ConversationManager();
  await conversationManager.init();
  conversationManager.onConversationLoad = loadConversationIntoUI;
  shareableLink = new ShareableLink(conversationManager);
  const sharedConversation = shareableLink.loadSharedConversation();
  if (sharedConversation) {
    loadConversationIntoUI(sharedConversation);
  }
  sidebarUI = new SidebarUI(conversationManager);
  sidebarUI.createSidebar();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    voiceInput.attachToInput(searchInput);
  }
  const settingsModal = new SettingsModal();
  settingsModal.init();
  document.addEventListener('change', (e) => {
    if (e.target.id === 'setting-auto-model') {
      AutoModelSetting();
    }
    if (e.target.id === 'setting-tools-enabled') {
      window.toolsEngine = e.target.checked ? new ToolsEngine() : null;
    }
    if (e.target.id === 'setting-incognito-mode') {
      if (welcomeMessage && document.getElementById('messages')?.children.length <= 1) {
        welcomeMessage.hide();
        setTimeout(() => welcomeMessage.show(), 350);
      }
    }
  });
  draftSaver = new DraftSaver(input);
  input.addEventListener('input', () => {
    autoResizeTextarea(input);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = input.value.trim();
    const model = SettingsModal.getSetting('setting-auto-model')
      ? (modelSelect.options[0]?.value || modelSelect.value)
      : modelSelect.value;
    if (!model) {
      appendMessage('No model available. Please wait for models to load.', 'ai');
      return;
    }
    draftSaver.deleteDraft();
    input.value = '';
    input.style.height = 'auto';
    sendMessage(message, model);
  });
  initializeApp();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
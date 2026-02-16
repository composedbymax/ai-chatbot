import { ConversationManager, SidebarUI } from './sidebar.js';
import { DraftSaver } from './draft.js';
import { MarkdownFormatter } from './formatter.js';
import { WelcomeMessage } from './welcome.js';
import { VoiceInput } from './voice.js';
const apiEndpoint = './api/api.php';
let conversationManager;
let sidebarUI;
let draftSaver;
let welcomeMessage;
let voiceInput;
let modelSelect, form, input, messagesDiv;
const formatter = new MarkdownFormatter();
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
          <textarea id="userInput" placeholder="Type your message... " required rows="1"></textarea>
          <button type="submit">Send</button>
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
  const typing = document.createElement('div');
  typing.className = 'message ai';
  const typingContent = document.createElement('div');
  typingContent.textContent = '.';
  typing.appendChild(typingContent);
  messagesDiv.appendChild(typing);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  let dotCount = 1;
  const typingInterval = setInterval(() => {
    dotCount = (dotCount % 3) + 1;
    typingContent.textContent = '.'.repeat(dotCount);
  }, 500);
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
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        message,
        messages,
        model
      })
    });
    const json = await res.json();
    clearInterval(typingInterval);
    typing.remove();
    if (json.error) {
      appendMessage(json.error, 'ai');
      await conversationManager.saveMessage('assistant', json.error);
    } else {
      const reply = json.reply || 'No response from model';
      appendMessage(reply, 'ai');
      await conversationManager.saveMessage('assistant', reply);
    }
    if (json.rate_limit_message) {
      appendMessage(json.rate_limit_message, 'ai');
    }
  } catch (err) {
    console.error(err);
    clearInterval(typingInterval);
    typing.remove();
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
function loadConversationIntoUI(conversation) {
  clearMessages();
  if (conversation.messages && conversation.messages.length > 0) {
    conversation.messages.forEach(msg => {
      appendMessage(msg.content, msg.role === 'user' ? 'user' : 'ai');
    });
  } else {
    if (welcomeMessage) {
      welcomeMessage.show();
    }
  }
  if (draftSaver) {
    draftSaver.deleteDraft();
  }
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
  sidebarUI = new SidebarUI(conversationManager);
  sidebarUI.createSidebar();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    voiceInput.attachToInput(searchInput);
  }
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
    const model = modelSelect.value;
    if (!message) return;
    if (!model) {
      appendMessage('Please select a model before sending.', 'ai');
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
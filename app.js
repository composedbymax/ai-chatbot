(() => {
  const apiEndpoint = 'api.php';
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
            <textarea id="userInput" placeholder="Type your message... (Shift+Enter for new line)" required rows="1"></textarea>
            <button type="submit">Send</button>
          </form>
        </section>
      </main>
    `;
  }
  let modelSelect, form, input, messagesDiv;
  function initDOMReferences() {
    modelSelect = document.getElementById('modelSelect');
    form = document.getElementById('inputForm');
    input = document.getElementById('userInput');
    messagesDiv = document.getElementById('messages');
  }
  function appendMessage(text, sender, meta = '') {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message ' + (sender === 'user' ? 'user' : 'ai');
    const contentDiv = document.createElement('div');
    if (sender === 'ai') {
      const formattedText = formatAIResponse(text);
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
  function formatAIResponse(text) {
    const escapeHtml = (unsafe) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__(.+?)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_(.+?)_/g, '<em>$1</em>');
    escaped = escaped.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>');
    escaped = escaped.replace(/`(.+?)`/g, '<code>$1</code>');
    escaped = escaped.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    const lines = escaped.split('\n');
    let inList = false;
    let formatted = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const listMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
      
      if (listMatch) {
        if (!inList) {
          formatted.push('<ul>');
          inList = true;
        }
        formatted.push(`<li>${listMatch[1]}</li>`);
      } else {
        if (inList) {
          formatted.push('</ul>');
          inList = false;
        }
        formatted.push(line);
      }
    }
    if (inList) {
      formatted.push('</ul>');
    }
    escaped = formatted.join('\n');
    const paragraphs = escaped.split(/\n\n+/);
    escaped = paragraphs.map(p => {
      p = p.trim();
      if (p.match(/^<(h1|h2|h3|ul|pre|blockquote)/)) {
        return p;
      }
      return p ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '';
    }).join('\n');
    return escaped;
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
    const typing = document.createElement('div');
    typing.className = 'message ai';
    const typingContent = document.createElement('div');
    typingContent.textContent = '…';
    typing.appendChild(typingContent);
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', message, model })
      });
      const json = await res.json();
      typing.remove();
      if (json.error) {
        appendMessage(json.error, 'ai');
      } else {
        const reply = json.reply || 'No response from model';
        appendMessage(reply, 'ai');
      }
      if (json.rate_limit_message) {
        appendMessage(json.rate_limit_message, 'ai');
      }
    } catch (err) {
      console.error(err);
      typing.remove();
      appendMessage('Error connecting to server', 'ai');
    }
  }
  
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    const maxHeight = 200; // Maximum height in pixels
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  function init() {
    createAppStructure();
    initDOMReferences();
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
      input.value = '';
      input.style.height = 'auto';
      sendMessage(message, model);
    });
    initializeApp();
  }
})();
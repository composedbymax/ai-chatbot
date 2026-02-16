(() => {
  const apiEndpoint = 'api.php';
  const modelSelect = document.getElementById('modelSelect');
  const form = document.getElementById('inputForm');
  const input = document.getElementById('userInput');
  const messagesDiv = document.getElementById('messages');
  const rateInfo = document.getElementById('rateInfo');
  function appendMessage(text, sender, meta = '') {
    const d = document.createElement('div');
    d.className = 'message ' + (sender === 'user' ? 'user' : 'ai');
    d.textContent = text;
    if (meta) {
      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = meta;
      d.appendChild(m);
    }
    messagesDiv.appendChild(d);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  function updateRateInfo(rateData) {
    if (!rateData) {
      rateInfo.textContent = '';
      return;
    }
    const rem = (rateData.limit_remaining === null) ? 'unlimited' : rateData.limit_remaining;
    rateInfo.textContent = `Limit: ${rateData.limit ?? 'n/a'} • Remaining: ${rem} • is_free_tier: ${rateData.is_free_tier ? 'yes' : 'no'}`;
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
        rateInfo.textContent = 'Error loading rate info';
        console.error(json.error);
        return;
      }
      populateModels(json.models || []);
      updateRateInfo(json.rate_info);
    } catch (e) {
      console.error(e);
      modelSelect.innerHTML = '<option value="">Unable to load models</option>';
      rateInfo.textContent = 'Failed to load rate info';
    }
  }
  async function sendMessage(message, model) {
    appendMessage(message, 'user');
    const typing = document.createElement('div');
    typing.className = 'message ai';
    typing.textContent = '…';
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
      if (json.rate_info) {
        updateRateInfo(json.rate_info);
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
    sendMessage(message, model);
  });
  initializeApp();
})();
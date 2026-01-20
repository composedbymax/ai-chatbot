(() => {
  const modelsEndpoint = 'models.php';
  const ratesEndpoint  = 'rates.php';
  const chatEndpoint   = 'chat.php';
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
  function setRateSummary(obj) {
    if (!obj || obj.error) {
      rateInfo.textContent = 'Rate info unavailable';
      return;
    }
    const d = obj.data ?? obj;
    const rem = (d.limit_remaining === null) ? 'unlimited' : d.limit_remaining;
    rateInfo.textContent = `Limit: ${d.limit ?? 'n/a'} • Remaining: ${rem} • is_free_tier: ${d.is_free_tier ? 'yes' : 'no'}`;
  }
  async function fetchRates() {
    try {
      const res = await fetch(ratesEndpoint);
      const json = await res.json();
      setRateSummary(json);
    } catch (e) {
      rateInfo.textContent = 'Failed to load rate info';
      console.error(e);
    }
  }
  async function fetchModels(forceRefresh = false) {
    try {
      const url = modelsEndpoint + (forceRefresh ? '?refresh=1' : '');
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch models');
      const json = await res.json();
      populateModels(json.models || []);
    } catch (e) {
      console.error(e);
      modelSelect.innerHTML = '<option value="">Unable to load models</option>';
    }
  }
  function populateModels(models) {
    modelSelect.innerHTML = '';
    if (!models.length) {
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
  async function sendMessage(message, model) {
    appendMessage(message, 'user');
    const typing = document.createElement('div');
    typing.className = 'message ai';
    typing.textContent = '…';
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    try {
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model })
      });
      const json = await res.json();
      typing.remove();
      if (json.error) {
        appendMessage(json.error, 'ai');
      } else {
        const reply = json.reply || json.result || 'No response from model';
        appendMessage(reply, 'ai');
      }
      fetchRates();
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
  fetchModels();
  fetchRates();
  setInterval(fetchRates, 60_000);
})();
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenRouter Chat</title>
<style>
  body { font-family: Arial, sans-serif; background: #f2f2f2; display: flex; justify-content: center; padding: 50px; }
  #chat { width: 500px; max-width: 100%; background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
  #messages { height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #fafafa; }
  .message { margin: 5px 0; }
  .user { color: #007bff; }
  .ai { color: #28a745; }
  #inputForm { display: flex; gap: 10px; }
  #inputForm input { flex: 1; padding: 10px; border-radius: 5px; border: 1px solid #ccc; }
  #inputForm select { padding: 10px; border-radius: 5px; border: 1px solid #ccc; }
  #inputForm button { padding: 10px 20px; border: none; background: #007bff; color: #fff; border-radius: 5px; cursor: pointer; }
  #inputForm button:hover { background: #0056b3; }
</style>
</head>
<body>
<div id="chat">
  <div id="messages"></div>
  <form id="inputForm">
    <input type="text" id="userInput" placeholder="Type your message..." required>
    <select id="modelSelect">
      <option value="alibaba/tongyi-deepresearch-30b-a3b:free">tongyi-deepresearch-30b-a3b</option>
        <option value="allenai/olmo-3.1-32b-think:free">olmo-3.1-32b-think</option>
        <option value="arcee-ai/trinity-mini:free">trinity-mini</option>
        <option value="cognitivecomputations/dolphin-mistral-24b-venice-edition:free">dolphin-mistral-24b-venice</option>
        <option value="deepseek/deepseek-r1-0528:free">deepseek-r1-0528</option>
        <option value="google/gemma-3n-e2b-it:free">gemma-3n-e2b-it</option>
        <option value="google/gemma-3n-e4b-it:free">gemma-3n-e4b-it</option>
        <option value="kwaipilot/kat-coder-pro:free">kat-coder-pro</option>
        <option value="mistralai/devstral-2512:free">devstral-2512</option>
        <option value="mistralai/mistral-small-3.1-24b-instruct:free">mistral-small-3.1-24b</option>
        <option value="moonshotai/kimi-k2:free">kimi-k2</option>
        <option value="nex-agi/deepseek-v3.1-nex-n1:free">deepseek-v3.1-nex-n1</option>
        <option value="nvidia/nemotron-3-nano-30b-a3b:free">nemotron-3-nano-30b-a3b</option>
        <option value="nvidia/nemotron-nano-12b-v2-vl:free">nemotron-nano-12b-v2</option>
        <option value="nvidia/nemotron-nano-9b-v2:free">nemotron-nano-9b-v2</option>
        <option value="openai/gpt-oss-120b:free">gpt-oss-120b</option>
        <option value="openai/gpt-oss-20b:free">gpt-oss-20b</option>
        <option value="qwen/qwen3-4b:free">qwen3-4b</option>
        <option value="qwen/qwen3-coder:free">qwen3-coder</option>
        <option value="tngtech/deepseek-r1t2-chimera:free">deepseek-r1t2-chimera</option>
        <option value="tngtech/deepseek-r1t-chimera:free">deepseek-r1t-chimera</option>
        <option value="tngtech/tng-r1t-chimera:free">tng-r1t-chimera</option>
        <option value="xiaomi/mimo-v2-flash:free">mimo-v2-flash</option>
        <option value="z-ai/glm-4.5-air:free">glm-4.5-air</option>
    </select>
    <button type="submit">Send</button>
  </form>
</div>
<script>
  const form = document.getElementById('inputForm');
  const input = document.getElementById('userInput');
  const messagesDiv = document.getElementById('messages');
  const modelSelect = document.getElementById('modelSelect');
  function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.className = 'message ' + sender;
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = input.value;
    const selectedModel = modelSelect.value;
    appendMessage(userText, 'user');
    input.value = '';
    try {
      const res = await fetch('chat.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, model: selectedModel })
      });
      const data = await res.json();
      appendMessage(data.reply, 'ai');
    } catch (err) {
      appendMessage('Error connecting to server', 'ai');
      console.error(err);
    }
  });
</script>
</body>
</html>
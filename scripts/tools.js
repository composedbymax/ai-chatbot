window.toolErrorEl = (msg) => {
  const el = document.createElement('div');
  el.className = 'tool-card tool-error';
  el.textContent = `⚠️ ${msg}`;
  return el;
};
const TOOLS_CONFIG_URL = './api/tools/toolsconfig.json';
export class ToolsEngine {
  constructor() {
    this.config = null;
    this.renderers = {};
    this._ready = this._load();
  }
  async ready() {
    await this._ready;
  }
  async _load() {
    const res = await fetch(TOOLS_CONFIG_URL);
    if (!res.ok) throw new Error('Could not load toolsconfig.json');
    this.config = await res.json();
    await this._loadRenderers();
  }
  async _loadRenderers() {
    for (const tool of this.config.tools) {
      try {
        const module = await import(tool.js_file);
        if (module[tool.renderer]) {
          this.renderers[tool.id] = new module[tool.renderer]();
        } else {
          console.warn(`[ToolsEngine] Renderer "${tool.renderer}" not found in ${tool.js_file}`);
        }
      } catch (err) {
        console.warn(`[ToolsEngine] Could not load renderer for tool "${tool.id}":`, err);
      }
    }
  }
  detectTools(userMessage) {
    if (!this.config) return [];
    const lower = userMessage.toLowerCase();
    const matched = [];
    for (const tool of this.config.tools) {
      if (tool.keyword_context) {
        const hasContext = tool.keyword_context.some(kw => lower.includes(kw.toLowerCase()));
        if (!hasContext) continue;
      }
      const hit = tool.keywords.some(kw => lower.includes(kw.toLowerCase()));
      if (hit) matched.push(tool);
    }
    return matched;
  }
  buildToolPrompt(matchedTools) {
    if (!matchedTools.length) return null;
    const blocks = matchedTools.map(t =>
      `### Tool: ${t.name}\n${t.llm_instructions}`
    );
    return (
      `You have access to structured data tools. When the user's request matches a tool, ` +
      `respond ONLY with the JSON tool-call specified below — no prose, no markdown, just raw JSON.\n\n` +
      blocks.join('\n\n')
    );
  }
  parseToolCall(llmReply) {
    try {
      const cleaned = llmReply.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.tool && this.config.tools.some(t => t.id === parsed.tool)) {
        return parsed;
      }
    } catch {
    }
    return null;
  }
  async handleToolCall(toolCall) {
    const toolConfig = this.config.tools.find(t => t.id === toolCall.tool);
    if (!toolConfig) throw new Error(`Unknown tool: ${toolCall.tool}`);
    const renderer = this.renderers[toolCall.tool];
    if (!renderer) throw new Error(`No renderer loaded for tool: ${toolCall.tool}`);
    const data = await this._fetchToolData(toolConfig.php_file, toolCall);
    const enrichedCall = { ...toolCall, _phpFile: toolConfig.php_file };
    return renderer.render(data, enrichedCall);
  }
  async _fetchToolData(phpFile, toolCall) {
    const res = await fetch(phpFile, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolCall)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tool backend error (${res.status}): ${text}`);
    }
    return res.json();
  }
  async tryRender(llmReply) {
    const toolCall = this.parseToolCall(llmReply);
    if (!toolCall) return null;
    try {
      return await this.handleToolCall(toolCall);
    } catch (err) {
      console.error('[ToolsEngine] Tool render failed:', err);
      const errEl = document.createElement('div');
      errEl.className = 'tool-error';
      errEl.textContent = `⚠️ Tool error: ${err.message}`;
      return errEl;
    }
  }
  async recallToolsFromConversation(conversation, replaceCallback) {
    if (!conversation?.messages) return;
    for (const msg of conversation.messages) {
      if (msg.role !== 'assistant') continue;
      const toolCall = this.parseToolCall(msg.content);
      if (!toolCall) continue;
      try {
        const rendered = await this.handleToolCall(toolCall);
        replaceCallback(msg, rendered);
      } catch (err) {
        console.error('Tool recall failed:', err);
      }
    }
  }
}
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
    const multiNote = matchedTools.length > 1
      ? `If the user's request matches MULTIPLE tools, respond with a JSON array of tool-calls: [{...}, {...}]\n\n`
      : '';
    return (
      `You have access to structured data tools. When the user's request matches a tool, ` +
      `respond ONLY with the JSON tool-call(s) below — no prose, no markdown, just raw JSON.\n\n` +
      multiNote +
      blocks.join('\n\n')
    );
  }
  parseToolCall(llmReply) {
    try {
      const cleaned = llmReply.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);
      if (parsed && !Array.isArray(parsed) && parsed.tool && this.config.tools.some(t => t.id === parsed.tool)) {
        return parsed;
      }
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(p => p.tool && this.config.tools.some(t => t.id === p.tool))) {
        return parsed;
      }
    } catch {}
    return null;
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
  async tryRender(llmReply, { cache = false } = {}) {
    const toolCall = this.parseToolCall(llmReply);
    if (!toolCall) return null;
    const toolCalls = Array.isArray(toolCall) ? toolCall : [toolCall];
    const cacheEntries = cache ? [] : null;
    const runOne = async (tc) => {
      const toolConfig = this.config.tools.find(t => t.id === tc.tool);
      if (!toolConfig) throw new Error(`Unknown tool: ${tc.tool}`);
      const renderer = this.renderers[tc.tool];
      if (!renderer) throw new Error(`No renderer loaded for tool: ${tc.tool}`);
      const data = await this._fetchToolData(toolConfig.php_file, tc);
      if (cacheEntries) cacheEntries.push({ tool: tc.tool, data });
      return renderer.render(data, { ...tc, _phpFile: toolConfig.php_file });
    };
    if (toolCalls.length === 1) {
      try {
        const el = await runOne(toolCalls[0]);
        return cache ? { el, cache: cacheEntries, calledAt: Date.now() } : el;
      } catch (err) {
        console.error('[ToolsEngine] Tool render failed:', err);
        const errEl = window.toolErrorEl(err.message);
        return cache ? { el: errEl, cache: null } : errEl;
      }
    }
    const container = document.createElement('div');
    container.className = 'tool-results-multi';
    await Promise.all(toolCalls.map(async (tc) => {
      try {
        container.appendChild(await runOne(tc));
      } catch (err) {
        console.error('[ToolsEngine] Tool render failed:', err);
        container.appendChild(window.toolErrorEl(err.message));
      }
    }));
    return cache ? { el: container, cache: cacheEntries, calledAt: Date.now() } : container;
  }
  renderFromCache(cachedPayload) {
    if (!cachedPayload?.cache?.length) return null;
    if (cachedPayload.cache.length === 1) {
      const { tool, data } = cachedPayload.cache[0];
      const renderer = this.renderers[tool];
      if (!renderer) return null;
      const toolConfig = this.config.tools.find(t => t.id === tool);
      return renderer.render(data, { tool, _phpFile: toolConfig?.php_file });
    }
    const container = document.createElement('div');
    container.className = 'tool-results-multi';
    for (const { tool, data } of cachedPayload.cache) {
      const renderer = this.renderers[tool];
      if (!renderer) continue;
      const toolConfig = this.config.tools.find(t => t.id === tool);
      container.appendChild(renderer.render(data, { tool, _phpFile: toolConfig?.php_file }));
    }
    return container;
  }
  async recallToolsFromConversation(conversation, replaceCallback) {
    if (!conversation?.messages) return;
    for (const msg of conversation.messages) {
      if (msg.role !== 'assistant') continue;
      try {
        const rendered = await this.tryRender(msg.content);
        if (rendered) replaceCallback(msg, rendered);
      } catch (err) {
        console.error('Tool recall failed:', err);
      }
    }
  }
}
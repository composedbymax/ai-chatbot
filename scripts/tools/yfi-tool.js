export class YFinanceTool {
  render(data, toolCall) {
    if (data.error) return window.toolErrorEl(`Finance error: ${data.error}`);
    const candidates = data.candidates ?? [];
    if (!candidates.length) return window.toolErrorEl('Finance error: No matching symbols found.');
    const queryUpper = (toolCall.query ?? '').toUpperCase().trim();
    const top = candidates[0];
    const looksLikeTicker = /^[A-Z0-9\.\-\^\=]{1,10}$/.test(queryUpper);
    const isDirect = top.symbol.toUpperCase() === queryUpper || looksLikeTicker;
    if (isDirect) {
      return this._loadingCard(top, toolCall, true);
    } else {
      return this._confirmCard(candidates, toolCall);
    }
  }
  _confirmCard(candidates, toolCall) {
    const card = document.createElement('div');
    card.className = 'tool-card yfi-card yfi-confirm';
    const rows = candidates.slice(0, 5).map(c => `
      <button class="yfi-candidate" data-symbol="${window.escapeHtml(c.symbol)}" data-name="${window.escapeHtml(c.name)}">
        <span class="yfi-cand-symbol">${window.escapeHtml(c.symbol)}</span>
        <span class="yfi-cand-name">${window.escapeHtml(c.name)}</span>
        <span class="yfi-cand-meta">${window.escapeHtml(c.type)}${c.exchange ? ' · ' + window.escapeHtml(c.exchange) : ''}</span>
      </button>
    `).join('');
    card.innerHTML = `
      <div class="yfi-confirm-title">Which did you mean?</div>
      <div class="yfi-confirm-query">Results for "<strong>${window.escapeHtml(toolCall.query)}</strong>"</div>
      <div class="yfi-candidates">${rows}</div>
      <div class="yfi-footer">Data via Yahoo Finance</div>
    `;
    card.querySelectorAll('.yfi-candidate').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.dataset.symbol;
        const name   = btn.dataset.name;
        card.innerHTML = `<div class="yfi-loading">Loading ${window.escapeHtml(symbol)}…</div>`;
        this._fetchAndRender(symbol, toolCall, name).then(chartCard => {
          card.replaceWith(chartCard);
        }).catch(err => {
          card.replaceWith(window.toolErrorEl(`Finance error: ${err.message}`));
        });
      });
    });
    return card;
  }
  _loadingCard(candidate, toolCall, autoFetch) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tool-card yfi-card';
    wrapper.innerHTML = `<div class="yfi-loading">Loading ${window.escapeHtml(candidate.symbol)}…</div>`;
    if (autoFetch) {
      this._fetchAndRender(candidate.symbol, toolCall, candidate.name).then(chartCard => {
        wrapper.replaceWith(chartCard);
      }).catch(err => {
        wrapper.replaceWith(window.toolErrorEl(`Finance error: ${err.message}`));
      });
    }
    return wrapper;
  }
  async _fetchAndRender(symbol, toolCall, knownName) {
    const phpFile = toolCall._phpFile ?? './api/tools/yfiapi.php';
    const res = await fetch(phpFile, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:   'chart',
        symbol,
        range:    toolCall.range    ?? '1mo',
        interval: toolCall.interval ?? '1d',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return this._chartCard(data, toolCall, knownName);
  }
  _chartCard(data, toolCall, knownName) {
    const { meta, quotes } = data;
    const card = document.createElement('div');
    card.className = 'tool-card yfi-card';
    const currentPrice = meta.regularMarketPrice ?? quotes[quotes.length - 1]?.close ?? 0;
    const prevClose    = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change       = prevClose != null ? currentPrice - prevClose : null;
    const changePct    = prevClose != null ? (change / prevClose) * 100 : null;
    const isUp         = change === null ? null : change >= 0;
    const sparkline = this._sparkline(quotes, isUp);
    const metaRows = [];
    if (meta.regularMarketOpen)    metaRows.push(['Open',     this._fmt(meta.regularMarketOpen)]);
    if (meta.regularMarketDayHigh) metaRows.push(['High',     this._fmt(meta.regularMarketDayHigh)]);
    if (meta.regularMarketDayLow)  metaRows.push(['Low',      this._fmt(meta.regularMarketDayLow)]);
    if (meta.fiftyTwoWeekHigh)     metaRows.push(['52w High', this._fmt(meta.fiftyTwoWeekHigh)]);
    if (meta.fiftyTwoWeekLow)      metaRows.push(['52w Low',  this._fmt(meta.fiftyTwoWeekLow)]);
    if (meta.regularMarketVolume)  metaRows.push(['Volume',   this._fmtVol(meta.regularMarketVolume)]);
    const metaHtml = metaRows.length
      ? `<div class="yfi-meta-grid">${metaRows.map(([k, v]) =>
          `<span class="yfi-meta-key">${k}</span><span class="yfi-meta-val">${v}</span>`
        ).join('')}</div>`
      : '';
    const changeHtml = change !== null
      ? `<span class="yfi-change ${isUp ? 'up' : 'down'}">${isUp ? '▲' : '▼'} ${this._fmt(Math.abs(change))} (${Math.abs(changePct).toFixed(2)}%)</span>`
      : '';
    const displayName = meta.longName ?? meta.shortName ?? knownName ?? '';
    const rangeLabel  = toolCall.range ?? '1mo';
    card.innerHTML = `
      <div class="yfi-header">
        <div class="yfi-symbol-block">
          <div class="yfi-symbol">${window.escapeHtml(meta.symbol ?? data.symbol)}</div>
          <div class="yfi-name">${window.escapeHtml(displayName)}</div>
        </div>
        <div class="yfi-price-block">
          <div class="yfi-price">${this._fmt(currentPrice)}<span class="yfi-currency">${meta.currency ?? 'USD'}</span></div>
          ${changeHtml}
        </div>
      </div>
      <div class="yfi-chart">
        ${sparkline}
        <div class="yfi-chart-range">${window.escapeHtml(rangeLabel)}</div>
      </div>
      ${metaHtml}
      <div class="yfi-footer">Data via Yahoo Finance · finance.yahoo.com</div>
    `;
    return card;
  }
  _sparkline(quotes, isUp) {
    if (!quotes || quotes.length < 2) return '<div class="yfi-no-chart">No chart data</div>';
    const closes = quotes.map(q => q.close).filter(v => v != null);
    if (closes.length < 2) return '';
    const W = 380, H = 90, pad = 6;
    const minV = Math.min(...closes);
    const maxV = Math.max(...closes);
    const range = maxV - minV || 1;
    const pts = closes.map((v, i) => {
      const x = pad + (i / (closes.length - 1)) * (W - pad * 2);
      const y = H - pad - ((v - minV) / range) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const color     = isUp === false ? '#f05252' : '#34d399';
    const fillColor = isUp === false ? 'rgba(240,82,82,0.12)' : 'rgba(52,211,153,0.12)';
    const lastPt    = pts[pts.length - 1].split(',');
    const firstPt   = pts[0].split(',');
    const fillPath  = `M${firstPt[0]},${H} L${pts.join(' L')} L${lastPt[0]},${H} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="yfi-svg">
      <path d="${fillPath}" fill="${fillColor}"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="3" fill="${color}"/>
    </svg>`;
  }
  _fmt(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  _fmtVol(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
}
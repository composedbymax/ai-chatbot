export class CurrencyTool {
  render(data, toolCall) {
    if (data.error) return window.toolErrorEl(`Currency error: ${data.error}`);
    const { from, to, amount, rate, converted, reverse_rate, date } = data;
    const card = document.createElement('div');
    card.className = 'tool-card currency-card';
    const fmtAmount  = this._fmt(amount,    from);
    const fmtResult  = this._fmt(converted, to);
    const fmtRate    = rate    < 0.01 ? rate.toFixed(6)    : rate.toFixed(4);
    const fmtReverse = reverse_rate < 0.01
      ? reverse_rate.toFixed(6)
      : reverse_rate.toFixed(4);
    const dateStr = date
      ? new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        })
      : '';
    card.innerHTML = `
      <div class="cx-header">
        <div class="cx-title">Currency Conversion</div>
        <div class="cx-date">${window.escapeHtml(dateStr)}</div>
      </div>
      <div class="cx-main">
        <div class="cx-side cx-from">
          <div class="cx-amount">${window.escapeHtml(fmtAmount)}</div>
          <div class="cx-code">${window.escapeHtml(from)}</div>
        </div>
        <div class="cx-arrow">→</div>
        <div class="cx-side cx-to">
          <div class="cx-amount cx-result">${window.escapeHtml(fmtResult)}</div>
          <div class="cx-code">${window.escapeHtml(to)}</div>
        </div>
      </div>
      <div class="cx-rates">
        <span class="cx-rate-item">1 ${window.escapeHtml(from)} = ${window.escapeHtml(fmtRate)} ${window.escapeHtml(to)}</span>
        <span class="cx-rate-sep">·</span>
        <span class="cx-rate-item">1 ${window.escapeHtml(to)} = ${window.escapeHtml(fmtReverse)} ${window.escapeHtml(from)}</span>
      </div>
      <div class="cx-footer">via <a class="cx-footer-link" href="https://github.com/fawazahmed0/exchange-api" target="_blank" rel="noopener noreferrer">Free Currency API · fawazahmed0</a></div>
    `;
    return card;
  }
  _fmt(value, code) {
    const upper = code.toUpperCase();
    try {
      return new Intl.NumberFormat('en-US', {
        style:                 'currency',
        currency:              upper,
        minimumFractionDigits: 2,
        maximumFractionDigits: value < 1 ? 6 : 2,
      }).format(value);
    } catch {
      const decimals = value < 1 ? 6 : 2;
      return `${value.toFixed(decimals)} ${upper}`;
    }
  }
}
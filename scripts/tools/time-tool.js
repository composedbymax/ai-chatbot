export class TimeTool {
  render(data, toolCall) {
    if (data.error) return window.toolErrorEl(`Time error: ${data.error}`);
    const { location, time } = data;
    const card = document.createElement('div');
    card.className = 'tool-card time-card';
    const rawDatetime = time.datetime;
    const [datePart, timePart] = rawDatetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const timeOnly = timePart.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
    const [hour, minute, secondRaw] = timeOnly.split(':');
    const second = Math.floor(Number(secondRaw));
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${h12}:${pad(minute)}:${pad(second)} ${ampm}`;
    const jsDate = new Date(Date.UTC(year, month - 1, day));
    const dateStr = `${weekdays[jsDate.getUTCDay()]}, ${months[month - 1]} ${day}, ${year}`;
    const dstBadge = time.dst
      ? `<span class="tt-badge tt-dst">DST active</span>`
      : `<span class="tt-badge">Standard time</span>`;
    card.innerHTML = `
      <div class="tt-header">
        <div class="tt-icon">🕐</div>
        <div class="tt-title">
          <div class="tt-city">${window.escapeHtml(location.name)}${location.country ? ', ' + window.escapeHtml(location.country) : ''}</div>
          <div class="tt-tz">${window.escapeHtml(time.timezone)}</div>
        </div>
      </div>
      <div class="tt-main">
        <div class="tt-time">${timeStr}</div>
        <div class="tt-date">${dateStr}</div>
      </div>
      <div class="tt-meta">
        <span class="tt-offset">UTC ${window.escapeHtml(time.utc_offset)}</span>
        <span class="tt-abbr">${window.escapeHtml(time.abbreviation)}</span>
        ${dstBadge}
      </div>
      <div class="tt-footer">via Time.Now • time.now</div>
    `;
    return card;
  }
}
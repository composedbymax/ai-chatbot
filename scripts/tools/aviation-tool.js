export class AviationTool {
  render(data, toolCall) {
    if (data.error) return window.toolErrorEl(`Aviation error: ${data.error}`);
    const flights = data.flights || [];
    if (!flights.length) {
      const empty = document.createElement('div');
      empty.className = 'tool-card aviation-card aviation-empty';
      empty.innerHTML = `
        <div class="av-header">
          <span class="av-title">No flights found</span>
        </div>
        <p class="av-empty-msg">No flight data matched your query. Try a different flight number or airport code.</p>
      `;
      return empty;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'tool-card aviation-card';
    const queryLabel = this._queryLabel(data.query_type, toolCall);
    const headerHTML = `
      <div class="av-header">
        <div class="av-header-text">
          <div class="av-title">${window.escapeHtml(queryLabel)}</div>
          <div class="av-subtitle">${flights.length} flight${flights.length !== 1 ? 's' : ''} found</div>
        </div>
      </div>
    `;
    const flightCards = flights.map(f => this._flightHTML(f)).join('');
    wrapper.innerHTML = headerHTML + `<div class="av-flights">${flightCards}</div>`;
    wrapper.innerHTML += `<div class="av-footer">via AviationStack • real-time data</div>`;
    return wrapper;
  }
  _queryLabel(queryType, toolCall) {
    switch (queryType) {
      case 'flight':    return `Flight ${toolCall.flight_iata || toolCall.flight_icao || ''}`;
      case 'departure': return `Departures from ${toolCall.airport || ''}`;
      case 'arrival':   return `Arrivals at ${toolCall.airport || ''}`;
      case 'airline':   return `${toolCall.airline_iata || ''} Flights`;
      default:          return 'Flight Status';
    }
  }
  _flightHTML(f) {
    const dep = f.departure || {};
    const arr = f.arrival || {};
    const airline = f.airline || {};
    const flight = f.flight || {};
    const live = f.live;
    const hasDelay = (dep.delay && dep.delay > 0) || (arr.delay && arr.delay > 0);
    const rawStatus = f.flight_status || 'unknown';
    const status = (rawStatus === 'scheduled' && hasDelay) ? 'delayed' : rawStatus;
    const depTime = this._formatTime(dep.actual || dep.estimated || dep.scheduled, dep.timezone);
    const arrTime = this._formatTime(arr.actual || arr.estimated || arr.scheduled, arr.timezone);
    const depDelay = (dep.delay && dep.delay > 0) ? `<span class="av-delay">+${dep.delay}m</span>` : '';
    const arrDelay = (arr.delay && arr.delay > 0) ? `<span class="av-delay">+${arr.delay}m</span>` : '';
    const liveSection = (live && !live.is_ground) ? `
      <div class="av-live-bar">
        <span class="av-live-dot"></span>
        <span>LIVE</span>
        <span class="av-live-stat">ALT ${this._fmt(live.altitude, 'ft')}</span>
        <span class="av-live-stat">SPD ${this._fmt(live.speed_horizontal, 'kn')}</span>
        <span class="av-live-stat">HDG ${this._fmt(live.direction, '°')}</span>
      </div>
    ` : '';
    const depGate    = dep.gate     ? `<span class="av-gate">Gate ${window.escapeHtml(dep.gate)}</span>` : '';
    const depTerm    = dep.terminal ? `<span class="av-gate">Term. ${window.escapeHtml(dep.terminal)}</span>` : '';
    const arrGate    = arr.gate     ? `<span class="av-gate">Gate ${window.escapeHtml(arr.gate)}</span>` : '';
    const arrTerm    = arr.terminal ? `<span class="av-gate">Term. ${window.escapeHtml(arr.terminal)}</span>` : '';
    const baggage    = arr.baggage  ? `<span class="av-gate">Belt ${window.escapeHtml(arr.baggage)}</span>` : '';
    const dateBadge  = this._dateBadge(f.flight_date);
    return `
      <div class="av-flight">
        <div class="av-flight-top">
          <div class="av-flight-id">
            <span class="av-flightnum">${window.escapeHtml(flight.iata || flight.icao || '—')}</span>
            <span class="av-airline">${window.escapeHtml(airline.name || airline.airline_name || airline.iata_code || '')}</span>
            ${dateBadge}
          </div>
          <span class="av-status ${this._statusClass(status)}">${this._statusLabel(status)}</span>
        </div>
        <div class="av-route">
          <div class="av-airport">
            <div class="av-iata">${window.escapeHtml(dep.iata || '—')}</div>
            <div class="av-airport-name">${window.escapeHtml(dep.airport || '')}</div>
            <div class="av-time">${depTime}${depDelay}</div>
            <div class="av-meta-row">${depGate}${depTerm}</div>
          </div>
          <div class="av-route-line">
            <div class="av-route-dot"></div>
            <div class="av-route-track"></div>
            <div class="av-route-plane">✈</div>
            <div class="av-route-track"></div>
            <div class="av-route-dot"></div>
          </div>
          <div class="av-airport av-airport-right">
            <div class="av-iata">${window.escapeHtml(arr.iata || '—')}</div>
            <div class="av-airport-name">${window.escapeHtml(arr.airport || '')}</div>
            <div class="av-time">${arrTime}${arrDelay}</div>
            <div class="av-meta-row">${arrGate}${arrTerm}${baggage}</div>
          </div>
        </div>
        ${liveSection}
      </div>
    `;
  }
  _statusClass(status) {
    return {
      active:    'av-status-active',
      scheduled: 'av-status-scheduled',
      delayed:   'av-status-delayed',
      landed:    'av-status-landed',
      cancelled: 'av-status-cancelled',
      incident:  'av-status-incident',
      diverted:  'av-status-diverted',
    }[status] || 'av-status-unknown';
  }
  _statusLabel(status) {
    return {
      active:    '▲ In Flight',
      scheduled: '◷ Scheduled',
      delayed:   '⚠ Delayed',
      landed:    '✓ Landed',
      cancelled: '✕ Cancelled',
      incident:  '⚠ Incident',
      diverted:  '↺ Diverted',
      unknown:   '? Unknown',
    }[status] || status;
  }
  _formatTime(isoStr, ianaTimezone) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d)) return '—';
      const opts = { hour: 'numeric', minute: '2-digit', hour12: true };
      if (ianaTimezone) opts.timeZone = ianaTimezone;
      return d.toLocaleTimeString([], opts);
    } catch {
      return '—';
    }
  }
  _dateBadge(dateStr) {
    if (!dateStr) return '';
    const todayUTC = new Date().toISOString().slice(0, 10);
    const yest = new Date();
    yest.setUTCDate(yest.getUTCDate() - 1);
    const yesterdayUTC = yest.toISOString().slice(0, 10);
    if (dateStr === todayUTC) return '';
    const label = dateStr === yesterdayUTC
      ? 'Yesterday'
      : new Date(dateStr + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `<span class="av-gate">${label}</span>`;
  }
  _fmt(val, unit) {
    if (val == null) return '—';
    return `${Math.round(val)}${unit}`;
  }
}
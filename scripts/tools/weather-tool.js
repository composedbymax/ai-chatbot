export class WeatherTool {
  render(data, toolCall) {
    if (data.error) return window.toolErrorEl(`Weather error: ${data.error}`);
    const { location, weather } = data;
    const w = weather.current_weather;
    const hourly = weather.hourly || {};
    const card = document.createElement('div');
    card.className = 'tool-card weather-card';
    const desc = this._wmoDescription(w.weathercode);
    const icon = this._wmoIcon(w.weathercode, w.is_day);
    const windDir = this._windDirection(w.winddirection);
    let highLow = '';
    if (hourly.temperature_2m && hourly.temperature_2m.length) {
      const todayTemps = hourly.temperature_2m.slice(0, 24);
      const high = Math.max(...todayTemps).toFixed(1);
      const low = Math.min(...todayTemps).toFixed(1);
      highLow = `<span class="wt-range">H: ${high}° &nbsp; L: ${low}°</span>`;
    }
    let hourlyBars = '';
    if (hourly.temperature_2m && hourly.time) {
      const now = new Date();
      const nowHour = now.getHours();
      const next12 = [];
      for (let i = 0; i < hourly.time.length && next12.length < 12; i++) {
        const t = new Date(hourly.time[i]);
        if (t >= now) next12.push({ time: t, temp: hourly.temperature_2m[i] });
      }
      if (next12.length) {
        const temps = next12.map(p => p.temp);
        const minT = Math.min(...temps);
        const maxT = Math.max(...temps);
        const range = maxT - minT || 1;
        hourlyBars = `
          <div class="wt-hourly">
            <div class="wt-hourly-label">Next 12 hours</div>
            <div class="wt-bars">
              ${next12.map(p => {
                const pct = ((p.temp - minT) / range) * 70 + 15;
                const hr = p.time.getHours();
                const label = hr === 0 ? '12a' : hr < 12 ? `${hr}a` : hr === 12 ? '12p' : `${hr - 12}p`;
                return `<div class="wt-bar-col">
                  <div class="wt-temp-dot" style="bottom:${pct}%" title="${p.temp}°"></div>
                  <div class="wt-bar-line" style="height:${pct}%"></div>
                  <div class="wt-bar-time">${label}</div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
      }
    }
    card.innerHTML = `
      <div class="wt-header">
        <div class="wt-icon">${icon}</div>
        <div class="wt-title">
          <div class="wt-city">${window.escapeHtml(location.name)}${location.country ? ', ' + window.escapeHtml(location.country) : ''}</div>
          <div class="wt-desc">${desc}</div>
        </div>
      </div>
      <div class="wt-main">
        <div class="wt-temp">${w.temperature}<span class="wt-unit">°C</span></div>
        <div class="wt-meta">
          ${highLow}
          <span class="wt-wind">💨 ${w.windspeed} km/h ${windDir}</span>
        </div>
      </div>
      ${hourlyBars}
      <div class="wt-footer">via Open-Meteo • open-meteo.com</div>
    `;
    return card;
  }
  _wmoDescription(code) {
    const map = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Icy fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
      95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Thunderstorm + heavy hail'
    };
    return map[code] ?? 'Unknown conditions';
  }
  _wmoIcon(code, isDay) {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code <= 2) return isDay ? '⛅' : '🌤️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return '❄️';
    if (code <= 82) return '🌩️';
    return '⛈️';
  }
  _windDirection(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg / 45) % 8];
  }
}
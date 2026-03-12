export class SettingsModal {
  constructor() {
    this.isOpen = false;
    this.authModalLoaded = false;
    this.accountSVG = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="7.5" r="3.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3.5 19C3.5 15.134 6.91 12 11 12C15.09 12 18.5 15.134 18.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }
  init() {
    this._createGearButton();
    this._createModal();
    this._attachEvents();
  }
  _createGearButton() {
    const tryInject = () => {
      const footer = document.querySelector('.sidebar-footer');
      if (!footer) {
        setTimeout(tryInject, 50);
        return;
      }
      const gear = document.createElement('button');
      gear.id = 'settingsGearBtn';
      gear.className = 'settings-gear-btn';
      gear.setAttribute('aria-label', 'Open settings');
      gear.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"></circle>
          <path d="M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z" stroke="currentColor" stroke-width="1.5"></path>
        </svg>
      `;
      const userDiv = document.getElementById('sidebarUser');
      if (userDiv && !document.getElementById('settingsGearBtn')) {
        footer.style.display = 'flex';
        footer.style.alignItems = 'center';
        footer.style.justifyContent = 'space-between';
        footer.appendChild(gear);
      }
      gear.addEventListener('click', () => this.open());
    };
    tryInject();
  }
  _createModal() {
    const modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-panel">
        <div class="settings-header">
          <div class="settings-header-left">
            <h2>Settings</h2>
          </div>
          <button class="settings-close-btn" id="settingsCloseBtn" aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="settings-body">
          <div class="settings-section">
            <div class="settings-section-label">AI Responses</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-title">Incognito Mode</span>
                <span class="settings-row-desc">Do not save chat history</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="setting-incognito-mode">
                <span class="settings-toggle-track">
                  <span class="settings-toggle-thumb"></span>
                </span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-title">Strip Emojis</span>
                <span class="settings-row-desc">Remove annoying emojis from AI responses</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="setting-strip-emojis">
                <span class="settings-toggle-track">
                  <span class="settings-toggle-thumb"></span>
                </span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-title">Auto Model Selection</span>
                <span class="settings-row-desc">System automatically picks a model</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="setting-auto-model">
                <span class="settings-toggle-track">
                  <span class="settings-toggle-thumb"></span>
                </span>
              </label>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">Tools &amp; Performance</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-title">Enable Tools</span>
                <span class="settings-row-desc">Allow AI to use integrated tools during responses</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="setting-tools-enabled">
                <span class="settings-toggle-track">
                  <span class="settings-toggle-thumb"></span>
                </span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-title">Cache Tool Responses</span>
                <span class="settings-row-desc">Store tool call results to preserve data</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="setting-cache-tools">
                <span class="settings-toggle-track">
                  <span class="settings-toggle-thumb"></span>
                </span>
              </label>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">Account</div>
            <div class="settings-account-card" id="settingsAccountCard">
              ${this._renderAccountCard()}
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  _renderAccountCard() {
    const loggedIn = window.userLoggedIn;
    const role = window.userRole;
    const name = window.userName;
    const svg = this.accountSVG;
    const roleMeta = {
      basic:   { cls: 'basic',   badge: 'Basic',      action: { href: '/upgrade', text: 'Upgrade', cls: 'upgrade' } },
      premium: { cls: 'premium', badge: '✦ Premium' },
      admin:   { cls: 'admin',   badge: '⬡ Admin' }
    };
    if (!loggedIn || !name) {
      return `
        <div class="account-status guest">
          <div class="account-status-icon">${svg}</div>
          <div class="account-status-text">
            <span class="account-status-name">Guest</span>
            <span class="account-status-detail">Not signed in</span>
          </div>
          <button class="account-action-btn" id="settingsSignInBtn">Sign In</button>
        </div>
      `;
    }
    const meta = roleMeta[role] || { cls: 'guest', badge: null };
    const badgeHtml = meta.badge ? `<span class="account-status-badge ${meta.cls}-badge">${meta.badge}</span>` : '';
    const actionHtml = meta.action ? `<a href="${meta.action.href}" class="account-action-btn ${meta.action.cls || ''}">${meta.action.text}</a>` : '';
    const iconExtraClass = (meta.cls === 'premium' || meta.cls === 'admin') ? `${meta.cls}-icon` : '';
    return `
      <div class="account-status ${meta.cls}">
        <div class="account-status-icon ${iconExtraClass}">${svg}</div>
        <div class="account-status-text">
          <span class="account-status-name">${this._escapeHtml(name)}</span>
          ${badgeHtml}
        </div>
        ${actionHtml}
      </div>
    `;
  }
  async _loadAuthModal() {
    if (this.authModalLoaded) {
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.style.display = 'block';
      return;
    }
    try {
      const res = await fetch('/auth/modal.php', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load auth modal: ${res.status}`);
      const html = await res.text();
      const container = document.createElement('div');
      container.id = 'authModalContainer';
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const scripts = [...temp.querySelectorAll('script')];
      scripts.forEach(s => s.remove());
      container.innerHTML = temp.innerHTML;
      document.body.appendChild(container);
      const form = container.querySelector('form');
      if (form) {
        form.action = '/auth/modal.php?redirect=/chat/';
        form.method = 'POST';
      }
      const registerLink = container.querySelector('.register-link a');
      if (registerLink) {
        registerLink.href = '/auth?redirect=/chat/';
      }
      const authModal = document.getElementById('authModal');
      const closeButton = container.querySelector('#authClose');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          if (authModal) authModal.style.display = 'none';
        });
      }
      if (authModal) {
        authModal.addEventListener('click', (e) => {
          if (e.target === authModal) authModal.style.display = 'none';
        });
      }
      this.authModalLoaded = true;
      if (authModal) authModal.style.display = 'block';
      for (const oldScript of scripts) {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          await new Promise((resolve, reject) => {
            newScript.src = oldScript.src;
            newScript.onload = resolve;
            newScript.onerror = reject;
            document.body.appendChild(newScript);
          });
        } else {
          newScript.textContent = oldScript.textContent;
          document.body.appendChild(newScript);
        }
      }
    } catch (err) {
      console.error('Auth modal load error:', err);
    }
  }
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  _attachEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'settingsCloseBtn' || e.target.closest('#settingsCloseBtn')) {
        this.close();
      }
      if (e.target.classList.contains('settings-overlay')) {
        this.close();
      }
      if (e.target.id === 'settingsSignInBtn') {
        this.close();
        this._loadAuthModal();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
    const toggleIds = [
      'setting-incognito-mode',
      'setting-strip-emojis',
      'setting-auto-model',
      'setting-tools-enabled',
      'setting-cache-tools'
    ];
    toggleIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = localStorage.getItem(id) === 'true';
    });
    document.addEventListener('change', (e) => {
      if (e.target.matches('.settings-toggle input[type="checkbox"]')) {
        localStorage.setItem(e.target.id, e.target.checked);
      }
    });
  }
  open() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (document.body.classList.contains('sidebar-open')) {
      document.body.classList.remove('sidebar-open');
      if (sidebarToggle) sidebarToggle.classList.remove('open');
    }
    const card = document.getElementById('settingsAccountCard');
    if (card) card.innerHTML = this._renderAccountCard();
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.classList.add('show');
    this.isOpen = true;
    const app = document.getElementById('app');
    if (app) app.classList.add('settings-blurred');
  }
  close() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.classList.remove('show');
    this.isOpen = false;
    const app = document.getElementById('app');
    if (app) app.classList.remove('settings-blurred');
  }
  static getSetting(id) {
    return localStorage.getItem(id) === 'true';
  }
}
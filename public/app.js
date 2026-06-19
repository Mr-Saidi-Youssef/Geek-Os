// State Management
let currentType = 'movie';
let debounceTimer;

let currentResults = [];
let activeSort = 'default';
let localFilter = '';
let currentSuggestions = [];
let highlightedSuggestionIndex = -1;

// Modal session configurations
let activeItem = null;
let userStatus = 'Inbox';
let isDisconnecting = false;

// Safe localStorage access wrapper for Notion embeds (prevents SecurityError crash in sandboxed iframes)
function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage access denied:', e);
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage write denied:', e);
  }
}

const UI = {
  tabs: document.querySelectorAll('.tab-btn'),
  tabsContainer: document.getElementById('nav-tabs'),
  breadcrumbActive: document.getElementById('breadcrumb-active'),
  searchInput: document.getElementById('search-input'),
  clearBtn: document.getElementById('clear-btn'),
  loadingSpinner: document.getElementById('loading-spinner'),
  emptyState: document.getElementById('empty-state'),
  resultsGrid: document.getElementById('results-grid')
};

// --- Premium Loading Progress Bar Helpers ---
let loadingBarTimeout1, loadingBarTimeout2;

function startLoadingBar() {
  const bar = document.getElementById('top-progress-bar');
  if (bar) {
    clearTimeout(loadingBarTimeout1);
    clearTimeout(loadingBarTimeout2);
    bar.style.display = 'block';
    bar.style.width = '0%';
    loadingBarTimeout1 = setTimeout(() => { bar.style.width = '35%'; }, 50);
    loadingBarTimeout2 = setTimeout(() => { bar.style.width = '75%'; }, 700);
  }
}

function finishLoadingBar() {
  const bar = document.getElementById('top-progress-bar');
  if (bar) {
    clearTimeout(loadingBarTimeout1);
    clearTimeout(loadingBarTimeout2);
    bar.style.width = '100%';
    setTimeout(() => {
      bar.style.display = 'none';
      bar.style.width = '0%';
    }, 400);
  }
}

function resetLoadingBar() {
  const bar = document.getElementById('top-progress-bar');
  if (bar) {
    clearTimeout(loadingBarTimeout1);
    clearTimeout(loadingBarTimeout2);
    bar.style.display = 'none';
    bar.style.width = '0%';
  }
}

// Placeholders for search input based on selected tab
const PLACEHOLDERS = {
  movie: 'Search for a movie title... (e.g. Inception)',
  tv: 'Search for a TV show or series... (e.g. Breaking Bad)',
  book: 'Search for a book title... (e.g. The Hobbit)',
  anime: 'Search for an anime... (e.g. Frieren)',
  manga: 'Search for a manga... (e.g. Monster)',
  game: 'Search for a video game... (e.g. Portal 2)',
  comic: 'Search for a comic or graphic novel... (e.g. Watchmen)'
};

  // Emoji icons for tab categories (unused, outline SVGs are used instead)
  const TYPE_EMOJIS = {};

// SVG Icon outline helper
function getCategorySvg(type, className = "tab-icon-svg") {
  const svgs = {
    movie: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`,
    tv: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
    book: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    anime: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    manga: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    game: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="3"></rect></svg>`,
    comic: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`
  };
  return svgs[type] || svgs.movie;
}

// Type mappings to handle plural/alternative query values
const TYPE_MAPPING = {
  movie: 'movie',
  movies: 'movie',
  tv: 'tv',
  series: 'tv',
  show: 'tv',
  shows: 'tv',
  book: 'book',
  books: 'book',
  anime: 'anime',
  manga: 'manga',
  game: 'game',
  games: 'game',
  comic: 'comic',
  comics: 'comic'
};

const CATEGORY_NAMES = {
  movie: 'Movie',
  tv: 'Series',
  book: 'Book',
  anime: 'Anime',
  manga: 'Manga',
  game: 'Game',
  comic: 'Comic'
};

const PLURAL_NAMES = {
  movie: 'movies',
  tv: 'series',
  book: 'books',
  anime: 'anime',
  manga: 'manga',
  game: 'games',
  comic: 'comics'
};

// Plain language error mapping helper
function friendlyErrorMessage(errText) {
  if (!errText) return 'An unexpected error occurred. Please try again.';
  const lower = errText.toLowerCase();
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('token')) {
    return 'Notion authentication failed or token has expired. Please disconnect and reconnect your workspace.';
  }
  if (lower.includes('400') || lower.includes('bad request') || lower.includes('validation')) {
    return 'Invalid request data. Please check your inputs or database mapping configuration.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'Notion database or page could not be found. Please ensure the page is shared with this integration.';
  }
  if (lower.includes('500') || lower.includes('internal') || lower.includes('server error')) {
    return 'Notion server is currently unresponsive. Please try again in a few moments.';
  }
  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('failed to fetch') || lower.includes('offline')) {
    return 'Network connection offline or server unreachable. Please check your internet connection.';
  }
  return errText; // Fallback to raw if not matched
}

// Helper to transition the UI into the unconnected state and display the Connect Notion screen
function showUnconnectedUI(unlicensedMessage = '') {
  clearRecommendationsActive();
  const urlParams = new URLSearchParams(window.location.search);
  const embedType = urlParams.get('type')?.toLowerCase();
  const normalizedType = embedType ? (TYPE_MAPPING[embedType] || embedType) : null;
  const storageKey = normalizedType ? `workspace_id_${normalizedType}` : 'workspace_id';
  // Update status badge
  const statusBadge = document.getElementById('sync-status');
  if (statusBadge) {
    statusBadge.className = 'sync-status unconnected';
    statusBadge.querySelector('.status-text').textContent = 'Notion Setup';
  }

  // Hide settings and disconnect action elements
  const settingsMenuBtn = document.getElementById('settings-menu-btn');
  if (settingsMenuBtn) settingsMenuBtn.style.display = 'none';
  const settingsDropdown = document.getElementById('settings-dropdown');
  if (settingsDropdown) settingsDropdown.style.display = 'none';

  // Hide main search section and navigation tabs
  const searchSection = document.querySelector('.search-section');
  if (searchSection) searchSection.style.display = 'none';
  const navTabs = document.getElementById('nav-tabs');
  if (navTabs) navTabs.style.display = 'none';

  if (!UI.emptyState) return;

  renderConnectNotionScreen('', unlicensedMessage);

  function renderConnectNotionScreen(licenseKey, unlicensedMsg = '') {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
    const loginUrl = `/api/notion/login?session_id=${sessionId}${embedType ? `&type=${encodeURIComponent(embedType)}` : ''}`;

    // ─── SHARED SUCCESS SCREEN ───────────────────────────────────────────────
    function showSuccessScreen(workspaceId, workspaceName) {
      UI.emptyState.innerHTML = `
        <div class="progress-stepper">
          <div class="step-pill done">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Connect Notion
          </div>
          <div class="step-line active"></div>
          <div class="step-pill done">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Connected!
          </div>
        </div>
        <div class="connect-card">
          <div style="font-size:2.4rem; margin-bottom:10px;">✅</div>
          <h3 class="connect-card-title" style="color:var(--green);">Connected!</h3>
          <p class="connect-card-text">${workspaceName ? `<strong>${workspaceName}</strong> linked. ` : ''}Loading your widget…</p>
          <div class="spinner" style="margin-top:14px;"></div>
        </div>
      `;
    }

    function handleSuccessRedirect(workspaceId, workspaceName) {
      showSuccessScreen(workspaceId, workspaceName);
      const targetKey = embedType ? `workspace_id_${TYPE_MAPPING[embedType] || embedType}` : 'workspace_id';
      safeSetLocalStorage(targetKey, workspaceId);
      safeSetLocalStorage('workspace_id', workspaceId);
      setTimeout(() => {
        const targetUrl = `/?workspace_id=${workspaceId}${embedType ? `&type=${embedType}` : ''}`;
        window.location.href = window.location.origin + targetUrl;
      }, 1400);
    }

    // ─── TAB: INTEGRATION TOKEN (Primary — fully inline, no browser redirect) ─
    function renderTokenTab(activeTab) {
      return `
        <div class="ct-tab-bar">
          <button class="ct-tab${activeTab === 'oauth' ? ' ct-tab-active' : ''}" data-tab="oauth">
            🔗 Connect with Notion
            <span class="ct-tab-badge">Recommended</span>
          </button>
          <button class="ct-tab${activeTab === 'token' ? ' ct-tab-active' : ''}" data-tab="token">
            🔑 Integration Token
          </button>
        </div>

        <div class="ct-panel" id="ct-panel-token" style="${activeTab !== 'token' ? 'display:none;' : ''}">
          <div class="ct-steps">
            <div class="ct-step">
              <div class="ct-step-num">1</div>
              <div class="ct-step-body">
                <div class="ct-step-label">Create an integration</div>
                <div class="ct-step-desc">Go to <a href="https://www.notion.so/profile/integrations" target="_blank" class="auth-manual-link">notion.so/profile/integrations</a>, create a new integration, give it a name, and copy the <strong>Internal Integration Secret</strong>.</div>
              </div>
            </div>
            <div class="ct-step">
              <div class="ct-step-num">2</div>
              <div class="ct-step-body">
                <div class="ct-step-label">Share pages with the integration</div>
                <div class="ct-step-desc">In Notion, open the pages/databases you want to use → click the <strong>···</strong> menu → <strong>Connect to</strong> → select your integration.</div>
              </div>
            </div>
            <div class="ct-step">
              <div class="ct-step-num">3</div>
              <div class="ct-step-body">
                <div class="ct-step-label">Paste your token below</div>
                <div class="ct-step-desc">Paste the secret token (starts with <code>secret_</code>) and click Connect.</div>
              </div>
            </div>
          </div>

          ${unlicensedMsg ? `<div class="error-banner-alert" style="margin-bottom:12px;">⚠️ ${friendlyErrorMessage(unlicensedMsg)}</div>` : ''}

          <div class="ct-token-row">
            <input
              id="ct-token-input"
              type="password"
              class="ct-token-input"
              placeholder="secret_xxxxxxxxxxxxxxxxxxxx"
              autocomplete="off"
              spellcheck="false"
            />
            <button id="ct-token-toggle" class="ct-eye-btn" title="Show/hide token" type="button">
              <svg id="ct-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </div>
          <div id="ct-token-error" class="ct-error" style="display:none;"></div>
          <button id="ct-connect-btn" class="connect-button-link" style="width:100%; justify-content:center; margin-top:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            Connect Notion
          </button>
        </div>

        <div class="ct-panel" id="ct-panel-oauth" style="${activeTab !== 'oauth' ? 'display:none;' : ''}">
          <div id="ct-oauth-initial">
            <p class="connect-card-text" style="margin-bottom:16px;">
              Click the button below to link your Notion workspace. A window will open for you to choose the databases/pages you want to sync.
            </p>
            ${unlicensedMsg ? `<div class="error-banner-alert" style="margin-bottom:12px;">⚠️ ${friendlyErrorMessage(unlicensedMsg)}</div>` : ''}
            <a id="ct-oauth-btn" href="${loginUrl}" class="connect-button-link" style="width:100%; justify-content:center; display:flex; border:none; cursor:pointer; text-decoration:none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Connect with Notion
            </a>
          </div>
          <div id="ct-oauth-waiting" style="display:none; text-align:center; padding: 10px 0;">
            <div class="spinner" style="margin: 0 auto 12px;"></div>
            <div class="connect-card-text" id="ct-oauth-status" style="margin-bottom:12px; font-weight:500;">
              Waiting for Notion authorization...
            </div>
            <p class="connect-card-text" style="font-size:11px; margin-bottom:16px; color:var(--text-muted);">
              Please complete the authorization in the popup window. If it didn't open, click the button below.
            </p>
            <div style="display:flex; gap:8px;">
              <button id="ct-oauth-reopen" class="btn-secondary" style="flex:1; font-size:11px; padding:6px; margin:0;">Reopen Window</button>
              <button id="ct-oauth-cancel" class="btn-secondary" style="flex:1; font-size:11px; padding:6px; margin:0;">Cancel</button>
            </div>
          </div>
        </div>
      `;
    }

    // ─── MAIN RENDER ─────────────────────────────────────────────────────────
    function showConnectCard(activeTab = 'token') {
      UI.emptyState.innerHTML = `
        <div class="progress-stepper">
          <div class="step-pill active"><span class="step-number">1</span> Connect Notion</div>
          <div class="step-line"></div>
          <div class="step-pill"><span class="step-number">2</span> Map Databases</div>
        </div>
        <div class="connect-card" style="padding: 20px 16px 24px; gap: 0;">
          <div class="connect-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="notion-logo-svg notion-icon-large"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>
          </div>
          <h3 class="connect-card-title">Connect Notion Workspace</h3>
          <div id="ct-container" style="width:100%; margin-top:12px;">
            ${renderTokenTab(activeTab)}
          </div>
        </div>
      `;

      wireConnectCard();
    }

    // ─── EVENT WIRING ────────────────────────────────────────────────────────
    let pollingActive = false;
    let pollAttempts = 0;
    let pollTimer = null;
    let messageHandler = null;

    function stopPolling() {
      pollingActive = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (messageHandler) {
        window.removeEventListener('message', messageHandler);
        messageHandler = null;
      }
    }

    function wireConnectCard() {
      // Tab switching
      UI.emptyState.querySelectorAll('.ct-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          stopPolling();
          showConnectCard(tab.dataset.tab);
        });
      });

      // ── Token tab ──
      const tokenInput = document.getElementById('ct-token-input');
      const connectBtn = document.getElementById('ct-connect-btn');
      const errorEl = document.getElementById('ct-token-error');
      const toggleBtn = document.getElementById('ct-token-toggle');

      if (toggleBtn && tokenInput) {
        toggleBtn.addEventListener('click', () => {
          tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
        });
      }

      if (connectBtn && tokenInput) {
        async function doTokenConnect() {
          const token = tokenInput.value.trim();
          if (!token) {
            showError('Please paste your Notion integration token.');
            return;
          }
          if (!token.startsWith('secret_')) {
            showError('Token should start with "secret_". Check you copied the full token.');
            return;
          }

          // Loading state
          connectBtn.disabled = true;
          connectBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div> Connecting…';
          if (errorEl) errorEl.style.display = 'none';

          try {
            const res = await fetch('/api/notion/connect-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, type: embedType || undefined })
            });
            const data = await res.json();
            if (res.ok && data.success) {
              handleSuccessRedirect(data.workspace_id, data.workspaceName);
            } else {
              showError(data.error || 'Connection failed. Please try again.');
              connectBtn.disabled = false;
              connectBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Connect Notion`;
            }
          } catch (err) {
            showError('Network error. Check your connection and try again.');
            connectBtn.disabled = false;
            connectBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Connect Notion`;
          }
        }

        connectBtn.addEventListener('click', doTokenConnect);
        tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') doTokenConnect(); });
      }

      function showError(msg) {
        if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
      }
      // ── OAuth tab ──
      const oauthBtn = document.getElementById('ct-oauth-btn');
      const oauthInitial = document.getElementById('ct-oauth-initial');
      const oauthWaiting = document.getElementById('ct-oauth-waiting');
      const oauthReopen = document.getElementById('ct-oauth-reopen');
      const oauthCancel = document.getElementById('ct-oauth-cancel');
      const oauthStatus = document.getElementById('ct-oauth-status');

      let oauthWindow = null;

      function startOauthFlow() {
        stopPolling();
        
        if (oauthInitial) oauthInitial.style.display = 'none';
        if (oauthWaiting) oauthWaiting.style.display = 'block';
        if (oauthStatus) oauthStatus.textContent = 'Waiting for Notion authorization...';

        console.log(`Starting OAuth Flow with session_id: ${sessionId}`);

        // Start polling
        pollingActive = true;
        pollAttempts = 0;
        pollSession();
      }

      function pollSession() {
        if (!pollingActive) return;

        pollAttempts++;
        if (pollAttempts > 160) { // Timeout after ~4 minutes
          stopPolling();
          if (oauthStatus) oauthStatus.textContent = 'Connection timed out. Please try again.';
          setTimeout(() => {
            if (oauthInitial) oauthInitial.style.display = 'block';
            if (oauthWaiting) oauthWaiting.style.display = 'none';
          }, 2000);
          return;
        }

        console.log(`Polling session status (attempt ${pollAttempts})...`);
        fetch(`/api/notion/poll-session?session_id=${sessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.status === 'resolved' && data.workspaceId) {
              console.log('Session resolved! Connecting...');
              stopPolling();
              if (oauthWindow && !oauthWindow.closed) {
                oauthWindow.close();
              }
              handleSuccessRedirect(data.workspaceId, '');
            } else {
              // Schedule next poll
              pollTimer = setTimeout(pollSession, 1500);
            }
          })
          .catch(err => {
            console.error('Error polling session:', err);
            pollTimer = setTimeout(pollSession, 3000);
          });
      }

      if (oauthBtn) {
        oauthBtn.addEventListener('click', () => {
          // Do not prevent default! Let the relative link navigate naturally
          startOauthFlow();
        });
      }

      if (oauthReopen) {
        oauthReopen.addEventListener('click', () => {
          if (oauthWindow && !oauthWindow.closed) {
            oauthWindow.focus();
          } else {
            const width = 600;
            const height = 750;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            oauthWindow = window.open(
              loginUrl, 
              'NotionAuth', 
              `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
            );
            if (oauthWindow) oauthWindow.focus();
          }
        });
      }

      if (oauthCancel) {
        oauthCancel.addEventListener('click', () => {
          stopPolling();
          if (oauthWindow && !oauthWindow.closed) {
            oauthWindow.close();
          }
          if (oauthInitial) oauthInitial.style.display = 'block';
          if (oauthWaiting) oauthWaiting.style.display = 'none';
        });
      }

      // Also listen to postMessage from the popup
      messageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data && event.data.type === 'setup_success') {
          console.log('Received setup_success postMessage:', event.data);
          stopPolling();
          if (oauthWindow && !oauthWindow.closed) {
            oauthWindow.close();
          }
          handleSuccessRedirect(event.data.workspaceId, '');
        }
      };

      window.addEventListener('message', messageHandler);
    }

    // Kick off rendering — OAuth is the primary tab
    showConnectCard('oauth');
  }
}

// Helper to show the category authorization UI when a workspace is linked but lacks this category
function showAuthorizeCategoryUI(categoryType) {
  clearRecommendationsActive();
  const urlParams = new URLSearchParams(window.location.search);
  const normalizedType = TYPE_MAPPING[categoryType] || categoryType;
  const catName = CATEGORY_NAMES[normalizedType] || categoryType;
  // category emoji is not used

  // Hide settings and disconnect action elements
  const settingsMenuBtn = document.getElementById('settings-menu-btn');
  if (settingsMenuBtn) settingsMenuBtn.style.display = 'none';
  const settingsDropdown = document.getElementById('settings-dropdown');
  if (settingsDropdown) settingsDropdown.style.display = 'none';

  // Hide main search section and navigation tabs
  const searchSection = document.querySelector('.search-section');
  if (searchSection) searchSection.style.display = 'none';
  const navTabs = document.getElementById('nav-tabs');
  if (navTabs) navTabs.style.display = 'none';

  if (!UI.emptyState) return;

  const sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
  const loginUrl = `/api/notion/login?session_id=${sessionId}&type=${encodeURIComponent(normalizedType)}`;

  UI.emptyState.innerHTML = `
    <!-- Onboarding Stepper Map -->
    <div class="progress-stepper" id="onboarding-stepper">
      <div class="step-pill done">
        <span class="step-number">✓</span> Connect Notion
      </div>
      <div class="step-line active"></div>
      <div class="step-pill active">
        <span class="step-number">2</span> Map Databases
      </div>
    </div>

    <div class="connect-card">
      <div class="connect-card-icon">${getCategorySvg(normalizedType, 'notion-logo-svg notion-icon-large')}</div>
      <h3 class="connect-card-title">Authorize ${catName} Adder</h3>
      <p class="connect-card-text">
        Your Notion workspace is connected, but this category (<strong>${catName}</strong>) has not been authorized yet.
      </p>
      
      <div class="connect-actions-container">
        <a id="connect-btn" href="${loginUrl}" class="connect-button-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Authorize Category
        </a>
      </div>

      <div class="connect-card-tip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="color: #d97706; vertical-align: text-bottom; margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> <strong>Note:</strong> This will add the ${catName} category to your existing Notion connection.
      </div>
    </div>
  `;

  // Start polling just like in normal connect flow
  const connectBtn = document.getElementById('connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      let pollAttempts = 0;
      let isPolling = true;

      async function poll() {
        if (!isPolling) return;
        pollAttempts++;
        if (pollAttempts > 45) return;

        try {
          const res = await fetch(`/api/notion/poll-session?session_id=${sessionId}`);
          const data = await res.json();
          if (data.status === 'resolved' && data.workspaceId) {
            isPolling = false;
            const targetKey = `workspace_id_${normalizedType}`;
            safeSetLocalStorage(targetKey, data.workspaceId);
            safeSetLocalStorage('workspace_id', data.workspaceId);
            const targetUrl = `/?workspace_id=${data.workspaceId}&type=${normalizedType}`;
            window.location.href = window.location.origin + targetUrl;
            return;
          }
        } catch (err) {
          console.warn('Error polling auth session:', err);
        }

        let delay = 3000;
        if (pollAttempts > 20) delay = 10000;
        setTimeout(poll, delay);
      }
      setTimeout(poll, 1500);
    });
  }
}

// Helper to show the category authorization UI inline inside the empty-state container (for tab clicks)
function showInlineAuthorizeCategoryUI(categoryType) {
  clearRecommendationsActive();
  console.log(`[DEBUG] showInlineAuthorizeCategoryUI called with categoryType:`, categoryType);
  console.log(`[DEBUG] Call stack:`, new Error().stack);
  if (!UI.emptyState) return;

  const normalizedType = TYPE_MAPPING[categoryType] || categoryType;
  const catName = CATEGORY_NAMES[normalizedType] || categoryType;
  // category emoji is not used

  const sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
  const loginUrl = `/api/notion/login?session_id=${sessionId}&type=${encodeURIComponent(normalizedType)}`;

  UI.emptyState.style.display = 'flex';
  UI.emptyState.innerHTML = `
    <div class="connect-card">
      <div class="connect-card-icon">${getCategorySvg(normalizedType, 'notion-logo-svg notion-icon-large')}</div>
      <h3 class="connect-card-title">Authorize ${catName} Adder</h3>
      <p class="connect-card-text">
        This category (<strong>${catName}</strong>) has not been authorized yet.
      </p>
      
      <div class="connect-actions-container">
        <a id="tab-connect-btn" href="${loginUrl}" class="connect-button-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Authorize ${catName}
        </a>
      </div>

      <div class="connect-card-tip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="color: #d97706; vertical-align: text-bottom; margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> <strong>Note:</strong> This will add the ${catName} category to your existing Notion connection.
      </div>
    </div>
  `;

  // Start polling just like in normal connect flow
  const connectBtn = document.getElementById('tab-connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      let pollAttempts = 0;
      let isPolling = true;

      async function poll() {
        if (!isPolling) return;
        pollAttempts++;
        if (pollAttempts > 45) return;

        try {
          const res = await fetch(`/api/notion/poll-session?session_id=${sessionId}`);
          const data = await res.json();
          if (data.status === 'resolved' && data.workspaceId) {
            isPolling = false;
            const targetKey = `workspace_id_${normalizedType}`;
            safeSetLocalStorage(targetKey, data.workspaceId);
            safeSetLocalStorage('workspace_id', data.workspaceId);
            // Reload with the same category selected
            const urlParams = new URLSearchParams(window.location.search);
            const embedType = urlParams.get('type')?.toLowerCase();
            const targetUrl = `/?workspace_id=${data.workspaceId}${embedType ? `&type=${embedType}` : ''}`;
            window.location.href = window.location.origin + targetUrl;
            return;
          }
        } catch (err) {
          console.warn('Error polling auth session:', err);
        }

        let delay = 3000;
        if (pollAttempts > 20) delay = 10000;
        setTimeout(poll, delay);
      }
      setTimeout(poll, 1500);
    });
  }
}

// Helper to show the category database mapping UI inline inside the empty-state container (for tab clicks)
function showInlineMapCategoryUI(categoryType, workspaceId, allowedCategories = ['all']) {
  clearRecommendationsActive();
  if (!UI.emptyState) return;

  const normalizedType = TYPE_MAPPING[categoryType] || categoryType;
  const catName = CATEGORY_NAMES[normalizedType] || categoryType;
  // category emoji is not used

  UI.emptyState.style.display = 'flex';
  UI.emptyState.innerHTML = `
    <!-- Onboarding Stepper Map -->
    <div class="progress-stepper" id="onboarding-stepper">
      <div class="step-pill done">
        <span class="step-number">✓</span> Connect Notion
      </div>
      <div class="step-line active"></div>
      <div class="step-pill active">
        <span class="step-number">2</span> Map Databases
      </div>
    </div>

    <div class="connect-card">
      <div class="connect-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="notion-logo-svg notion-icon-large"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>
      <h3 class="connect-card-title">Map ${catName} Database</h3>
      <p class="connect-card-text">
        This category (<strong>${catName}</strong>) has not been mapped to a Notion database yet.
      </p>
      
      <div class="connect-actions-container">
        <button id="tab-map-btn" class="connect-button-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Configure Mapping
        </button>
      </div>

      <div class="connect-card-tip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="color: #d97706; vertical-align: text-bottom; margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> <strong>Note:</strong> Select your ${catName} database in the settings panel and click save to start adding items.
      </div>
    </div>
  `;

  const mapBtn = document.getElementById('tab-map-btn');
  if (mapBtn) {
    mapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSettingsModal(workspaceId, allowedCategories);
    });
  }
}

// --- Focus Trapping Helpers for Accessibility ---
const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
let originalFocusedElement = null;

function trapFocus(modalElement) {
  originalFocusedElement = document.activeElement;
  
  const focusableContent = modalElement.querySelectorAll(focusableElements);
  if (focusableContent.length === 0) return;
  
  const firstFocusableElement = focusableContent[0];
  const lastFocusableElement = focusableContent[focusableContent.length - 1];
  
  // Focus first focusable element
  setTimeout(() => {
    firstFocusableElement.focus();
  }, 100);

  modalElement.onkeydown = function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
          e.preventDefault();
        }
      }
    }
  };
}

function releaseFocus() {
  if (originalFocusedElement) {
    originalFocusedElement.focus();
    originalFocusedElement = null;
  }
}

// Initialize listeners
async function init() {
  // Check if we are inside an iframe
  if (window.self !== window.top) {
    document.body.classList.add('is-embedded');
  }

  // Initialize Theme (apply saved theme or default to system preference, update toggle icon)
  let savedTheme = safeGetLocalStorage('theme');
  if (!savedTheme) {
    savedTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeToggle = document.getElementById('theme-toggle');
    themeToggle.setAttribute('title', savedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      safeSetLocalStorage('theme', newTheme);
      themeToggle.setAttribute('title', newTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    });

  // Check URL parameter for dedicated mode
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type')?.toLowerCase();
  const normalizedType = typeParam ? (TYPE_MAPPING[typeParam] || typeParam) : null;
  const storageKey = normalizedType ? `workspace_id_${normalizedType}` : 'workspace_id';

  let workspaceId = urlParams.get('workspace_id');
  if (!workspaceId) {
    workspaceId = safeGetLocalStorage(storageKey);
    if (!workspaceId && normalizedType) {
      // Fallback/migration from old generic key
      workspaceId = safeGetLocalStorage('workspace_id');
      if (workspaceId && workspaceId !== 'null') {
        safeSetLocalStorage(storageKey, workspaceId);
      }
    }
  }
  if (workspaceId === 'null') workspaceId = null;

  // Listen for popup messages from setup window
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'setup_success' || event.data?.type === 'setup_started') {
      isDisconnecting = true;
      if (event.data.workspaceId) {
        safeSetLocalStorage(storageKey, event.data.workspaceId);
        safeSetLocalStorage('workspace_id', event.data.workspaceId);
        window.location.reload();
      } else {
        try {
          localStorage.removeItem(storageKey);
          localStorage.removeItem('workspace_id');
        } catch (_) {}
        const url = new URL(window.location.href);
        url.searchParams.delete('workspace_id');
        window.location.href = url.toString();
      }
    }
  });

  // Failsafe: storage listener + polling to handle cases where window.opener is null
  window.addEventListener('storage', (e) => {
    if (isDisconnecting) return;
    if (e.key === storageKey) {
      const current = safeGetLocalStorage(storageKey);
      if (!current) {
        isDisconnecting = true;
        const url = new URL(window.location.href);
        url.searchParams.delete('workspace_id');
        window.location.href = url.toString();
      } else {
        window.location.reload();
      }
    }
  });



  // Global Keydown handler for Escape to Close Details Modal and Lightbox
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('details-modal');
      if (modal && modal.style.display === 'flex') {
        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) closeBtn.click();
      }
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal && settingsModal.style.display === 'flex') {
        const closeBtn = document.getElementById('settings-close-btn');
        if (closeBtn) closeBtn.click();
      }
      const lightbox = document.getElementById('video-lightbox');
      if (lightbox && lightbox.style.display === 'flex') {
        const lightboxClose = document.getElementById('lightbox-close-btn');
        if (lightboxClose) lightboxClose.click();
      }
    }
  });

  if (!workspaceId) {
    // Check if we are running in local single-user mode (no OAuth client ID config)
    try {
      const res = await fetch('/api/notion/config');
      const cfg = await res.json().catch(() => ({}));
      if (cfg.localMode) {
        setupNormalUI(urlParams, ['all'], {}, true);
        return;
      }
    } catch (_) {}

    showUnconnectedUI();
    return;
  }

  // If workspace_id is provided in URL, persist it
  if (urlParams.get('workspace_id')) {
    safeSetLocalStorage(storageKey, urlParams.get('workspace_id'));
    safeSetLocalStorage('workspace_id', urlParams.get('workspace_id'));
  }

  // Failsafe: storage polling to handle cases where window.opener is null
  const initialStoredWorkspaceId = safeGetLocalStorage(storageKey);
  setInterval(() => {
    if (isDisconnecting) return;
    const currentStored = safeGetLocalStorage(storageKey);
    if (currentStored !== initialStoredWorkspaceId) {
      if (!currentStored) {
        isDisconnecting = true;
        const url = new URL(window.location.href);
        url.searchParams.delete('workspace_id');
        window.location.href = url.toString();
      } else {
        window.location.reload();
      }
    }
  }, 1000);

  // Retrieve allowedCategories and mappings from config
  let allowedCategories = ['all'];
  let databaseMappings = {};
  let isLocalMode = false;
  try {
    const res = await fetch(`/api/notion/config?workspace_id=${workspaceId}`);
    if (res.status === 200) {
      const config = await res.json();
      allowedCategories = config.allowedCategories || ['all'];
      databaseMappings = config.databaseMappings || {};
      isLocalMode = !!config.localMode;

      // Check if current category is authorized
      const currentUrlType = urlParams.get('type')?.toLowerCase();
      if (currentUrlType) {
        const normalizedType = TYPE_MAPPING[currentUrlType] || currentUrlType;
        if (!allowedCategories.includes('all') && !allowedCategories.includes(normalizedType)) {
          showAuthorizeCategoryUI(currentUrlType);
          return;
        }
        // Also check if mapped
        if (!isLocalMode && (!databaseMappings || !databaseMappings[normalizedType])) {
          // Hide search section and navigation tabs
          const searchSection = document.querySelector('.search-section');
          if (searchSection) searchSection.style.display = 'none';
          const navTabs = document.getElementById('nav-tabs');
          if (navTabs) navTabs.style.display = 'none';
          
          showInlineMapCategoryUI(currentUrlType, workspaceId, allowedCategories);
          return;
        }
      }
    } else if (res.status === 401) {
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem('workspace_id');
      } catch (_) {}
      showUnconnectedUI();
      return;
    } else {
      showUnconnectedUI();
      return;
    }
  } catch (err) {
    console.error('Error fetching config:', err);
  }

  // Configure settings dropdown toggle and buttons
  const settingsMenuBtn = document.getElementById('settings-menu-btn');
  const settingsDropdown = document.getElementById('settings-dropdown');
  if (settingsMenuBtn && settingsDropdown) {
    settingsMenuBtn.style.display = 'flex';
    
    settingsMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = settingsMenuBtn.getAttribute('aria-expanded') === 'true';
      settingsMenuBtn.setAttribute('aria-expanded', !isExpanded);
      settingsDropdown.style.display = isExpanded ? 'none' : 'flex';
    });

    document.addEventListener('click', (e) => {
      if (!settingsMenuBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
        settingsMenuBtn.setAttribute('aria-expanded', 'false');
        settingsDropdown.style.display = 'none';
      }
    });
  }

  // Configure settings gear button (open inline settings modal instead of a new tab)
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Hide settings dropdown menu first
      const settingsDropdown = document.getElementById('settings-dropdown');
      const settingsMenuBtn = document.getElementById('settings-menu-btn');
      if (settingsDropdown) settingsDropdown.style.display = 'none';
      if (settingsMenuBtn) settingsMenuBtn.setAttribute('aria-expanded', 'false');
      
      openSettingsModal(workspaceId, allowedCategories);
    });
  }

  // Settings modal close/cancel listeners
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const settingsCancelBtn = document.getElementById('settings-cancel-btn');
  if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', () => {
    document.getElementById('settings-modal').style.display = 'none';
  });
  if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', () => {
    document.getElementById('settings-modal').style.display = 'none';
  });

  // Settings modal save listener
  const settingsSaveBtn = document.getElementById('settings-save-btn');
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', () => {
      saveSettingsMappings(workspaceId);
    });
  }

  // Configure disconnect button
  let disconnectTimeout;
  const disconnectBtn = document.getElementById('disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const isConfirmState = disconnectBtn.getAttribute('data-confirm') === 'true';
      if (!isConfirmState) {
        disconnectBtn.setAttribute('data-confirm', 'true');
        disconnectBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="margin-right: 4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Confirm Disconnection?';
        disconnectBtn.style.color = '#ef4444';
        
        // Revert back after 3 seconds if not clicked again
        clearTimeout(disconnectTimeout);
        disconnectTimeout = setTimeout(() => {
          disconnectBtn.setAttribute('data-confirm', 'false');
          disconnectBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M18.84 8.16l-3.3-3.3a5 5 0 0 0-7.07 0L4.54 8.78a5 5 0 0 0 0 7.07l.36.36M19.1 14.86l.36.36a5 5 0 0 1 0 7.07l-3.93 3.93a5 5 0 0 1-7.07 0l-3.3-3.3M15 9l-6 6"></path></svg> Disconnect Workspace';
          disconnectBtn.style.color = '';
        }, 3000);
        
        return;
      }

      // If already in confirm state, execute disconnection
      clearTimeout(disconnectTimeout);
      disconnectBtn.setAttribute('data-confirm', 'false');
      disconnectBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline"><path d="M18.84 8.16l-3.3-3.3a5 5 0 0 0-7.07 0L4.54 8.78a5 5 0 0 0 0 7.07l.36.36M19.1 14.86l.36.36a5 5 0 0 1 0 7.07l-3.93 3.93a5 5 0 0 1-7.07 0l-3.3-3.3M15 9l-6 6"></path></svg> Disconnect Workspace';
      disconnectBtn.style.color = '';

      try {
        isDisconnecting = true;
        startLoadingBar();
        const res = await fetch('/api/notion/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, type: normalizedType || 'all' })
        });
        
        const data = await res.json();
        finishLoadingBar();

        if (res.status === 200 && data.success) {
          // Clear localStorage
          try {
            localStorage.removeItem(storageKey);
            if (data.connectionDeleted || !normalizedType) {
              localStorage.removeItem('workspace_id');
            }
          } catch (_) {}

          showToast('Notion workspace disconnected.');
          
          // Redirect to home without workspace_id query
          setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('workspace_id');
            window.location.href = url.toString();
          }, 1000);
        } else {
          isDisconnecting = false;
          throw new Error(data.error || 'Failed to disconnect');
        }
      } catch (err) {
        isDisconnecting = false;
        finishLoadingBar();
        showToast(`Error: ${friendlyErrorMessage(err.message)}`, true);
      }
    });
  }

  setupNormalUI(urlParams, allowedCategories, databaseMappings, isLocalMode, workspaceId);
}

function setupNormalUI(urlParams, allowedCategories = ['all'], databaseMappings = {}, isLocalMode = false, workspaceId = null) {
  const hasWorkspaceIdInUrl = !!urlParams.get('workspace_id');
  const tempBanner = document.getElementById('temp-connection-banner');
  if (tempBanner) {
    if (!isLocalMode && !hasWorkspaceIdInUrl && workspaceId) {
      tempBanner.style.display = 'flex';
      const tempBtn = document.getElementById('temp-connection-btn');
      if (tempBtn) {
        tempBtn.onclick = (e) => {
          e.preventDefault();
          openSettingsModal(workspaceId, allowedCategories);
        };
      }
    } else {
      tempBanner.style.display = 'none';
    }
  }

  let embedType = urlParams.get('type')?.toLowerCase();
  const hasTypeParam = !!urlParams.get('type');

  const isRestricted = !allowedCategories.includes('all');
  if (isRestricted) {
    const normalizedType = embedType ? (TYPE_MAPPING[embedType] || embedType) : null;
    // Force active type to the first allowed category if invalid/missing
    if (!normalizedType || !allowedCategories.includes(normalizedType)) {
      embedType = allowedCategories[0];
    } else {
      embedType = normalizedType;
    }
  }

  // If we only have 1 allowed category and type query param was explicitly provided, hide the tabs and display as dedicated mode
  if (hasTypeParam && isRestricted && allowedCategories.length === 1) {
    currentType = TYPE_MAPPING[embedType] || embedType;

    // Hide tabs container
    if (UI.tabsContainer) UI.tabsContainer.style.display = 'none';

    // Update breadcrumb to reflect active category
    const breadcrumbEl = document.getElementById('breadcrumb-active');
    if (breadcrumbEl) breadcrumbEl.textContent = CATEGORY_NAMES[currentType] || currentType;

    // Focus search input and update placeholder
    UI.searchInput.placeholder = PLACEHOLDERS[currentType];
  } else if (hasTypeParam && embedType && TYPE_MAPPING[embedType] && (!isRestricted || allowedCategories.includes(embedType))) {
    currentType = TYPE_MAPPING[embedType];

    // Hide tabs container
    if (UI.tabsContainer) UI.tabsContainer.style.display = 'none';

    // Update breadcrumb to reflect active category
    const catName = CATEGORY_NAMES[currentType];
    const breadcrumbElDed = document.getElementById('breadcrumb-active');
    if (breadcrumbElDed) breadcrumbElDed.textContent = catName || currentType;

    // Focus search input and update placeholder
    UI.searchInput.placeholder = PLACEHOLDERS[currentType];
  } else {
    // Standard tabs display
    if (UI.tabsContainer) UI.tabsContainer.style.display = 'flex';

    // Standard tab click listeners
    UI.tabs.forEach((tab, index) => {
      const tabType = tab.getAttribute('data-type');
      tab.style.display = ''; // Make sure all tabs are visible

      tab.addEventListener('click', () => {
        console.log(`[DEBUG] Click listener triggered for tabType:`, tabType, `isRestricted:`, isRestricted, `allowedCategories:`, allowedCategories);
        try {
          UI.tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          tab.setAttribute('tabindex', '0');

          currentType = tabType;

          // Update breadcrumb active label
          const breadcrumbLbl = document.getElementById('breadcrumb-active');
          if (breadcrumbLbl) {
            const tabLabels = { movie: 'Movies', tv: 'TV Shows', book: 'Books', anime: 'Anime', manga: 'Manga', game: 'Games', comic: 'Comics' };
            breadcrumbLbl.textContent = tabLabels[tabType] || CATEGORY_NAMES[tabType] || tabType;
          }

          if (isRestricted && !allowedCategories.includes(tabType)) {
            console.log(`[DEBUG] Tab ${tabType} is restricted and unauthorized`);
            // Hide search section
            const searchSection = document.querySelector('.search-section');
            if (searchSection) searchSection.style.display = 'none';
            
            // Show inline authorize prompt inside emptyState
            showInlineAuthorizeCategoryUI(tabType);
          } else if (!isLocalMode && (!databaseMappings || !databaseMappings[tabType])) {
            console.log(`[DEBUG] Tab ${tabType} is authorized but unmapped`);
            // Hide search section
            const searchSection = document.querySelector('.search-section');
            if (searchSection) searchSection.style.display = 'none';
            
            showInlineMapCategoryUI(tabType, workspaceId, allowedCategories);
          } else {
            console.log(`[DEBUG] Tab ${tabType} is authorized and mapped. Rendering search UI.`);
            // Show search section
            const searchSection = document.querySelector('.search-section');
            if (searchSection) searchSection.style.display = 'block';

            UI.searchInput.placeholder = PLACEHOLDERS[currentType] || 'Search...';

            // Clear input and show empty state
            UI.searchInput.value = '';
            UI.clearBtn.style.display = 'none';
            resetFiltersAndSort();
            showEmptyState();
            hideSuggestions();
          }
        } catch (err) {
          console.error(`[DEBUG] Error in click handler for ${tabType}:`, err);
        }
      });

      // Keyboard navigation for category tabs (Arrow keys / Space / Enter)
      tab.addEventListener('keydown', (e) => {
        let targetTab = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetTab = UI.tabs[(index + 1) % UI.tabs.length];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetTab = UI.tabs[(index - 1 + UI.tabs.length) % UI.tabs.length];
        } else if (e.key === 'Home') {
          targetTab = UI.tabs[0];
        } else if (e.key === 'End') {
          targetTab = UI.tabs[UI.tabs.length - 1];
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tab.click();
        }

        if (targetTab) {
          e.preventDefault();
          targetTab.focus();
          targetTab.click();
        }
      });
    });

    // Set first allowed tab as active
    let firstAllowedTab = null;
    if (isRestricted) {
      firstAllowedTab = Array.from(UI.tabs).find(tab => allowedCategories.includes(tab.getAttribute('data-type')));
    } else {
      firstAllowedTab = UI.tabs[0];
    }
    if (firstAllowedTab) {
      firstAllowedTab.click();
    }
  }

  // Search input debounced lookup
  UI.searchInput.addEventListener('input', () => {
    const q = UI.searchInput.value.trim();
    
    if (q.length > 0) {
      UI.clearBtn.style.display = 'block';
    } else {
      UI.clearBtn.style.display = 'none';
      resetFiltersAndSort();
      showEmptyState();
      hideSuggestions();
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchSuggestions(q);
    }, 300); // 300ms debounce
  });

  // Handle keyboard navigation for suggestions dropdown
  UI.searchInput.addEventListener('keydown', (e) => {
    const dropdown = document.getElementById('search-dropdown');
    const isDropdownVisible = dropdown && dropdown.style.display === 'block';
    
    if (e.key === 'ArrowDown') {
      if (isDropdownVisible) {
        e.preventDefault();
        const limit = Math.min(6, currentSuggestions.length);
        let nextIndex = highlightedSuggestionIndex + 1;
        if (nextIndex >= limit) nextIndex = 0;
        highlightSuggestion(nextIndex);
      } else {
        if (currentSuggestions.length > 0) {
          e.preventDefault();
          dropdown.style.display = 'block';
          highlightSuggestion(0);
        }
      }
    } else if (e.key === 'ArrowUp') {
      if (isDropdownVisible) {
        e.preventDefault();
        const limit = Math.min(6, currentSuggestions.length);
        let prevIndex = highlightedSuggestionIndex - 1;
        if (prevIndex < 0) prevIndex = limit - 1;
        highlightSuggestion(prevIndex);
      }
    } else if (e.key === 'Escape') {
      if (isDropdownVisible) {
        e.preventDefault();
        hideSuggestions();
      }
    } else if (e.key === 'Enter') {
      if (isDropdownVisible && highlightedSuggestionIndex >= 0 && highlightedSuggestionIndex < currentSuggestions.length) {
        e.preventDefault();
        const selectedItem = currentSuggestions[highlightedSuggestionIndex];
        openDetailsModal(selectedItem);
        hideSuggestions();
      } else {
        const q = UI.searchInput.value.trim();
        if (q) {
          e.preventDefault();
          clearTimeout(debounceTimer);
          hideSuggestions();
          performSearch(q);
        }
      }
    }
  });

  // Handle focus to show suggestions
  UI.searchInput.addEventListener('focus', () => {
    const q = UI.searchInput.value.trim();
    if (q) {
      if (currentSuggestions.length > 0) {
        renderSuggestions();
      } else {
        fetchSuggestions(q);
      }
    }
  });

  // Handle blur to hide suggestions with delay
  UI.searchInput.addEventListener('blur', () => {
    setTimeout(hideSuggestions, 200);
  });

  // Document listener to handle clicks outside the search dropdown
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown && !UI.searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Clear button click listener
  UI.clearBtn.addEventListener('click', () => {
    UI.searchInput.value = '';
    UI.clearBtn.style.display = 'none';
    resetFiltersAndSort();
    showEmptyState();
    hideSuggestions();
    UI.searchInput.focus();
  });

  // ─── Filter & Sort Pill Event Listeners ───
  const sortBtns = document.querySelectorAll('.sort-btn');
  sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSort = btn.getAttribute('data-sort');
      applyFiltersAndSort();
    });
  });

  const localFilterInput = document.getElementById('local-filter');
  if (localFilterInput) {
    localFilterInput.addEventListener('input', () => {
      localFilter = localFilterInput.value.trim().toLowerCase();
      applyFiltersAndSort();
    });
  }

  // ─── Modal Event Listeners ───
  const modal = document.getElementById('details-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const confirmBtn = document.getElementById('modal-add-btn');

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
    const videoIframe = document.getElementById('modal-video-iframe');
    if (videoIframe) videoIframe.src = ''; // Stop video playback
    closeTrailerLightbox();
    releaseFocus();
  };

  const openTrailerLightbox = () => {
    const lightbox = document.getElementById('video-lightbox');
    const lightboxIframe = document.getElementById('lightbox-video-iframe');
    if (!activeItem) return;
    const trailerUrl = activeItem.trailer || activeItem.metadata?.trailer;
    const videoId = extractYouTubeVideoId(trailerUrl);
    
    if (videoId && lightbox && lightboxIframe) {
      lightboxIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      lightbox.style.display = 'flex';
      setTimeout(() => lightbox.classList.add('show'), 10);
    }
  };

  const closeTrailerLightbox = () => {
    const lightbox = document.getElementById('video-lightbox');
    const lightboxIframe = document.getElementById('lightbox-video-iframe');
    if (lightbox && lightboxIframe) {
      lightbox.classList.remove('show');
      setTimeout(() => {
        lightbox.style.display = 'none';
        lightboxIframe.src = '';
      }, 200);
    }
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Lightbox close/open listeners
  const lightbox = document.getElementById('video-lightbox');
  const lightboxClose = document.getElementById('lightbox-close-btn');
  if (lightboxClose) lightboxClose.addEventListener('click', closeTrailerLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeTrailerLightbox();
    });
  }

  const videoContainer = document.getElementById('modal-video-container');
  if (videoContainer) {
    videoContainer.addEventListener('click', openTrailerLightbox);
  }

  // Status changes
  const statusSelect = document.getElementById('modal-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      userStatus = statusSelect.value;
    });
  }

  // Confirm Modal Addition
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (activeItem) {
        addItemToNotion(activeItem, confirmBtn, {
          status: userStatus
        });
      }
    });
  }

  // Enter-to-add keyboard support inside modal
  if (modal) {
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
        e.preventDefault();
        if (confirmBtn && !confirmBtn.disabled) {
          confirmBtn.click();
        }
      }
    });
  }

  // Verify Notion connection status and show badge
  checkSyncStatus();
}

async function fetchSuggestions(query) {
  if (!query) {
    hideSuggestions();
    return;
  }
  
  try {
    const res = await fetch(`/api/search/${currentType}?q=${encodeURIComponent(query)}`);
    if (res.status === 200) {
      const data = await res.json();
      currentSuggestions = data || [];
      highlightedSuggestionIndex = -1;
      renderSuggestions();
    }
  } catch (err) {
    console.error('Fetch suggestions failed:', err);
  }
}

function renderSuggestions() {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  
  if (currentSuggestions.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  currentSuggestions.slice(0, 6).forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'search-dropdown-item';
    div.setAttribute('role', 'option');
    div.setAttribute('id', `suggestion-item-${index}`);
    div.setAttribute('data-index', index);
    
    let coverHtml = '';
    if (item.cover) {
      coverHtml = `<img class="dropdown-item-cover" src="${weserv(item.cover)}" alt="cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`;
    }
    
    let subtitleText = '';
    if (currentType === 'movie') subtitleText = `Dir: ${item.metadata?.director || 'N/A'}`;
    else if (currentType === 'tv') subtitleText = `Net: ${item.metadata?.network || 'N/A'}`;
    else if (currentType === 'book') subtitleText = `By: ${item.metadata?.author || 'Unknown'}`;
    else if (currentType === 'anime') subtitleText = `Studio: ${item.metadata?.studio || 'N/A'}`;
    else if (currentType === 'manga') subtitleText = `By: ${item.metadata?.author || 'Unknown'}`;
    else if (currentType === 'game') subtitleText = `By: ${item.metadata?.publisher || 'N/A'}`;
    else if (currentType === 'comic') subtitleText = `Writer: ${item.metadata?.author || 'N/A'}`;
    
    if (item.year) {
      subtitleText += ` • ${item.year}`;
    }

    div.innerHTML = `
      ${coverHtml}
      <span class="dropdown-item-placeholder" style="${item.cover ? 'display:none;' : ''}">${getCategorySvg(currentType, 'placeholder-icon-svg')}</span>
      <div class="dropdown-item-details">
        <div class="dropdown-item-title">${item.title}</div>
        <div class="dropdown-item-subtitle">${subtitleText}</div>
      </div>
    `;
    
    div.addEventListener('click', () => {
      openDetailsModal(item);
      hideSuggestions();
    });
    
    dropdown.appendChild(div);
  });
  
  dropdown.style.display = 'block';
}

function hideSuggestions() {
  const dropdown = document.getElementById('search-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  highlightedSuggestionIndex = -1;
}

function highlightSuggestion(index) {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;
  
  const items = dropdown.querySelectorAll('.search-dropdown-item');
  items.forEach(item => item.classList.remove('highlighted'));
  
  if (index >= 0 && index < items.length) {
    items[index].classList.add('highlighted');
    items[index].scrollIntoView({ block: 'nearest' });
    highlightedSuggestionIndex = index;
    UI.searchInput.setAttribute('aria-activedescendant', `suggestion-item-${index}`);
  } else {
    highlightedSuggestionIndex = -1;
    UI.searchInput.removeAttribute('aria-activedescendant');
  }
}

// Clear UI and show empty state
function showEmptyState() {
  resetLoadingBar();
  UI.loadingSpinner.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.emptyState.style.display = 'flex';
  if (UI.emptyState) {
    UI.emptyState.classList.remove('recommendations-active');
  }
  UI.emptyState.innerHTML = `
    <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 28px; height: 28px; opacity: 0.35;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
    <h3>Ready to Explore</h3>
    <p>Type a title above to search the global metadata libraries.</p>
  `;
}

function clearRecommendationsActive() {
  if (UI.emptyState) {
    UI.emptyState.classList.remove('recommendations-active');
  }
}

// Show loading state
function showLoadingState() {
  clearRecommendationsActive();
  startLoadingBar();
  UI.emptyState.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.loadingSpinner.style.display = 'flex';
}

// Perform AJAX search request to local proxy API
async function performSearch(query) {
  showLoadingState();

  try {
    const res = await fetch(`/api/search/${currentType}?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    if (res.status !== 200) {
      throw new Error(data.error || 'Failed to retrieve results');
    }

    currentResults = data || [];
    
    // Show control bar when search results are loaded
    const controlBar = document.getElementById('control-bar');
    if (controlBar) {
      if (currentResults.length > 0) controlBar.style.display = 'flex';
      else controlBar.style.display = 'none';
    }

    applyFiltersAndSort();
  } catch (err) {
    console.error('Search failed:', err);
    resetLoadingBar();
    renderError(friendlyErrorMessage(err.message));
  }
}

function resetFiltersAndSort() {
  const controlBar = document.getElementById('control-bar');
  if (controlBar) controlBar.style.display = 'none';
  const localFilterInput = document.getElementById('local-filter');
  if (localFilterInput) localFilterInput.value = '';
  localFilter = '';
  activeSort = 'default';
  const sortBtns = document.querySelectorAll('.sort-btn');
  sortBtns.forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-sort') === 'default') b.classList.add('active');
  });
  currentResults = [];
}

function applyFiltersAndSort() {
  let items = [...currentResults];

  // Apply local filtering
  if (localFilter) {
    items = items.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(localFilter);
      let subtitleText = '';
      if (currentType === 'movie') subtitleText = item.metadata.director || '';
      else if (currentType === 'tv') subtitleText = item.metadata.network || '';
      else if (currentType === 'book') subtitleText = item.metadata.author || '';
      else if (currentType === 'anime') subtitleText = item.metadata.studio || '';
      else if (currentType === 'manga') subtitleText = item.metadata.author || '';
      else if (currentType === 'game') subtitleText = item.metadata.publisher || '';
      else if (currentType === 'comic') subtitleText = item.metadata.author || '';
      
      const subtitleMatch = subtitleText.toLowerCase().includes(localFilter);
      const genreMatch = item.genres ? item.genres.some(g => g.toLowerCase().includes(localFilter)) : false;

      return titleMatch || subtitleMatch || genreMatch;
    });
  }

  // Apply sorting
  if (activeSort === 'year') {
    items.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (activeSort === 'rating') {
    items.sort((a, b) => {
      const scoreA = parseFloat(a.metadata.rating || a.metadata.score || 0);
      const scoreB = parseFloat(b.metadata.rating || b.metadata.score || 0);
      return scoreB - scoreA;
    });
  } else if (activeSort === 'title') {
    items.sort((a, b) => a.title.localeCompare(b.title));
  }

  displayCards(items);
}

function displayCards(items) {
  finishLoadingBar();
  UI.loadingSpinner.style.display = 'none';

  if (items.length === 0) {
    UI.resultsGrid.innerHTML = '';
    const noMatch = document.createElement('div');
    noMatch.className = 'no-matches-view';
    noMatch.innerHTML = `
      <div class="no-matches-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; opacity: 0.35; margin: 0 auto 12px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
      <h4 class="no-matches-title">No Matches Found</h4>
      <p class="no-matches-text">Try updating your filter keyword or search query.</p>
    `;
    UI.resultsGrid.appendChild(noMatch);
    return;
  }

  UI.emptyState.style.display = 'none';
  UI.resultsGrid.innerHTML = '';
  UI.resultsGrid.style.display = 'grid';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${item.title}`);

    let subtitleText = '';
    if (currentType === 'movie') subtitleText = `Dir: ${item.metadata.director || 'N/A'}`;
    else if (currentType === 'tv') subtitleText = `Net: ${item.metadata.network || 'N/A'}`;
    else if (currentType === 'book') subtitleText = `By: ${item.metadata.author || 'Unknown'}`;
    else if (currentType === 'anime') subtitleText = `Studio: ${item.metadata.studio || 'N/A'}`;
    else if (currentType === 'manga') subtitleText = `By: ${item.metadata.author || 'Unknown'}`;
    else if (currentType === 'game') subtitleText = `By: ${item.metadata.publisher || 'N/A'}`;
    else if (currentType === 'comic') subtitleText = `Writer: ${item.metadata.author || 'N/A'}`;

    let badgesHtml = '';
    if (item.year) {
      badgesHtml += `<span class="meta-badge">${item.year}</span>`;
    }
    
    if (currentType === 'movie') {
      if (item.metadata.rating) badgesHtml += `<span class="meta-badge badge-score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon" style="fill: currentColor; width: 11px; height: 11px; margin-right: 3px; vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${item.metadata.rating}</span>`;
      if (item.metadata.runtime) badgesHtml += `<span class="meta-badge">${item.metadata.runtime}m</span>`;
    } else if (currentType === 'tv') {
      if (item.metadata.rating) badgesHtml += `<span class="meta-badge badge-score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon" style="fill: currentColor; width: 11px; height: 11px; margin-right: 3px; vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${item.metadata.rating}</span>`;
      if (item.metadata.status) badgesHtml += `<span class="meta-badge">${item.metadata.status}</span>`;
    } else if (currentType === 'book') {
      if (item.metadata.pages) badgesHtml += `<span class="meta-badge">${item.metadata.pages} pgs</span>`;
    } else if (currentType === 'anime') {
      if (item.metadata.score) badgesHtml += `<span class="meta-badge badge-score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon" style="fill: currentColor; width: 11px; height: 11px; margin-right: 3px; vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${item.metadata.score}</span>`;
      if (item.metadata.episodes) badgesHtml += `<span class="meta-badge">${item.metadata.episodes} eps</span>`;
    } else if (currentType === 'manga') {
      if (item.metadata.volumes) badgesHtml += `<span class="meta-badge">${item.metadata.volumes} vols</span>`;
    } else if (currentType === 'game') {
      if (item.metadata.score) badgesHtml += `<span class="meta-badge badge-score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon" style="fill: currentColor; width: 11px; height: 11px; margin-right: 3px; vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${item.metadata.score}</span>`;
    } else if (currentType === 'comic') {
      if (item.metadata.publisher) badgesHtml += `<span class="meta-badge">${item.metadata.publisher}</span>`;
    }

    const GENRE_COLORS = {
      action: { border: 'rgba(239, 68, 68, 0.3)', color: '#f87171' },
      adventure: { border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' },
      comedy: { border: 'rgba(251, 191, 36, 0.3)', color: '#fcd34d' },
      drama: { border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' },
      fantasy: { border: 'rgba(139, 92, 246, 0.3)', color: '#a78bfa' },
      scifi: { border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' },
      romance: { border: 'rgba(236, 72, 153, 0.3)', color: '#f472b6' },
      thriller: { border: 'rgba(244, 63, 94, 0.3)', color: '#fb7185' },
      horror: { border: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af' },
      mystery: { border: 'rgba(124, 58, 237, 0.3)', color: '#8b5cf6' },
      animation: { border: 'rgba(139, 92, 246, 0.3)', color: '#a78bfa' },
      superhero: { border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' },
    };

    if (item.genres && Array.isArray(item.genres)) {
      item.genres.slice(0, 2).forEach(genre => {
        const key = genre.toLowerCase().replace(/[^a-z]/g, '');
        if (GENRE_COLORS[key]) {
          badgesHtml += `<span class="meta-badge" style="border-color: ${GENRE_COLORS[key].border}; color: ${GENRE_COLORS[key].color};">${genre}</span>`;
        } else {
          badgesHtml += `<span class="meta-badge">${genre}</span>`;
        }
      });
    }

    const coverHtml = item.cover 
      ? `<img class="card-cover" src="${weserv(item.cover)}" alt="cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`
      : '';

    card.innerHTML = `
      <div class="card-cover-wrapper">
        ${coverHtml}
        <span class="cover-placeholder" style="${item.cover ? 'display:none;' : ''}">${getCategorySvg(currentType, 'placeholder-icon-svg')}</span>
      </div>
      <div class="card-details">
        <div class="card-info">
          <div class="card-title" title="${item.title}">${item.title}</div>
          <div class="card-subtitle" title="${subtitleText}">${subtitleText}</div>
          <div class="card-meta">${badgesHtml}</div>
        </div>
        <div class="card-actions">
          <button class="add-btn inline-details-btn" tabindex="-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="width:12px; height:12px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Details
          </button>
        </div>
      </div>
    `;

    const detailsBtn = card.querySelector('.inline-details-btn');
    detailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetailsModal(item);
    });

    card.addEventListener('click', () => {
      openDetailsModal(item);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetailsModal(item);
      }
    });

    UI.resultsGrid.appendChild(card);
  });
}

function renderError(message) {
  clearRecommendationsActive();
  UI.loadingSpinner.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.emptyState.style.display = 'flex';
  UI.emptyState.querySelector('h3').textContent = 'Search Error';
  UI.emptyState.querySelector('p').textContent = message || 'An error occurred while fetching data. Check server logs.';
}

async function checkSyncStatus() {
  const statusBadge = document.getElementById('sync-status');
  if (!statusBadge) return;

  const urlParams = new URLSearchParams(window.location.search);
  const workspaceId = urlParams.get('workspace_id') || safeGetLocalStorage('workspace_id');

  try {
    const res = await fetch(`/api/notion/config${workspaceId ? `?workspace_id=${workspaceId}` : ''}`);
    
    if (res.status === 401) {
      showUnconnectedUI();
      return;
    }

    if (res.status !== 200) {
      // Server returned an error (e.g. 404 connection not found).
      // This means our workspaceId is dead/invalid, show the connect screen!
      showUnconnectedUI();
      return;
    }

    const data = await res.json();
    
    statusBadge.className = 'sync-status connected';
    statusBadge.querySelector('.status-text').textContent = 'Notion Connected';
  } catch (err) {
    statusBadge.className = 'sync-status failed';
    statusBadge.querySelector('.status-text').textContent = 'Sync Offline';
  }
}

async function openDetailsModal(item) {
  activeItem = item;
  userStatus = 'Inbox';

  // Hide info banner and reset add button on open
  const infoBanner = document.getElementById('modal-info-banner');
  if (infoBanner) infoBanner.style.display = 'none';

  const confirmBtn = document.getElementById('modal-add-btn');
  if (confirmBtn) {
    confirmBtn.className = 'save-btn';
    confirmBtn.style.background = '';
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="width:12px; height:12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add to Notion`;
  }

  const modal = document.getElementById('details-modal');
  if (!modal) return;

  document.getElementById('modal-title').textContent = item.title;
  
  // Set initial loading subtitle
  let subtitleText = '';
  if (currentType === 'movie') subtitleText = `Dir: Loading...`;
  else if (currentType === 'tv') subtitleText = `Net: Loading...`;
  else if (currentType === 'book') subtitleText = `By: Loading...`;
  else if (currentType === 'anime') subtitleText = `Studio: Loading...`;
  else if (currentType === 'manga') subtitleText = `By: Loading...`;
  else if (currentType === 'game') subtitleText = `By: Loading...`;
  else if (currentType === 'comic') subtitleText = `Writer: Loading...`;
  
  if (item.year) subtitleText += ` (${item.year})`;
  document.getElementById('modal-subtitle').textContent = subtitleText;
  
  // Show loading spinner in synopsis
  document.getElementById('modal-synopsis').innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0;">
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      <span style="color: var(--text-muted); font-size: 0.85rem;">Loading details...</span>
    </div>
  `;

  // Render initial search genres if available, or clear
  const genresContainer = document.getElementById('modal-genres');
  genresContainer.innerHTML = '';
  if (item.genres && Array.isArray(item.genres) && item.genres.length > 0) {
    renderGenres(item.genres);
  }

  // Cover image
  const coverImg = document.getElementById('modal-cover-img');
  const coverPlaceholder = document.getElementById('modal-cover-placeholder');
  if (item.cover) {
    coverImg.style.display = 'block';
    coverImg.src = weserv(item.cover);
    coverPlaceholder.style.display = 'none';
  } else {
    coverImg.style.display = 'none';
    coverPlaceholder.style.display = 'block';
    coverPlaceholder.innerHTML = getCategorySvg(currentType, 'placeholder-icon-svg');
  }

  // Hide video container initially
  const videoContainer = document.getElementById('modal-video-container');
  const videoIframe = document.getElementById('modal-video-iframe');
  const videoDirectLink = document.getElementById('modal-video-direct-link');
  videoContainer.style.display = 'none';
  videoIframe.src = '';
  if (videoDirectLink) videoDirectLink.href = '#';

  modal.style.display = 'flex';
  trapFocus(modal);
  await loadStatusOptions();

  // Background fetch for detailed metadata
  const originalTitle = item.title;
  try {
    let detailsUrl = `/api/details/${currentType}?q=${encodeURIComponent(item.title)}`;
    if (item.year) detailsUrl += `&year=${encodeURIComponent(item.year)}`;
    if (item.metadata) detailsUrl += `&metadata=${encodeURIComponent(JSON.stringify(item.metadata))}`;
    const res = await fetch(detailsUrl);
    if (res.ok) {
      const details = await res.json();
      
      // Ensure we haven't switched items while loading
      if (activeItem && activeItem.title === originalTitle) {
        // Merge fetched details into activeItem
        activeItem = {
          ...activeItem,
          ...details,
          metadata: {
            ...(activeItem.metadata || {}),
            ...(details.metadata || {}),
            director: details.director || details.metadata?.director || '',
            actors: details.actors || details.metadata?.actors || '',
            writer: details.writer || details.metadata?.writer || '',
            runtime: details.runtime || details.metadata?.runtime || null,
            rating: details.imdb || details.score || details.rating || details.metadata?.rating || null
          }
        };

        // Render synopsis
        const synopsisText = details.plot || details.synopsis || 'No synopsis description available.';
        document.getElementById('modal-synopsis').textContent = synopsisText;

        // Render subtitle with deep fetched details
        let displaySub = '';
        const director = details.director || details.metadata?.director || '';
        const network = details.network || details.metadata?.network || '';
        const author = details.author || details.metadata?.author || details.authors || details.metadata?.author || '';
        const studio = details.studio || details.metadata?.studio || '';
        const publisher = details.publisher || details.metadata?.publisher || '';
        const writer = details.writer || details.metadata?.writer || '';

        if (currentType === 'movie') displaySub = `Dir: ${director || 'N/A'}`;
        else if (currentType === 'tv') displaySub = `Net: ${network || (director && director !== 'N/A' ? director : 'N/A')}`;
        else if (currentType === 'book') displaySub = `By: ${author || 'Unknown'}`;
        else if (currentType === 'anime') displaySub = `Studio: ${studio || 'N/A'}`;
        else if (currentType === 'manga') displaySub = `By: ${author || 'Unknown'}`;
        else if (currentType === 'game') displaySub = `By: ${publisher || 'N/A'}`;
        else if (currentType === 'comic') displaySub = `Writer: ${writer || 'N/A'}`;

        const detailsYear = details.year || item.year;
        if (detailsYear) displaySub += ` (${detailsYear})`;
        document.getElementById('modal-subtitle').textContent = displaySub;

        // Render genres
        if (details.genres && Array.isArray(details.genres) && details.genres.length > 0) {
          renderGenres(details.genres);
        }

        // Render trailer video
        const trailerUrl = details.trailer || details.metadata?.trailer;
        const videoId = extractYouTubeVideoId(trailerUrl);
        if (videoId) {
          videoContainer.style.display = 'block';
          videoIframe.src = `https://www.youtube.com/embed/${videoId}`;
          const videoDirectLink = document.getElementById('modal-video-direct-link');
          if (videoDirectLink) {
            videoDirectLink.href = trailerUrl || `https://www.youtube.com/watch?v=${videoId}`;
          }
        }

        // Render cover if not present originally but returned by details fetch
        const newCover = details.cover || details.poster || null;
        if (newCover && !item.cover) {
          coverImg.style.display = 'block';
          coverImg.src = weserv(newCover);
          coverPlaceholder.style.display = 'none';
          activeItem.cover = newCover;
        }
      }
    } else {
      if (activeItem && activeItem.title === originalTitle) {
        document.getElementById('modal-synopsis').textContent = item.synopsis || 'No synopsis description available.';
        restoreSubtitle(item);
      }
    }
  } catch (err) {
    console.error('Error fetching details:', err);
    if (activeItem && activeItem.title === originalTitle) {
      document.getElementById('modal-synopsis').textContent = item.synopsis || 'No synopsis description available.';
      restoreSubtitle(item);
    }
  }
}

function renderGenres(genres) {
  const genresContainer = document.getElementById('modal-genres');
  genresContainer.innerHTML = '';
  genres.forEach(genre => {
    const span = document.createElement('span');
    span.className = 'meta-badge';
    span.textContent = genre;
    
    const GENRE_COLORS = {
      action: { border: 'rgba(239, 68, 68, 0.3)', color: '#f87171' },
      adventure: { border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' },
      comedy: { border: 'rgba(251, 191, 36, 0.3)', color: '#fcd34d' },
      drama: { border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' },
      fantasy: { border: 'rgba(139, 92, 246, 0.3)', color: '#a78bfa' },
      scifi: { border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' },
      romance: { border: 'rgba(236, 72, 153, 0.3)', color: '#f472b6' },
      thriller: { border: 'rgba(244, 63, 94, 0.3)', color: '#fb7185' },
      horror: { border: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af' },
      mystery: { border: 'rgba(124, 58, 237, 0.3)', color: '#8b5cf6' },
      animation: { border: 'rgba(139, 92, 246, 0.3)', color: '#a78bfa' },
      superhero: { border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' },
    };
    const key = genre.toLowerCase().replace(/[^a-z]/g, '');
    if (GENRE_COLORS[key]) {
      span.style.borderColor = GENRE_COLORS[key].border;
      span.style.color = GENRE_COLORS[key].color;
    }
    genresContainer.appendChild(span);
  });
}

function restoreSubtitle(item) {
  let displaySub = '';
  if (currentType === 'movie') displaySub = `Dir: ${item.metadata.director || 'N/A'}`;
  else if (currentType === 'tv') displaySub = `Net: ${item.metadata.network || 'N/A'}`;
  else if (currentType === 'book') displaySub = `By: ${item.metadata.author || 'Unknown'}`;
  else if (currentType === 'anime') displaySub = `Studio: ${item.metadata.studio || 'N/A'}`;
  else if (currentType === 'manga') displaySub = `By: ${item.metadata.author || 'Unknown'}`;
  else if (currentType === 'game') displaySub = `By: ${item.metadata.publisher || 'N/A'}`;
  else if (currentType === 'comic') displaySub = `Writer: ${item.metadata.author || 'N/A'}`;
  
  if (item.year) displaySub += ` (${item.year})`;
  document.getElementById('modal-subtitle').textContent = displaySub;
}

function weserv(url) {
  if (!url) return '';
  if (url.startsWith('https://images.weserv.nl') || url.startsWith('data:') || url.startsWith('/') || url.startsWith('./')) {
    return url;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
}

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const reg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(reg);
  return (match && match[2].length === 11) ? match[2] : null;
}

// resetStars function removed

async function loadStatusOptions() {
  const select = document.getElementById('modal-status-select');
  select.innerHTML = '<option value="Inbox">Inbox</option>'; 

  const urlParams = new URLSearchParams(window.location.search);
  const workspaceId = urlParams.get('workspace_id') || safeGetLocalStorage('workspace_id');

  try {
    const res = await fetch(`/api/notion/status-options?type=${currentType}${workspaceId ? `&workspace_id=${workspaceId}` : ''}`);
    const options = await res.json();
    if (options && Array.isArray(options) && options.length > 0) {
      select.innerHTML = '';
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === 'Inbox') o.selected = true;
        select.appendChild(o);
      });
      userStatus = select.value;
    }
  } catch (err) {
    console.error('Failed to load status options:', err);
  }
}

// Add item POST request
// Add item POST request
async function addItemToNotion(item, btnElement, customOptions = {}) {
  // Update state to loading
  startLoadingBar();
  btnElement.classList.add('loading');
  btnElement.disabled = true;
  btnElement.innerHTML = `<span class="spinner" style="width:14px; height:14px; border-width:2px; margin-right:4px;"></span> Adding...`;

  // Hide info banner on retry
  const infoBanner = document.getElementById('modal-info-banner');
  if (infoBanner) infoBanner.style.display = 'none';

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspace_id') || safeGetLocalStorage('workspace_id');
    const payload = {
      workspaceId,
      type: currentType,
      title: item.title,
      cover: item.cover,
      year: item.year,
      genres: item.genres,
      synopsis: item.synopsis,
      metadata: item.metadata,
      userStatus: customOptions.status
    };

    const res = await fetch('/api/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.status !== 200) {
      throw new Error(result.error || 'Failed to add item');
    }

    if (result.status === 'duplicate') {
      finishLoadingBar();
      // Style save button as warning
      btnElement.className = 'save-btn warning';
      btnElement.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      btnElement.innerHTML = `Already in Library`;
      btnElement.disabled = true;

      // Show duplicate warning banner with Notion page links
      if (infoBanner) {
        infoBanner.className = 'info-banner';
        infoBanner.style.display = 'flex';
        
        const icon = document.getElementById('modal-info-icon');
        const text = document.getElementById('modal-info-text');
        const openLink = document.getElementById('modal-open-link');
        
        if (icon) icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; display:block;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        if (text) text.textContent = 'Already exists in your library.';
        if (openLink) openLink.href = result.url;
      }

      showToast(`"${item.title}" already exists in Notion!`, true);
      return;
    }

    // Success state
    finishLoadingBar();
    btnElement.className = 'save-btn success';
    btnElement.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btnElement.innerHTML = `✓ Added to Notion`;
    btnElement.disabled = true;

    // Show success banner with Notion page links
    if (infoBanner) {
      infoBanner.className = 'info-banner success-banner';
      infoBanner.style.display = 'flex';
      
      const icon = document.getElementById('modal-info-icon');
      const text = document.getElementById('modal-info-text');
      const openLink = document.getElementById('modal-open-link');
      
      if (icon) icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; display:block;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      if (text) text.textContent = 'Added successfully to Notion.';
      if (openLink) openLink.href = result.url;
    }

    showToast(`Successfully added "${item.title}"!`);

  } catch (err) {
    console.error('Failed to add item:', err);
    resetLoadingBar();
    // Reset state to allow retry
    btnElement.classList.remove('loading');
    btnElement.disabled = false;
    btnElement.className = 'save-btn';
    btnElement.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    btnElement.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="width:12px; height:12px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Failed. Retry?`;
    
    setTimeout(() => {
      btnElement.className = 'save-btn';
      btnElement.style.background = '';
      btnElement.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="width:12px; height:12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add to Notion`;
    }, 3000);

    showToast(`Failed: ${friendlyErrorMessage(err.message)}`, true);
  }
}

// Toast notification helper with dynamic style injections
function showToast(msg, isError = false) {
  let toast = document.getElementById('toast');
  if (!toast) {
    const style = document.createElement('style');
    style.innerHTML = `
      .status-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: var(--modal-content-bg);
        border: 1px solid var(--border-light);
        color: var(--text-main);
        padding: 10px 20px;
        border-radius: 6px;
        font-weight: 500;
        font-size: 0.85rem;
        box-shadow: var(--modal-shadow);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(10px);
      }
      .status-toast.show {
        transform: translateX(-50%) translateY(0);
      }
    `;
    document.head.appendChild(style);

    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'status-toast';
    document.body.appendChild(toast);
  }
  
  // Clean up message from any static symbols
  const cleanMsg = msg.replace(/^[✓✗⚠️]\s*/, '');
  
  const iconHtml = isError 
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon" style="width:16px; height:16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon" style="width:16px; height:16px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  toast.innerHTML = `${iconHtml}<span>${cleanMsg}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Helper to open settings mapping modal inline
async function openSettingsModal(workspaceId, allowedCategories) {
  const modal = document.getElementById('settings-modal');
  const errorBanner = document.getElementById('settings-error');
  if (!modal) return;
  
  errorBanner.style.display = 'none';
  modal.style.display = 'flex';
  
  // Disable save button while loading
  const saveBtn = document.getElementById('settings-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Loading...';
  }
  
  try {
    // 1. Fetch databases and existing config in parallel
    const [dbRes, configRes] = await Promise.all([
      fetch(`/api/notion/databases?workspace_id=${workspaceId}`),
      fetch(`/api/notion/config?workspace_id=${workspaceId}`)
    ]);
    
    if (!dbRes.ok || !configRes.ok) {
      const failedRes = !dbRes.ok ? dbRes : configRes;
      const err = await failedRes.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load databases or configuration");
    }
    
    const databases = await dbRes.json();
    const config = await configRes.json();
    const mappings = config.databaseMappings || {};
    
    // 2. Populate each category dropdown
    const categories = ['movie', 'tv', 'book', 'anime', 'manga', 'game', 'comic'];
    
    categories.forEach(cat => {
      const select = document.getElementById(`settings-map-${cat}`);
      if (!select) return;
      
      // Clear select options
      select.innerHTML = `<option value="">-- Don't link / disabled --</option>`;
      
      // Add databases
      databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db.id;
        option.textContent = db.title || 'Untitled Database';
        if (mappings[cat] === db.id) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      
      // If restricted and this category isn't allowed, disable the dropdown
      const isRestricted = !allowedCategories.includes('all');
      if (isRestricted && !allowedCategories.includes(cat)) {
        select.disabled = true;
        select.innerHTML = `<option value="">-- Unauthorized category --</option>`;
      } else {
        select.disabled = false;
      }
    });

    // 3. Generate copyable embed URLs
    const embedUrlsContainer = document.getElementById('settings-embed-urls');
    if (embedUrlsContainer) {
      embedUrlsContainer.innerHTML = '';
      
      const baseUrl = window.location.origin + window.location.pathname;
      const isRestricted = !allowedCategories.includes('all');
      const urlsToGenerate = [];
      
      // Multi-Category Hub: only relevant if 'all' is allowed or there are multiple allowed categories
      if (!isRestricted || allowedCategories.length > 1) {
        urlsToGenerate.push({
          label: 'Multi-Category Hub',
          url: `${baseUrl}?workspace_id=${workspaceId}`,
          isHub: true
        });
      }
      
      categories.forEach(cat => {
        // Only generate for allowed categories
        if (!isRestricted || allowedCategories.includes(cat)) {
          urlsToGenerate.push({
            label: `${CATEGORY_NAMES[cat] || cat} Widget`,
            url: `${baseUrl}?workspace_id=${workspaceId}&type=${cat}`,
            isHub: false
          });
        }
      });
      
      urlsToGenerate.forEach(item => {
        const row = document.createElement('div');
        row.className = 'embed-url-row';
        if (item.isHub) {
          row.classList.add('embed-urls-hub-row');
        }
        
        const rowHeader = document.createElement('div');
        rowHeader.className = 'embed-url-row-header';
        if (item.isHub) {
          rowHeader.classList.add('embed-urls-header');
        }
        rowHeader.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="notion-icon notion-icon-inline" style="width: 14px; height: 14px; margin-right: 0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span>${item.label}</span>
        `;
        
        const box = document.createElement('div');
        box.className = 'embed-url-box';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'embed-url-input';
        input.readOnly = true;
        input.value = item.url;
        
        // Select input value on click for easy manual copying
        input.onclick = () => input.select();
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary';
        copyBtn.style.flexShrink = '0';
        copyBtn.style.minWidth = '70px';
        copyBtn.textContent = 'Copy';
        
        copyBtn.onclick = async (e) => {
          e.preventDefault();
          try {
            await navigator.clipboard.writeText(item.url);
            copyBtn.textContent = 'Copied!';
            copyBtn.style.borderColor = 'var(--green)';
            copyBtn.style.color = 'var(--green)';
            
            setTimeout(() => {
              copyBtn.textContent = 'Copy';
              copyBtn.style.borderColor = '';
              copyBtn.style.color = '';
            }, 2000);
          } catch (err) {
            console.error('Failed to copy URL:', err);
            // Fallback selection copy
            input.select();
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = 'Copy';
            }, 2000);
          }
        };
        
        box.appendChild(input);
        box.appendChild(copyBtn);
        row.appendChild(rowHeader);
        row.appendChild(box);
        embedUrlsContainer.appendChild(row);
      });
    }
    
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Mappings';
    }
  } catch (err) {
    console.error('Error opening settings:', err);
    errorBanner.textContent = friendlyErrorMessage(err.message);
    errorBanner.style.display = 'block';
    
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Save Mappings';
    }
  }
}

// Helper to save settings mapping modal inline
async function saveSettingsMappings(workspaceId) {
  const saveBtn = document.getElementById('settings-save-btn');
  const errorBanner = document.getElementById('settings-error');
  if (saveBtn) {
    saveBtn.classList.add('loading');
    saveBtn.textContent = 'Saving...';
  }
  
  const categories = ['movie', 'tv', 'book', 'anime', 'manga', 'game', 'comic'];
  const newMappings = {};
  
  categories.forEach(cat => {
    const select = document.getElementById(`settings-map-${cat}`);
    if (select && select.value && !select.disabled) {
      newMappings[cat] = select.value;
    }
  });
  
  try {
    const res = await fetch('/api/notion/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        mappings: newMappings
      })
    });
    
    const data = await res.json();
    if (res.status === 200 && data.success) {
      showToast('Mappings saved successfully!');
      
      // Success state animation on save button
      if (saveBtn) {
        saveBtn.classList.remove('loading');
        saveBtn.classList.add('success');
        saveBtn.textContent = 'Saved!';
      }
      
      setTimeout(() => {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.style.display = 'none';
        if (saveBtn) {
          saveBtn.classList.remove('success');
          saveBtn.textContent = 'Save Mappings';
        }
        
        // Reload page to apply new mappings
        window.location.reload();
      }, 1000);
    } else {
      throw new Error(data.error || 'Failed to save mappings');
    }
  } catch (err) {
    console.error('Error saving settings mappings:', err);
    if (errorBanner) {
      errorBanner.textContent = friendlyErrorMessage(err.message);
      errorBanner.style.display = 'block';
    }
    if (saveBtn) {
      saveBtn.classList.remove('loading');
      saveBtn.textContent = 'Save Mappings';
    }
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);

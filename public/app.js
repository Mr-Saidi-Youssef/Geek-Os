// State Management
let currentType = 'movie';
let debounceTimer;

const UI = {
  tabs: document.querySelectorAll('.tab-btn'),
  tabsContainer: document.getElementById('nav-tabs'),
  logoIcon: document.getElementById('logo-icon'),
  logoTitle: document.getElementById('logo-title'),
  logoSubtitle: document.getElementById('logo-subtitle'),
  searchInput: document.getElementById('search-input'),
  clearBtn: document.getElementById('clear-btn'),
  loadingSpinner: document.getElementById('loading-spinner'),
  emptyState: document.getElementById('empty-state'),
  resultsGrid: document.getElementById('results-grid'),
  recommendationsSection: document.getElementById('recommendations-section'),
  trendingCarousel: document.getElementById('trending-carousel'),
  upcomingCarousel: document.getElementById('upcoming-carousel')
};

// Cover art Weserv proxy formatter
function getProxiedCoverUrl(url) {
  if (!url || url === 'N/A') return null;
  if (url.startsWith('https://images.weserv.nl/')) return url;
  if (url.includes('myanimelist.net')) return url;
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
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

// Emoji icons for tab categories
const TYPE_EMOJIS = {
  movie: '🎬',
  tv: '📺',
  book: '📚',
  anime: '🌸',
  manga: '📖',
  game: '🎮',
  comic: '🦸'
};

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

// Initialize listeners
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  let workspaceId = urlParams.get('workspace_id') || localStorage.getItem('workspace_id');

  // Listen for popup messages from setup window
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'setup_success') {
      localStorage.setItem('workspace_id', event.data.workspaceId);
      window.location.reload();
    }
  });

  if (!workspaceId) {
    // Hide search input and nav tabs
    const searchSection = document.querySelector('.search-section');
    if (searchSection) searchSection.style.display = 'none';
    const navTabs = document.getElementById('nav-tabs');
    if (navTabs) navTabs.style.display = 'none';
    
    // Show Connect Notion in empty state
    if (UI.emptyState) {
      UI.emptyState.innerHTML = `
        <div class="empty-icon" style="font-size:3rem; margin-bottom:16px; opacity: 1;">🔮</div>
        <h3 style="font-size:1.4rem; margin-bottom:8px; font-family:var(--font-header); color:#ffffff;">Connect Notion Workspace</h3>
        <p style="max-width:320px; font-size:0.9rem; line-height:1.5; margin-bottom:20px; color:var(--text-muted);">Link your Notion account to enable search and one-click additions to your databases.</p>
        <button id="connect-btn" class="add-btn" style="width:auto; padding:12px 30px; font-size:0.9rem; border-radius:12px; display:inline-flex; border:none; cursor:pointer; font-family:var(--font-family);">
          🔌 Connect Notion
        </button>
        <div style="max-width:360px; font-size:0.75rem; line-height:1.4; color:var(--text-muted); margin-top:20px; border-top:1px solid rgba(255,255,255,0.08); padding-top:12px; text-align:center;">
          💡 <strong>Setup Tip:</strong> Choose "Select pages" and check the <strong>entire Watchlist Tracker parent page</strong> to automatically grant access to all 7 databases.
        </div>
      `;

      const connectBtn = document.getElementById('connect-btn');
      if (connectBtn) {
        connectBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const width = 600;
          const height = 750;
          const left = (window.screen.width / 2) - (width / 2);
          const top = (window.screen.height / 2) - (height / 2);
          window.open('/api/notion/login', 'NotionAuth', `width=${width},height=${height},left=${left},top=${top}`);
        });
      }
    }
    return;
  }

  // If workspace_id is provided in URL, persist it
  if (urlParams.get('workspace_id')) {
    localStorage.setItem('workspace_id', urlParams.get('workspace_id'));
  }

  // Check URL parameter for dedicated mode
  const embedType = urlParams.get('type')?.toLowerCase();

  if (embedType && TYPE_MAPPING[embedType]) {
    currentType = TYPE_MAPPING[embedType];

    // Hide tabs container
    if (UI.tabsContainer) UI.tabsContainer.style.display = 'none';

    // Update Header info dynamically
    const catName = CATEGORY_NAMES[currentType];
    const emoji = TYPE_EMOJIS[currentType];
    if (UI.logoIcon) UI.logoIcon.textContent = emoji;
    if (UI.logoTitle) UI.logoTitle.textContent = `${catName} Adder`;
    if (UI.logoSubtitle) UI.logoSubtitle.textContent = `Search and add ${catName.toLowerCase()}s directly to Notion`;

    // Focus search input and update placeholder
    UI.searchInput.placeholder = PLACEHOLDERS[currentType];
    showHomeState();
  } else {
    // Standard tab click listeners
    UI.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        UI.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        currentType = tab.getAttribute('data-type');
        UI.searchInput.placeholder = PLACEHOLDERS[currentType] || 'Search...';

        // Clear input and show home state
        UI.searchInput.value = '';
        UI.clearBtn.style.display = 'none';
        showHomeState();
      });
    });
    showHomeState();
  }

  // Set up carousel button delegation once
  const carouselWrappers = document.querySelectorAll('.recs-carousel-wrapper');
  carouselWrappers.forEach(wrapper => {
    const carousel = wrapper.querySelector('.recs-carousel');
    const prevBtn = wrapper.querySelector('.prev-btn');
    const nextBtn = wrapper.querySelector('.next-btn');

    if (carousel && prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => {
        carousel.scrollBy({ left: -632, behavior: 'smooth' });
      });
      nextBtn.addEventListener('click', () => {
        carousel.scrollBy({ left: 632, behavior: 'smooth' });
      });

      // Update button visibility on scroll
      const updateButtons = () => {
        const scrollLeft = carousel.scrollLeft;
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        
        if (scrollLeft <= 5) {
          prevBtn.classList.add('disabled');
        } else {
          prevBtn.classList.remove('disabled');
        }

        if (scrollLeft >= maxScroll - 5) {
          nextBtn.classList.add('disabled');
        } else {
          nextBtn.classList.remove('disabled');
        }
      };

      carousel.addEventListener('scroll', updateButtons, { passive: true });
      window.addEventListener('resize', updateButtons, { passive: true });
      
      // Expose helper to update button states when contents change
      carousel.updateButtonsState = updateButtons;
    }
  });

  // Search input debounced lookup
  UI.searchInput.addEventListener('input', () => {
    const q = UI.searchInput.value.trim();
    
    if (q.length > 0) {
      UI.clearBtn.style.display = 'block';
    } else {
      UI.clearBtn.style.display = 'none';
      showHomeState();
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(q);
    }, 400); // 400ms debounce
  });

  // Clear button click listener
  UI.clearBtn.addEventListener('click', () => {
    UI.searchInput.value = '';
    UI.clearBtn.style.display = 'none';
    showHomeState();
    UI.searchInput.focus();
  });
}

// Clear UI and show empty state
function showEmptyState() {
  UI.loadingSpinner.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.recommendationsSection.style.display = 'none';
  UI.emptyState.style.display = 'flex';
}

// Show loading state
function showLoadingState() {
  UI.emptyState.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.recommendationsSection.style.display = 'none';
  UI.loadingSpinner.style.display = 'flex';
}

// Show home state (recommendations)
function showHomeState() {
  UI.loadingSpinner.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.emptyState.style.display = 'none';
  
  if (typeof RECOMMENDATIONS_DATA !== 'undefined' && RECOMMENDATIONS_DATA[currentType]) {
    renderRecommendations(currentType);
    UI.recommendationsSection.style.display = 'flex';
  } else {
    showEmptyState();
  }
}

// Render recommendations to carousels
function renderRecommendations(type) {
  const data = RECOMMENDATIONS_DATA[type];
  if (!data) return;

  renderCarouselItems(data.trending || [], UI.trendingCarousel);
  renderCarouselItems(data.upcoming || [], UI.upcomingCarousel);
  
  // Trigger button state updates and reset scroll positions
  document.querySelectorAll('.recs-carousel').forEach(carousel => {
    carousel.scrollLeft = 0;
    if (carousel.updateButtonsState) {
      setTimeout(carousel.updateButtonsState, 50);
    }
  });
}

// Helper to render media cards into carousel containers
function renderCarouselItems(items, container) {
  container.innerHTML = '';
  
  if (items.length === 0) {
    container.innerHTML = `<p style="padding: 24px; color: var(--text-muted); font-size: 0.85rem; text-align: center; width: 100%;">No recommendations available for this category.</p>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';

    // Subtitle text resolver
    let subtitleText = '';
    if (currentType === 'movie') subtitleText = `Dir: ${item.metadata.director || 'N/A'}`;
    else if (currentType === 'tv') subtitleText = `Net: ${item.metadata.network || 'N/A'}`;
    else if (currentType === 'book') subtitleText = `By: ${item.metadata.author || 'Unknown'}`;
    else if (currentType === 'anime') subtitleText = `Studio: ${item.metadata.studio || 'N/A'}`;
    else if (currentType === 'manga') subtitleText = `By: ${item.metadata.author || 'Unknown'}`;
    else if (currentType === 'game') subtitleText = `By: ${item.metadata.publisher || 'N/A'}`;
    else if (currentType === 'comic') subtitleText = `Writer: ${item.metadata.author || 'N/A'}`;

    // Badges HTML resolver
    let badgesHtml = '';
    if (item.year) {
      badgesHtml += `<span class="meta-badge">${item.year}</span>`;
    }
    
    if (currentType === 'movie') {
      if (item.metadata.rating) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.rating}</span>`;
      if (item.metadata.runtime) badgesHtml += `<span class="meta-badge">${item.metadata.runtime}m</span>`;
    } else if (currentType === 'tv') {
      if (item.metadata.rating) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.rating}</span>`;
      if (item.metadata.status) badgesHtml += `<span class="meta-badge">${item.metadata.status}</span>`;
    } else if (currentType === 'book') {
      if (item.metadata.pages) badgesHtml += `<span class="meta-badge">${item.metadata.pages} pgs</span>`;
    } else if (currentType === 'anime') {
      if (item.metadata.score) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.score}</span>`;
      if (item.metadata.episodes) badgesHtml += `<span class="meta-badge">${item.metadata.episodes} eps</span>`;
    } else if (currentType === 'manga') {
      if (item.metadata.volumes) badgesHtml += `<span class="meta-badge">${item.metadata.volumes} vols</span>`;
    } else if (currentType === 'game') {
      if (item.metadata.score) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.score}</span>`;
    } else if (currentType === 'comic') {
      if (item.metadata.publisher) badgesHtml += `<span class="meta-badge">${item.metadata.publisher}</span>`;
    }

    // Cover art HTML
    const coverUrl = getProxiedCoverUrl(item.cover);
    const coverHtml = coverUrl 
      ? `<img class="card-cover" src="${coverUrl}" alt="cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`
      : '';

    card.innerHTML = `
      <div class="card-cover-wrapper">
        ${coverHtml}
        <span class="cover-placeholder" style="${coverUrl ? 'display:none;' : ''}">${TYPE_EMOJIS[currentType]}</span>
      </div>
      <div class="card-details">
        <div class="card-info">
          <div class="card-title" title="${item.title}">${item.title}</div>
          <div class="card-subtitle" title="${subtitleText}">${subtitleText}</div>
          <div class="card-meta">${badgesHtml}</div>
        </div>
        <div class="card-actions">
          <button class="add-btn">
            <span>➕</span> Add to Notion
          </button>
        </div>
      </div>
    `;

    // Hook click listener to add button
    const addBtn = card.querySelector('.add-btn');
    addBtn.addEventListener('click', () => {
      addItemToNotion(item, addBtn);
    });

    container.appendChild(card);
  });
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

    renderResults(data);
  } catch (err) {
    console.error('Search failed:', err);
    renderError(err.message);
  }
}

// Render search results inside grid
function renderResults(items) {
  UI.loadingSpinner.style.display = 'none';
  
  if (!items || items.length === 0) {
    UI.resultsGrid.style.display = 'none';
    UI.emptyState.style.display = 'flex';
    UI.emptyState.querySelector('h3').textContent = 'No Results Found';
    UI.emptyState.querySelector('p').textContent = `We couldn't find any matches for that search.`;
    return;
  }

  UI.emptyState.style.display = 'none';
  UI.resultsGrid.innerHTML = '';
  UI.resultsGrid.style.display = 'grid';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';

    // Subtitle text resolver
    let subtitleText = '';
    if (currentType === 'movie') subtitleText = `Dir: ${item.metadata.director || 'N/A'}`;
    else if (currentType === 'tv') subtitleText = `Net: ${item.metadata.network || 'N/A'}`;
    else if (currentType === 'book') subtitleText = `By: ${item.metadata.author || 'Unknown'}`;
    else if (currentType === 'anime') subtitleText = `Studio: ${item.metadata.studio || 'N/A'}`;
    else if (currentType === 'manga') subtitleText = `By: ${item.metadata.author || 'Unknown'}`;
    else if (currentType === 'game') subtitleText = `By: ${item.metadata.publisher || 'N/A'}`;
    else if (currentType === 'comic') subtitleText = `Writer: ${item.metadata.author || 'N/A'}`;

    // Badges HTML resolver
    let badgesHtml = '';
    if (item.year) {
      badgesHtml += `<span class="meta-badge">${item.year}</span>`;
    }
    
    if (currentType === 'movie') {
      if (item.metadata.rating) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.rating}</span>`;
      if (item.metadata.runtime) badgesHtml += `<span class="meta-badge">${item.metadata.runtime}m</span>`;
    } else if (currentType === 'tv') {
      if (item.metadata.rating) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.rating}</span>`;
      if (item.metadata.status) badgesHtml += `<span class="meta-badge">${item.metadata.status}</span>`;
    } else if (currentType === 'book') {
      if (item.metadata.pages) badgesHtml += `<span class="meta-badge">${item.metadata.pages} pgs</span>`;
    } else if (currentType === 'anime') {
      if (item.metadata.score) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.score}</span>`;
      if (item.metadata.episodes) badgesHtml += `<span class="meta-badge">${item.metadata.episodes} eps</span>`;
    } else if (currentType === 'manga') {
      if (item.metadata.volumes) badgesHtml += `<span class="meta-badge">${item.metadata.volumes} vols</span>`;
    } else if (currentType === 'game') {
      if (item.metadata.score) badgesHtml += `<span class="meta-badge badge-score">⭐ ${item.metadata.score}</span>`;
    } else if (currentType === 'comic') {
      if (item.metadata.publisher) badgesHtml += `<span class="meta-badge">${item.metadata.publisher}</span>`;
    }

    // Cover art HTML
    const coverUrl = getProxiedCoverUrl(item.cover);
    const coverHtml = coverUrl 
      ? `<img class="card-cover" src="${coverUrl}" alt="cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`
      : '';

    card.innerHTML = `
      <div class="card-cover-wrapper">
        ${coverHtml}
        <span class="cover-placeholder" style="${coverUrl ? 'display:none;' : ''}">${TYPE_EMOJIS[currentType]}</span>
      </div>
      <div class="card-details">
        <div class="card-info">
          <div class="card-title" title="${item.title}">${item.title}</div>
          <div class="card-subtitle" title="${subtitleText}">${subtitleText}</div>
          <div class="card-meta">${badgesHtml}</div>
        </div>
        <div class="card-actions">
          <button class="add-btn">
            <span>➕</span> Add to Notion
          </button>
        </div>
      </div>
    `;

    // Hook click listener to add button
    const addBtn = card.querySelector('.add-btn');
    addBtn.addEventListener('click', () => {
      addItemToNotion(item, addBtn);
    });

    UI.resultsGrid.appendChild(card);
  });
}

// Render error state
function renderError(message) {
  UI.loadingSpinner.style.display = 'none';
  UI.resultsGrid.style.display = 'none';
  UI.recommendationsSection.style.display = 'none';
  UI.emptyState.style.display = 'flex';
  UI.emptyState.querySelector('h3').textContent = 'Search Error';
  UI.emptyState.querySelector('p').textContent = message || 'An error occurred while fetching data. Check server logs.';
}

// Add item POST request
async function addItemToNotion(item, btnElement) {
  // Update state to loading
  btnElement.classList.add('loading');
  btnElement.disabled = true;
  btnElement.innerHTML = `<span class="spinner" style="width:14px; height:14px; border-width:2px; margin-right:4px;"></span> Adding...`;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspace_id') || localStorage.getItem('workspace_id');
    const payload = {
      workspaceId,
      type: currentType,
      title: item.title,
      cover: item.cover,
      year: item.year,
      genres: item.genres,
      synopsis: item.synopsis,
      metadata: item.metadata
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

    // Success state
    btnElement.className = 'add-btn success';
    btnElement.innerHTML = `✓ Added to Notion`;
    
    // Convert button to direct link to open the Notion page
    setTimeout(() => {
      const container = btnElement.parentElement;
      container.innerHTML = `
        <a class="open-link" href="${result.url}" target="_blank">
          Open page in Notion ↗
        </a>
      `;
    }, 1500);

  } catch (err) {
    console.error('Failed to add item:', err);
    // Reset state to allow retry
    btnElement.classList.remove('loading');
    btnElement.disabled = false;
    btnElement.innerHTML = `⚠️ Failed. Retry?`;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);

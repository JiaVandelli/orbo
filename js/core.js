// ─────────────────────────────────────────────
// ORBO VIBES SYSTEM
// ─────────────────────────────────────────────
const EMOJI = {
  pizza: '🍕', sushi: '🍣', burger: '🍔', pasta: '🍝',
  ethnic: '🌮', pub: '🍺', sweet: '🍰',
  wifi: '📶', outside: '🏝️', music: '🎵', live: '🎸',
  cheap: '💸', mid: '€€', luxury: '💎',
  trending: '🔥', featured: '⭐',
  online: '🚀', offline: '📴',
  food: '🍽️', sparkle: '✨', money: '💰', planet: '🪐'
};

const ORBO_VIBES = {
  cucina: {
    label: 'Cucina', type: 'multi', icon: EMOJI.food,
    items: [
      { id: 'pizza', label: 'Pizza', emoji: EMOJI.pizza, search: ['pizza','pizzeria'] },
      { id: 'sushi', label: 'Sushi', emoji: EMOJI.sushi, search: ['sushi','giapponese'] },
      { id: 'burger', label: 'Burger', emoji: EMOJI.burger, search: ['burger','hamburger'] },
      { id: 'tradizionale', label: 'Tradizionale', emoji: EMOJI.pasta, search: ['trattoria','italiano','osteria'] },
      { id: 'etnico', label: 'Etnico', emoji: EMOJI.ethnic, search: ['messicano','indiano','thai','etnico'] },
      { id: 'pub', label: 'Pub', emoji: EMOJI.pub, search: ['pub','birreria'] },
      { id: 'dolci', label: 'Dolci', emoji: EMOJI.sweet, search: ['gelato','dessert','pasticceria'] }
    ]
  },
  vibe: {
    label: 'Atmosfera', type: 'toggle', icon: EMOJI.sparkle,
    items: [
      { id: 'wifi', label: 'WiFi', emoji: EMOJI.wifi },
      { id: 'outside', label: 'Al Fresco', emoji: EMOJI.outside },
      { id: 'music', label: 'Musica', emoji: EMOJI.music },
      { id: 'live', label: 'Live', emoji: EMOJI.live }
    ]
  },
  prezzo: {
    label: 'Prezzo', type: 'single', icon: EMOJI.money,
    items: [
      { id: 'cheap', label: 'Economico', emoji: EMOJI.cheap, desc: '<15€', levels: [0,1] },
      { id: 'mid', label: 'Medio', emoji: EMOJI.mid, desc: '15-30€', levels: [2] },
      { id: 'luxury', label: 'Lusso', emoji: EMOJI.luxury, desc: '>30€', levels: [3,4] }
    ]
  },
  discover: {
    label: 'Scopri', type: 'toggle', icon: EMOJI.planet,
    items: [
      { id: 'trending', label: 'Trending', emoji: EMOJI.trending },
      { id: 'featured', label: 'Orbo Pick', emoji: EMOJI.featured }
    ]
  }
};

const ACTIVE_VIBES = { cucina: [], vibe: [], prezzo: null, discover: [] };

function toggleVibe(category, id) {
  const cat = ORBO_VIBES[category];
  if (!cat) return;
  if (cat.type === 'single') {
    ACTIVE_VIBES[category] = ACTIVE_VIBES[category] === id? null : id;
  } else {
    const arr = ACTIVE_VIBES[category];
    const idx = arr.indexOf(id);
    idx > -1? arr.splice(idx,1) : arr.push(id);
  }
  renderVibeChips();
  if (typeof renderChips === 'function') renderChips();
  if (typeof searchAPI === 'function') {
    searchAPI(buildSearchQuery(document.getElementById('search-input')?.value.trim() || ''));
  }
}

function buildSearchQuery(userText = '') {
  const terms = [];
  ACTIVE_VIBES.cucina.forEach(id => {
    const item = ORBO_VIBES.cucina.items.find(i => i.id === id);
    if (item) terms.push(item.search[0]);
  });
  if (ACTIVE_VIBES.vibe.includes('outside')) terms.push('dehors giardino');
  if (ACTIVE_VIBES.vibe.includes('live')) terms.push('musica live');
  if (ACTIVE_VIBES.vibe.includes('wifi')) terms.push('wifi');
  if (ACTIVE_VIBES.vibe.includes('music')) terms.push('cocktail bar');
  if (ACTIVE_VIBES.prezzo === 'cheap') terms.push('economico');
  if (ACTIVE_VIBES.prezzo === 'luxury') terms.push('gourmet');
  if (ACTIVE_VIBES.discover.includes('trending')) terms.push('popolare');
  return userText.length >= 3? userText : (terms.join(' ') || 'ristorante');
}

function getVibeLabel(item) { return `${item.emoji} ${item.label}`; }

function renderVibeChips(containerId = 'vibe-filters') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  Object.entries(ORBO_VIBES).forEach(([key, group]) => {
    if (key === 'cucina') return; // cucina resta fuori
    const wrap = document.createElement('div');
    wrap.className = 'vibe-group';
    wrap.innerHTML = `<div class="vibe-title">${group.icon} ${group.label}</div>`;
    const chips = document.createElement('div');
    chips.className = 'vibe-chips';
    group.items.forEach(item => {
      const isActive = group.type === 'single'? ACTIVE_VIBES[key] === item.id : ACTIVE_VIBES[key].includes(item.id);
      const btn = document.createElement('button');
      btn.className = `vibe-chip ${isActive? 'active' : ''}`;
      btn.innerHTML = getVibeLabel(item);
      btn.onclick = () => toggleVibe(key, item.id);
      chips.appendChild(btn);
    });
    wrap.appendChild(chips);
    container.appendChild(wrap);
  });
}

function calculateOrboMatch(place) {
  let score = 0;
  if (place.rating) score += place.rating * 12;
  if (place.user_ratings_total) score += Math.min(place.user_ratings_total, 2000) / 2000 * 20;
  if (place.opening_hours?.open_now) score += 10;
  if (ACTIVE_VIBES.cucina.length) {
    const match = ORBO_VIBES.cucina.items.find(i =>
      ACTIVE_VIBES.cucina.includes(i.id) &&
      i.search.some(s => place.types?.includes(s) || place.name?.toLowerCase().includes(s))
    );
    if (match) score += 15;
  }
  if (ACTIVE_VIBES.discover.includes('featured')) score += 15;
  if (ACTIVE_VIBES.discover.includes('trending')) score += 5;
  return Math.round(score);
}

// Collega il nuovo score a maps.js senza toccarlo
window.orboScore = calculateOrboMatch;

addEventListener('online', () => toast(`${EMOJI.online} Connessione ristabilita`));
addEventListener('offline', () => toast(`${EMOJI.offline} Sei offline`));

document.addEventListener('DOMContentLoaded', () => renderVibeChips());
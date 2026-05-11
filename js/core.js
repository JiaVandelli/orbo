// ─────────────────────────────────────────────
// ORBO VIBES SYSTEM
// Discovery > semplice ricerca
// ─────────────────────────────────────────────

const EMOJI = {
  // Cucina
  pizza: '🍕', sushi: '🍣', burger: '🍔', pasta: '🍝',
  ethnic: '🌮', pub: '🍺', sweet: '🍰',
  // Vibe & Servizi
  wifi: '📶', outside: '🏝️', music: '🎵', live: '🎸',
  // Prezzo
  cheap: '💸', mid: '€€', luxury: '💎',
  // Discovery
  trending: '🔥', featured: '⭐',
  // Stato
  online: '🚀', offline: '📴',
  // UI
  food: '🍽️', sparkle: '✨', money: '💰', planet: '🪐'
};

// ─────────────────────────────────────────────
// DEFINIZIONE VIBES
// ─────────────────────────────────────────────
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
      { id: 'live', label: 'Live', emoji: EMOJI.live, featured: true }
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
      { id: 'trending', label: 'Trending', emoji: EMOJI.trending, glow: true },
      { id: 'featured', label: 'Orbo Pick', emoji: EMOJI.featured, premium: true }
    ]
  }
};

// ─────────────────────────────────────────────
// STATO ATTIVO
// ─────────────────────────────────────────────
const ACTIVE_VIBES = {
  cucina: [], vibe: [], prezzo: null, discover: []
};

// ─────────────────────────────────────────────
// GESTIONE FILTRI — FIXATO
// ─────────────────────────────────────────────
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

  // FIX: niente più filterPlaces() che non esiste
  renderVibeChips();
  if (typeof renderChips === 'function') renderChips();
}

function getVibeLabel(item) {
  return `${item.emoji} ${item.label}`;
}

// ─────────────────────────────────────────────
// RENDER UI CHIPS
// ─────────────────────────────────────────────
function renderVibeChips(containerId = 'vibe-filters') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  Object.entries(ORBO_VIBES).forEach(([key, group]) => {
    const wrap = document.createElement('div');
    wrap.className = 'vibe-group';
    wrap.innerHTML = `<div class="vibe-title">${group.icon} ${group.label}</div>`;

    const chips = document.createElement('div');
    chips.className = 'vibe-chips';

    group.items.forEach(item => {
      const isActive = group.type === 'single'
       ? ACTIVE_VIBES[key] === item.id
        : ACTIVE_VIBES[key].includes(item.id);

      const btn = document.createElement('button');
      btn.className = `vibe-chip ${isActive? 'active' : ''} ${item.glow? 'glow' : ''} ${item.premium? 'premium' : ''}`;
      btn.innerHTML = getVibeLabel(item);
      btn.onclick = () => toggleVibe(key, item.id);
      chips.appendChild(btn);
    });

    wrap.appendChild(chips);
    container.appendChild(wrap);
  });
}

// ─────────────────────────────────────────────
// MATCH SCORE
// ─────────────────────────────────────────────
function calculateOrboMatch(place) {
  let score = 0;
  if (place.rating) score += place.rating * 12;
  if (place.user_ratings_total) score += Math.min(place.user_ratings_total, 2000) / 2000 * 20;
  if (place.opening_hours?.open_now) score += 10;

  const activeCuisine = ACTIVE_VIBES.cucina;
  if (activeCuisine.length) {
    const match = ORBO_VIBES.cucina.items.find(i =>
      activeCuisine.includes(i.id) &&
      i.search.some(s => place.types?.includes(s) || place.name?.toLowerCase().includes(s))
    );
    if (match) score += 15;
  }

  if (ACTIVE_VIBES.discover.includes('featured')) score += 15;
  if (ACTIVE_VIBES.discover.includes('trending')) score += (place.popularity || 5);

  return Math.round(score);
}

// ─────────────────────────────────────────────
// TOAST STATO RETE
// ─────────────────────────────────────────────
addEventListener('online', () => toast(`${EMOJI.online} Connessione ristabilita`));
addEventListener('offline', () => toast(`${EMOJI.offline} Sei offline`));

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => renderVibeChips());
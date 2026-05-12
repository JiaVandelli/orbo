'use strict';

const $ = id => document.getElementById(id);

const App = {
  venues: [],
  userLoc: null,
  map: null,
  placesService: null,
  debT: null,
  lastRenderKey: '',
  lastQuery: '',
  searchCache: new Map(),
  state: {
    favs:    (()=>{ try{ return JSON.parse(localStorage.getItem('orbo_favs')||'[]') }catch{ return [] } })(),
    history: (()=>{ try{ return JSON.parse(localStorage.getItem('orbo_history')||'[]') }catch{ return [] } })(),
    activeCat: 'all'
  }
};

const CACHE_MAX  = 40;
const FOOD_TYPES = ['restaurant','cafe','bakery','meal_takeaway','bar','food'];

// ── EMOJI ─────────────────────────────────────────
const EMOJI = {
  pizza:'🍕', sushi:'🍣', burger:'🍔', pasta:'🍝',
  ethnic:'🌮', pub:'🍺', sweet:'🍰',
  wifi:'📶', outside:'🏝️', music:'🎵', live:'🎸',
  cheap:'💸', mid:'€€', luxury:'💎',
  trending:'🔥', featured:'⭐',
  online:'🚀', offline:'📴',
  food:'🍽️', sparkle:'✨', money:'💰', planet:'🪐'
};

// ── ORBO VIBES ────────────────────────────────────
const ORBO_VIBES = {
  cucina: {
    label:'Cucina', type:'multi', icon:EMOJI.food,
    items:[
      {id:'pizza',        label:'Pizza',        emoji:EMOJI.pizza,   search:['pizza','pizzeria']},
      {id:'sushi',        label:'Sushi',         emoji:EMOJI.sushi,   search:['sushi','giapponese']},
      {id:'burger',       label:'Burger',        emoji:EMOJI.burger,  search:['burger','hamburger']},
      {id:'tradizionale', label:'Tradizionale',  emoji:EMOJI.pasta,   search:['trattoria','italiano','osteria']},
      {id:'etnico',       label:'Etnico',        emoji:EMOJI.ethnic,  search:['messicano','indiano','thai','etnico']},
      {id:'pub',          label:'Pub',           emoji:EMOJI.pub,     search:['pub','birreria']},
      {id:'dolci',        label:'Dolci',         emoji:EMOJI.sweet,   search:['gelato','dessert','pasticceria']}
    ]
  },
  vibe: {
    label:'Atmosfera', type:'toggle', icon:EMOJI.sparkle,
    items:[
      {id:'wifi',    label:'WiFi',      emoji:EMOJI.wifi},
      {id:'outside', label:'Al Fresco', emoji:EMOJI.outside},
      {id:'music',   label:'Musica',    emoji:EMOJI.music},
      {id:'live',    label:'Live',      emoji:EMOJI.live}
    ]
  },
  prezzo: {
    label:'Prezzo', type:'single', icon:EMOJI.money,
    items:[
      {id:'cheap',   label:'Economico', emoji:EMOJI.cheap,   levels:[0,1]},
      {id:'mid',     label:'Medio',     emoji:EMOJI.mid,     levels:[2]},
      {id:'luxury',  label:'Lusso',     emoji:EMOJI.luxury,  levels:[3,4]}
    ]
  },
  discover: {
    label:'Scopri', type:'toggle', icon:EMOJI.planet,
    items:[
      {id:'trending', label:'Trending',  emoji:EMOJI.trending},
      {id:'featured', label:'Orbo Pick', emoji:EMOJI.featured}
    ]
  }
};

const ACTIVE_VIBES = { cucina:[], vibe:[], prezzo:null, discover:[] };

// ── VIBE LOGIC ────────────────────────────────────
function toggleVibe(cat, id) {
  const c = ORBO_VIBES[cat];
  if (!c) return;
  if (c.type === 'single') {
    ACTIVE_VIBES[cat] = ACTIVE_VIBES[cat] === id ? null : id;
  } else {
    const a = ACTIVE_VIBES[cat];
    const i = a.indexOf(id);
    i > -1 ? a.splice(i, 1) : a.push(id);
  }
  renderVibeChips('vibe-filters');
  if (typeof renderChips === 'function') renderChips();
  if (typeof searchAPI === 'function') {
    searchAPI(buildSearchQuery($('search-input')?.value.trim() || ''));
  }
}

function buildSearchQuery(t = '') {
  const terms = [];
  if (t && t.length >= 2) terms.push(t);
  ACTIVE_VIBES.cucina.forEach(id => {
    const it = ORBO_VIBES.cucina.items.find(x => x.id === id);
    if (it) terms.push(it.search[0]);
  });
  if (ACTIVE_VIBES.vibe.includes('outside')) terms.push('dehors giardino');
  if (ACTIVE_VIBES.vibe.includes('live'))    terms.push('musica live');
  if (ACTIVE_VIBES.vibe.includes('wifi'))    terms.push('wifi');
  if (ACTIVE_VIBES.vibe.includes('music'))   terms.push('cocktail bar');
  if (ACTIVE_VIBES.prezzo === 'cheap')       terms.push('economico');
  if (ACTIVE_VIBES.prezzo === 'luxury')      terms.push('gourmet fine dining');
  if (ACTIVE_VIBES.discover.includes('trending')) terms.push('popolare');
  return terms.join(' ').trim() || 'ristoranti';
}

function renderVibeChips(containerId = 'vibe-filters') {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = '';
  Object.entries(ORBO_VIBES).forEach(([key, group]) => {
    if (key === 'cucina') return; // cucina ha la sua riga di chip separata
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
      btn.className = 'vibe-chip' + (isActive ? ' active' : '');
      btn.innerHTML = `${item.emoji} ${item.label}`;
      btn.setAttribute('aria-pressed', String(isActive));
      btn.onclick = () => toggleVibe(key, item.id);
      chips.appendChild(btn);
    });
    wrap.appendChild(chips);
    el.appendChild(wrap);
  });
}

// ── UTILS ─────────────────────────────────────────
function esc(s = '') {
  return String(s).replace(/[&<>"'`]/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m]
  ));
}
function saveFavs() { try{ localStorage.setItem('orbo_favs',    JSON.stringify(App.state.favs))    }catch{} }
function saveHist() { try{ localStorage.setItem('orbo_history', JSON.stringify(App.state.history)) }catch{} }

function getCachedGeo() {
  try {
    const raw = sessionStorage.getItem('orbo_geo');
    if (!raw) return null;
    const {lat, lng, ts} = JSON.parse(raw);
    if (Date.now() - ts < 3_600_000) return {lat, lng};
    sessionStorage.removeItem('orbo_geo');
  } catch {}
  return null;
}
function setCachedGeo(lat, lng) {
  try { sessionStorage.setItem('orbo_geo', JSON.stringify({lat, lng, ts: Date.now()})) } catch {}
}

// ── CANVAS STELLE ─────────────────────────────────
const canvasCtrl = (() => {
  const c = $('bg-canvas');
  if (!c) return { setActive: () => {} };
  const ctx = c.getContext('2d');
  let W, H, stars = [], rafId = null, active = true;

  function resize() {
    W = c.width  = innerWidth;
    H = c.height = innerHeight;
    const n = innerWidth < 768 ? 15 : 60;
    stars = Array.from({length: n}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.2+.2,
      a: Math.random(), speed: Math.random()*.004+.001
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      s.a += s.speed;
      if (s.a > 1) s.a = 0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,200,120,${s.a*.7})`;
      ctx.fill();
    });
    if (active) rafId = requestAnimationFrame(draw);
  }

  function start() { if (!rafId && active) draw(); }
  function stop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  function setActive(v) { active = v; v ? start() : stop(); }

  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => setActive(!document.hidden));
  start();
  return { setActive };
})();

// ── CURSOR GLOW ───────────────────────────────────
if (innerWidth >= 768) {
  const glow = $('cursor-glow');
  if (glow) {
    Object.assign(glow.style, {
      width:'260px', height:'260px', borderRadius:'50%',
      background:'radial-gradient(circle,rgba(255,140,0,.15),transparent 70%)',
      filter:'blur(28px)', position:'fixed', pointerEvents:'none',
      left:'0', top:'0', zIndex:'-1', opacity:'0', transition:'opacity .3s'
    });
    let raf = null;
    addEventListener('mousemove', e => {
      glow.style.opacity = '.9';
      if (raf) return;
      raf = requestAnimationFrame(() => {
        glow.style.transform = `translate(${e.clientX-130}px,${e.clientY-130}px)`;
        raf = null;
      });
    });
    addEventListener('mouseout', () => { glow.style.opacity = '0'; });
  }
}

// ── PARTICELLE ────────────────────────────────────
(() => {
  const c = $('particles');
  if (!c) return;
  const frag = document.createDocumentFragment();
  Array.from({length: 28}, () => {
    const s = document.createElement('span');
    s.style.cssText = `left:${Math.random()*100}%;bottom:0;animation-delay:${Math.random()*10}s;animation-duration:${7+Math.random()*8}s`;
    frag.appendChild(s);
  });
  c.appendChild(frag);
})();

// ── COUNTER STATS ─────────────────────────────────
function animateStats() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const tgt = +el.dataset.count, suf = tgt === 15 ? 'k' : '';
    let n = 0;
    const step = () => {
      n = Math.min(n + Math.max(1, tgt/50), tgt);
      el.textContent = Math.ceil(n) + suf;
      if (n < tgt) requestAnimationFrame(step);
    };
    step();
  });
}
const statsObs = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) { animateStats(); statsObs.disconnect(); }
}, {threshold: .2});
if ($('stats-row')) statsObs.observe($('stats-row'));

// ── TOAST ─────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── NAVIGATE ──────────────────────────────────────
function navigate(v) {
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-'+v));
  canvasCtrl.setActive(v === 'home' && !document.hidden);
  if (v === 'search') { renderHistory(); setTimeout(() => $('search-input')?.focus(), 300); }
}

function closeMobileNav() {
  const n = $('mobile-nav');
  if (!n) return;
  n.classList.remove('open');
  n.style.display = 'none';
  $('menu-btn')?.setAttribute('aria-expanded', 'false');
}

// ── STORIA RICERCHE ───────────────────────────────
function saveHistory(q) {
  if (!q || q.length < 2) return;
  App.state.history = [q, ...App.state.history.filter(x => x !== q)].slice(0, 5);
  saveHist();
}

function renderHistory() {
  const row = $('history-row');
  if (!row || !App.state.history.length) { if (row) row.innerHTML = ''; return; }
  const frag = document.createDocumentFragment();
  App.state.history.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'history-chip';
    btn.textContent = '🕐 ' + h;
    btn.setAttribute('aria-label', 'Cerca di nuovo: ' + h);
    btn.onclick = () => doSearch(h);
    frag.appendChild(btn);
  });
  row.innerHTML = '';
  row.appendChild(frag);
}

// ── HAVERSINE ─────────────────────────────────────
function distanza(la1, lo1, la2, lo2) {
  const R = 6371, dLa = (la2-la1)*Math.PI/180, dLo = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(dLa/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}

function openMaps(lat, lng) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener');
}

// ── EVENTI GLOBALI ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('menu-btn')?.addEventListener('click', () => {
    const n = $('mobile-nav');
    const open = n?.classList.toggle('open');
    if (n) n.style.display = open ? 'flex' : 'none';
    $('menu-btn')?.setAttribute('aria-expanded', String(open));
  });
  $('logo-btn')?.addEventListener('click', () => navigate('home'));
  $('logo-btn')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('home'); }
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('detail-modal')?.classList.contains('open')) closeModal();
    else closeMobileNav();
  }
});
addEventListener('offline', () => toast('📡 Connessione persa'));
addEventListener('online',  () => toast('🚀 Connessione ristabilita'));
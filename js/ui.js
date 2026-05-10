'use strict';

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
    favs: (()=>{ try{ return JSON.parse(localStorage.getItem('orbo_favs')||'[]') }catch{ return [] } })(),
    history: (()=>{ try{ return JSON.parse(localStorage.getItem('orbo_history')||'[]') }catch{ return [] } })(),
    activeCat: 'all'
  }
};

const CACHE_MAX  = 40;
const FOOD_TYPES = ['restaurant','cafe','bakery','meal_takeaway','bar','food'];
const CATS = [
  {id:'all',          label:'Tutti',      icon:'🔥', query:'ristorante'},
  {id:'pizza',        label:'Pizza',      icon:'🍕', query:'pizzeria'},
  {id:'sushi',        label:'Sushi',      icon:'🍣', query:'sushi'},
  {id:'burger',       label:'Burger',     icon:'🍔', query:'hamburger'},
  {id:'date',         label:'Date night', icon:'💕', query:'ristorante romantico'},
  {id:'chill',        label:'Chill',      icon:'🌙', query:'locale tranquillo'},
  {id:'insta',        label:'Instagram',  icon:'📸', query:'ristorante design'},
  {id:'cheap',        label:'Economico',  icon:'💸', query:'ristorante economico'},
  {id:'laptop',       label:'Studio',     icon:'💻', query:'cafe wifi'},
  {id:'late',         label:'Notturno',   icon:'🌃', query:'aperto fino tardi'}
];

// ── UTILS ─────────────────────────────────────────
const $ = id => document.getElementById(id);

function esc(s = '') {
  return String(s).replace(/[&<>"'`]/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m]
  ));
}

function saveFavs() { try{ localStorage.setItem('orbo_favs',    JSON.stringify(App.state.favs))    }catch{} }
function saveHist() { try{ localStorage.setItem('orbo_history', JSON.stringify(App.state.history)) }catch{} }

// ── GEO CACHE (1 ora) ─────────────────────────────
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
    const n = window.innerWidth < 768 ? 15 : 60;
    stars = Array.from({length: n}, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.2 + .2,
      a: Math.random(), speed: Math.random() * .004 + .001
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      s.a += s.speed;
      if (s.a > 1) s.a = 0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,120,${s.a * .7})`;
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
if (window.innerWidth >= 768) {
  const glow = $('cursor-glow');
  Object.assign(glow.style, {
    width:'260px', height:'260px', borderRadius:'50%',
    background:'radial-gradient(circle,rgba(255,140,0,.15),transparent 70%)',
    filter:'blur(28px)', transform:'translate(-50%,-50%)',
    opacity:'0', transition:'opacity .3s',
    position:'fixed', pointerEvents:'none', left:'0', top:'0', zIndex:'-1'
  });
  
  let rafId = null;
  let mouseX = 0, mouseY = 0;
  
  addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    glow.style.opacity = '.9';
    
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      glow.style.transform = `translate(${mouseX - 130}px, ${mouseY - 130}px)`;
      rafId = null;
    });
  });
  
  addEventListener('mouseout', () => { glow.style.opacity = '0'; });
}

// ── PARTICELLE ────────────────────────────────────
(() => {
  const c = $('particles'), frag = document.createDocumentFragment();
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
      n = Math.min(n + Math.max(1, tgt / 50), tgt);
      el.textContent = Math.ceil(n) + suf;
      if (n < tgt) requestAnimationFrame(step);
    };
    step();
  });
}
const statsObs = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) { animateStats(); statsObs.disconnect(); }
}, {threshold: .2});
statsObs.observe($('stats-row'));

// ── TOAST ─────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $('toast');
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── NAVIGATE ──────────────────────────────────────
function navigate(v) {
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  canvasCtrl.setActive(v === 'home' && !document.hidden);
  if (v === 'search') { renderHistory(); setTimeout(() => $('search-input')?.focus(), 300); }
}

function closeMobileNav() {
  const n = $('mobile-nav');
  n.classList.remove('open');
  n.style.display = 'none';
  $('menu-btn').setAttribute('aria-expanded', 'false');
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
$('menu-btn').addEventListener('click', () => {
  const n = $('mobile-nav'), open = n.classList.toggle('open');
  n.style.display = open ? 'flex' : 'none';
  $('menu-btn').setAttribute('aria-expanded', String(open));
});
$('logo-btn').addEventListener('click', () => navigate('home'));
$('logo-btn').addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); navigate('home'); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('detail-modal').classList.contains('open')) closeModal();
    else closeMobileNav();
  }
});
addEventListener('offline', () => toast('📡 Connessione persa'));
addEventListener('online',  () => toast('🚀 Connessione ristabilita'));

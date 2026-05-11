'use strict';

// ── CHIPS CUCINA (sostituisce CATS) ─────────────────────────
function renderChips() {
  const frag = document.createDocumentFragment();
  const cucina = ORBO_VIBES.cucina.items;

  cucina.forEach(cat => {
    const isActive = ACTIVE_VIBES.cucina.includes(cat.id);
    const btn = document.createElement('button');
    btn.className = 'chip' + (isActive? ' active' : '');
    btn.textContent = `${cat.emoji} ${cat.label}`;
    btn.setAttribute('aria-pressed', String(isActive));
    btn.onclick = () => toggleCuisine(cat, btn);
    frag.appendChild(btn);
  });

  const el = $('chips');
  el.innerHTML = '';
  el.appendChild(frag);
}

function toggleCuisine(cat, el) {
  toggleVibe('cucina', cat.id); // usa la funzione del core.js

  // aggiorna UI chip
  document.querySelectorAll('#chips.chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
  });
  if (ACTIVE_VIBES.cucina.includes(cat.id)) {
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
  }

  // cerca
  const q = $('search-input').value.trim();
  if (q.length >= 3) {
    searchAPI(q);
  } else {
    searchAPI(cat.search[0]); // usa la prima keyword
  }
}

// ── EVENT DELEGATION LISTA ────────────────────────
(() => {
  const list = $('results-list');
  list.addEventListener('click', e => {
    const card = e.target.closest('.result-card');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.rc-btn.go')) { e.stopPropagation(); openMaps(parseFloat(card.dataset.lat), parseFloat(card.dataset.lng)); return; }
    if (e.target.closest('.rc-btn.detail') || e.target.closest('.rc-img')) { e.stopPropagation(); showDetail(id); return; }
    if (e.target.closest('.fav-btn')) { e.stopPropagation(); toggleFav(id, e.target.closest('.fav-btn')); return; }
    showDetail(id);
  });
  list.addEventListener('keydown', e => {
    if (e.key!== 'Enter' && e.key!== ' ') return;
    const card = e.target.closest('.result-card');
    if (card) { e.preventDefault(); showDetail(card.dataset.id); }
  });
})();

// ── VIBE TAG DINAMICO ─────────────────────────────
function getVibeTag() {
  const tags = [];

  // prendi i vibe attivi
  ACTIVE_VIBES.vibe.forEach(id => {
    const item = ORBO_VIBES.vibe.items.find(i => i.id === id);
    if (item) tags.push(`${item.emoji} ${item.label}`);
  });

  // aggiungi prezzo se selezionato
  if (ACTIVE_VIBES.prezzo) {
    const p = ORBO_VIBES.prezzo.items.find(i => i.id === ACTIVE_VIBES.prezzo);
    if (p) tags.push(`${p.emoji} ${p.label}`);
  }

  // fallback: se niente selezionato, mostra cucina attiva
  if (!tags.length && ACTIVE_VIBES.cucina.length) {
    const c = ORBO_VIBES.cucina.items.find(i => i.id === ACTIVE_VIBES.cucina[0]);
    if (c) tags.push(`${c.emoji} ${c.label}`);
  }

  return tags.length? `<div class="rc-vibe">${tags.join(' · ')}</div>` : '';
}

// ── RENDER CARDS (invariato, usa getVibeTag nuovo) ──
function renderResults() {
  const list = $('results-list'), cnt = $('results-count'), empty = $('empty-state');
  hideSkeleton();
  if (!App.venues.length) {
    empty.style.display = 'block'; list.innerHTML = ''; cnt.textContent = ''; App.lastRenderKey = '';
    return;
  }
  const key = App.venues.map(v => v.id).join(',');
  if (key === App.lastRenderKey) return;
  App.lastRenderKey = key;

  empty.style.display = 'none';
  cnt.textContent = `${App.venues.length} locali trovati ${EMOJI.trending}`;

  const frag = document.createDocumentFragment();
  App.venues.forEach((v, i) => {
    const dist = App.userLoc? distanza(App.userLoc.lat, App.userLoc.lng, v.lat, v.lng) : null;
    const isFav = App.state.favs.includes(v.id);
    const el = document.createElement('article');
    el.className = 'result-card';
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', esc(v.name));
    el.style.animation = `cardIn.4s ${i *.05}s ease both`;
    el.dataset.id = v.id;
    el.dataset.lat = v.lat;
    el.dataset.lng = v.lng;
    el.innerHTML = `
      <div class="rc-img">
        <img src="${esc(v.photo)}" loading="lazy" width="400" height="300" alt="${esc(v.name)}"
             onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fm=webp&q=60'">
        <div class="rc-img-overlay"></div>
        <span class="rc-badge">${esc(v.price)}</span>
        ${v.openNow!= null? `<span class="rc-open ${v.openNow?'open':'closed'}">${v.openNow?'Aperto':'Chiuso'}</span>` : ''}
      </div>
      <div class="rc-body">
        <div class="rc-name">${esc(v.name)} <span class="rc-score-inline">${EMOJI.featured} ${v.score}</span></div>
        ${getVibeTag()}
        <div class="rc-address" title="${esc(v.address)}">${esc(v.address)}</div>
        <div class="rc-rating">
          <span class="rc-stars" aria-hidden="true">${'★'.repeat(Math.round(v.rating) || 4)}</span>
          <span class="rc-num">${v.rating && v.rating > 0? v.rating.toFixed(1) : 'N/A'}${v.reviews? ' (' + v.reviews + ')' : ''}</span>
        </div>
        ${dist!= null? `<div class="rc-dist">📍 ${dist} km da te</div>` : ''}
        <div class="rc-footer">
          <div class="rc-actions">
            <button class="rc-btn go" aria-label="Indicazioni per ${esc(v.name)}">🗺️ Vai</button>
            <button class="rc-btn detail" aria-label="Info su ${esc(v.name)}">ℹ️ Info</button>
          </div>
          <button class="fav-btn ${isFav?'active':''}" aria-pressed="${isFav}"
                  aria-label="${isFav?'Rimuovi dai':'Aggiungi ai'} preferiti">
            ${isFav? '❤️' : '🤍'}
          </button>
        </div>
      </div>`;
    frag.appendChild(el);
  });
  list.innerHTML = '';
  list.appendChild(frag);
}

// ── DETAIL MODAL, PREFERITI, SKELETON (invariati) ──
// [incolla qui le tue funzioni showDetail, closeModal, toggleFav, toggleFavModal, showSkeleton, hideSkeleton, showEmpty, clearSearch — sono perfette così]

// ── SEARCH INPUT EVENTS ───────────────────────────
$('search-input').addEventListener('input', e => {
  const q = e.target.value.trim();
  $('search-clear').style.display = q? 'block' : 'none';
  if (q.length >= 3) searchAPI(q);
  else if (!q) { clearTimeout(App.debT); $('results-list').innerHTML=''; $('results-count').textContent=''; App.lastRenderKey=''; showEmpty(); }
});

$('search-input').addEventListener('keydown', e => {
  if (e.key!== 'Enter') return;
  const q = $('search-input').value.trim();
  if (q.length < 2) return;
  clearTimeout(App.debT);
  saveHistory(q);
  searchAPI(q);
});

// ── NUOVI PULSANTI FILTRO ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderChips(); // renderizza chips cucina
  renderVibeChips('vibe-filters'); // renderizza pannello vibe dal core.js

  const searchInput = $('search-input');
  if (!searchInput) return;

  const searchBox = searchInput.parentElement;
  if (document.querySelector('.search-tools')) return;

  searchBox.insertAdjacentHTML('afterend', `
    <div class="search-tools">
      <button id="btn-filtro" class="tool-btn filtro">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" stroke="currentColor" stroke-width="2"/></svg>
        Filtra
      </button>
      <button id="btn-extra" class="tool-btn ghost">🎲</button>
    </div>
  `);

  $('btn-extra').onclick = () => {
    const cucina = ORBO_VIBES.cucina.items;
    const random = cucina[Math.floor(Math.random()*cucina.length)];
    ACTIVE_VIBES.cucina = [random.id];
    renderChips();
    searchAPI(random.search[0]);
    toast(`${EMOJI.trending} ${random.label}!`);
  };

  $('btn-filtro').onclick = () => {
    $('vibe-filters').classList.toggle('open');
    toast(`${EMOJI.sparkle} Filtri vibe`);
  };
});
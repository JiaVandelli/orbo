'use strict';

function renderChips() {
  const frag = document.createDocumentFragment();
  ORBO_VIBES.cucina.items.forEach(cat => {
    const isActive = ACTIVE_VIBES.cucina.includes(cat.id);
    const btn = document.createElement('button');
    btn.className = 'chip' + (isActive? ' active' : '');
    btn.textContent = `${cat.emoji} ${cat.label}`;
    btn.setAttribute('aria-pressed', String(isActive));
    btn.onclick = () => toggleVibe('cucina', cat.id);
    frag.appendChild(btn);
  });
  const el = $('chips');
  el.innerHTML = '';
  el.appendChild(frag);
}

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

function getVibeTag() {
  const tags = [];
  ACTIVE_VIBES.vibe.forEach(id => {
    const item = ORBO_VIBES.vibe.items.find(i => i.id === id);
    if (item) tags.push(`${item.emoji} ${item.label}`);
  });
  if (ACTIVE_VIBES.prezzo) {
    const p = ORBO_VIBES.prezzo.items.find(i => i.id === ACTIVE_VIBES.prezzo);
    if (p) tags.push(`${p.emoji} ${p.label}`);
  }
  if (!tags.length && ACTIVE_VIBES.cucina.length) {
    const c = ORBO_VIBES.cucina.items.find(i => i.id === ACTIVE_VIBES.cucina[0]);
    if (c) tags.push(`${c.emoji} ${c.label}`);
  }
  return tags.length? `<div class="rc-vibe">${tags.join(' · ')}</div>` : '';
}

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
    el.style.animation = `cardIn.4s ${i * 0.05}s ease both`;
    el.dataset.id = v.id; el.dataset.lat = v.lat; el.dataset.lng = v.lng;
    el.innerHTML = `
      <div class="rc-img">
        <img src="${esc(v.photo)}" loading="lazy" width="400" height="300" alt="${esc(v.name)}"
             onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fm=webp&q=60'">
        <div class="rc-img-overlay"></div>
        <span class="rc-badge">${esc(v.price)}</span>
        ${v.openNow!= null? `<span class="rc-open ${v.openNow? 'open' : 'closed'}">${v.openNow? 'Aperto' : 'Chiuso'}</span>` : ''}
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
          <button class="fav-btn ${isFav? 'active' : ''}" aria-pressed="${isFav}"
                  aria-label="${isFav? 'Rimuovi dai' : 'Aggiungi ai'} preferiti">${isFav? '❤️' : '🤍'}</button>
        </div>
      </div>`;
    frag.appendChild(el);
  });
  list.innerHTML = ''; list.appendChild(frag);
}

// --- TUTTE LE TUE FUNZIONI ORIGINALI INVARIATE ---
function showDetail(placeId) { /*...incolla il tuo showDetail originale... */ }
function closeModal() { $('detail-modal').classList.remove('open'); document.body.style.overflow = ''; }
function toggleFav(id, btn) { /*...il tuo toggleFav originale... */ }
function toggleFavModal(id) { /*...il tuo toggleFavModal originale... */ }
function showSkeleton() { /*... */ }
function hideSkeleton() { $('results-list').querySelectorAll('.skeleton-card').forEach(s => s.remove()); }
function showEmpty() { $('empty-state').style.display = 'block'; }
function clearSearch() { /*... */ }

// --- INPUT ---
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
  clearTimeout(App.debT); saveHistory(q); searchAPI(buildSearchQuery(q));
});

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  renderChips();
  renderVibeChips('vibe-filters');
  const searchInput = $('search-input');
  if (!searchInput) return;
  const searchBox = searchInput.parentElement;
  if (!document.querySelector('.search-tools')) {
    searchBox.insertAdjacentHTML('afterend', `
      <div class="search-tools">
        <button id="btn-filtro" class="tool-btn filtro">Filtra</button>
        <button id="btn-extra" class="tool-btn ghost">🎲</button>
      </div>
    `);
    $('btn-extra').onclick = () => {
      const r = ORBO_VIBES.cucina.items[Math.floor(Math.random()*7)];
      ACTIVE_VIBES.cucina = [r.id]; renderChips(); searchAPI(buildSearchQuery(''));
      toast(`${EMOJI.trending} ${r.label}!`);
    };
    $('btn-filtro').onclick = () => $('vibe-filters').classList.toggle('open');
  }
});
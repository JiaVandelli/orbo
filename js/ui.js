'use strict';

// ── CHIPS ─────────────────────────────────────────
function renderChips() {
  const frag = document.createDocumentFragment();
  CATS.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (cat.id === App.state.activeCat? ' active' : '');
    btn.textContent = cat.icon + ' ' + cat.label;
    btn.setAttribute('aria-pressed', String(cat.id === App.state.activeCat));
    btn.onclick = () => setCat(cat.id, btn);
    frag.appendChild(btn);
  });
  const el = $('chips'); el.innerHTML = ''; el.appendChild(frag);
}

function setCat(id, el) {
  App.state.activeCat = id;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.remove('active'); c.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active'); el.setAttribute('aria-pressed', 'true');

  const cat = CATS.find(c => c.id === id);
  const query = cat?.query || id;

  const q = $('search-input').value.trim();
  if (q.length >= 3) {
    searchAPI(q);
  } else {
    searchAPI(query); // ← QUESTO è il cambio chiave
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

function getVibeTag() {
  const map = {
    date: '💕 Romantico',
    chill: '🌙 Tranquillo',
    insta: '📸 Instagrammabile',
    cheap: '💸 Economico',
    laptop: '💻 WiFi',
    late: '🌃 Aperto tardi'
  };
  const tag = map[App.state.activeCat];
  return tag? <div class="rc-vibe">${tag}</div> : '';
}

// ── RENDER CARDS ──────────────────────────────────
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
  cnt.textContent = ${App.venues.length} locali trovati 🔥;

  const frag = document.createDocumentFragment();
  App.venues.forEach((v, i) => {
    const dist = App.userLoc? distanza(App.userLoc.lat, App.userLoc.lng, v.lat, v.lng) : null;
    const isFav = App.state.favs.includes(v.id);
    const el = document.createElement('article');
    el.className = 'result-card';
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', esc(v.name));
    el.style.animation = cardIn .4s ${i * .05}s ease both;
    el.dataset.id = v.id;
    el.dataset.lat = v.lat;
    el.dataset.lng = v.lng;
    el.innerHTML = `
      <div class="rc-img">
        <img src="${esc(v.photo)}" loading="lazy" width="400" height="300" alt="${esc(v.name)}"
             onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fm=webp&q=60'">
        <div class="rc-img-overlay"></div>
        <span class="rc-badge">${esc(v.price)}</span>
        ${v.openNow!= null? <span class="rc-open ${v.openNow?'open':'closed'}">${v.openNow?'Aperto':'Chiuso'}</span> : ''}
      </div>
      <div class="rc-body">
        <div class="rc-name">${esc(v.name)} <span class="rc-score-inline">⭐ ${v.score}</span></div>
        ${getVibeTag()}
        <div class="rc-address" title="${esc(v.address)}">${esc(v.address)}</div>
        <div class="rc-rating">
          <span class="rc-stars" aria-hidden="true">${'★'.repeat(Math.round(v.rating) || 4)}</span>
          <span class="rc-num">${v.rating && v.rating > 0? v.rating.toFixed(1) : 'N/A'}${v.reviews? ' (' + v.reviews + ')' : ''}</span>
        </div>
        ${dist!= null? <div class="rc-dist">📍 ${dist} km da te</div> : ''}
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

// ── DETAIL MODAL ──────────────────────────────────
function showDetail(placeId) {
  const v = App.venues.find(x => x.id === placeId);
  if (!v ||!App.placesService) return;
  App.placesService.getDetails({
    placeId,
    fields: ['name','rating','user_ratings_total','formatted_phone_number','website','opening_hours','photos','formatted_address','price_level']
  }, (place, st) => {
    if (st === 'OVER_QUERY_LIMIT') { toast('⚠️ Limite API raggiunto'); return; }
    if (st!== 'OK') return;

    $('modal-img').src = place.photos?.[0]?.getUrl({maxWidth: 900}) || v.photo || '';
    const price = '€'.repeat(Math.max(1, place.price_level || 1));
    const todayIdx = new Date().getDay();

    const hours = place.opening_hours?.weekday_text
     ?.map((h, i) => <div class="hours-row ${i===(todayIdx===0?6:todayIdx-1)?'today':''}">${esc(h)}</div>)
     .join('') || '<div class="hours-row" style="opacity:.45">Orari non disponibili</div>';

    const totalReviews = place.user_ratings_total || 0;
    const reviewsBlock = totalReviews > 0? `
      <div class="reviews-cta">
        <div class="reviews-cta-text">
          <strong>${totalReviews.toLocaleString('it-IT')} recensioni</strong> verificate su Google
        </div>
        <a class="reviews-cta-btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + (place.formatted_address || ''))}&query_place_id=${placeId}" target="_blank" rel="noopener">
          📖 Leggi tutte le recensioni
        </a>
      </div>` : '<div style="opacity:.5;font-size:14px">Nessuna recensione disponibile</div>';

    const isFav = App.state.favs.includes(placeId);
    const ratingDisplay = place.rating!= null? place.rating.toFixed(1) : '-';

    $('modal-body').innerHTML = `
      <div class="modal-title" id="modal-title-text">${esc(place.name)}</div>
      <div class="modal-rating">
        <span class="modal-stars" aria-hidden="true">${'★'.repeat(Math.round(place.rating || 0) || 4)}</span>
        <span>${ratingDisplay} · ${esc(price)}${totalReviews? ' · ' + totalReviews.toLocaleString('it-IT') + ' rec.' : ''}</span>
        <span class="modal-score">⭐ Orbo ${v.score}</span>
      </div>
      <div class="modal-actions">
        <a class="ma-btn primary" href="https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}" target="_blank" rel="noopener noreferrer">🗺️ Indicazioni</a>
        ${place.formatted_phone_number? <a class="ma-btn secondary" href="tel:${esc(place.formatted_phone_number)}">📞 Chiama</a> : ''}
        ${place.website? <a class="ma-btn secondary" href="${esc(place.website)}" target="_blank" rel="noopener noreferrer">🌐 Sito</a> : ''}
        <button class="ma-btn secondary${isFav?' active':''}" id="modal-fav" aria-pressed="${isFav}" data-fav-id="${esc(placeId)}">${isFav? '❤️ Salvato' : '🤍 Salva'}</button>
      </div>
      <div class="modal-section"><div class="modal-section-title">📍 Indirizzo</div><p>${esc(place.formatted_address || v.address)}</p></div>
      <div class="modal-section"><div class="modal-section-title">🕐 Orari</div>${hours}</div>
      <div class="modal-section"><div class="modal-section-title">💬 Recensioni</div>${reviewsBlock}</div>`;

    $('detail-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('modal-close-btn')?.focus(), 50);
  });
}

function closeModal() {
  $('detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// modal-fav usa data-fav-id, zero onclick inline
$('modal-body').addEventListener('click', e => {
  if (e.target.id === 'modal-fav') toggleFavModal(e.target.dataset.favId);
});

// focus trap modale
$('detail-modal').addEventListener('keydown', e => {
  if (e.key!== 'Tab') return;
  const focusable = [...$('detail-modal').querySelectorAll('button,a,[tabindex]:not([tabindex="-1"])')]
   .filter(el =>!el.disabled && el.offsetParent!== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey) { if (document.activeElement===first) { e.preventDefault(); last.focus(); } }
  else { if (document.activeElement===last) { e.preventDefault(); first.focus(); } }
});

// ── PREFERITI ─────────────────────────────────────
function toggleFav(id, btn) {
  const idx = App.state.favs.indexOf(id);
  if (idx > -1) {
    App.state.favs.splice(idx, 1);
    btn.textContent = '🤍'; btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Aggiungi ai preferiti');
    toast('💔 Rimosso dai preferiti');
  } else {
    App.state.favs.push(id);
    btn.textContent = '❤️'; btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'Rimuovi dai preferiti');
    toast('❤️ Salvato nei preferiti!');
  }
  saveFavs();
}

function toggleFavModal(id) {
  const idx = App.state.favs.indexOf(id);
  idx > -1? App.state.favs.splice(idx, 1) : App.state.favs.push(id);
  saveFavs();
  const btn = $('modal-fav');
  if (btn) {
    const now = App.state.favs.includes(id);
    btn.textContent = now? '❤️ Salvato' : '🤍 Salva';
    btn.setAttribute('aria-pressed', String(now));
  }
  toast(idx > -1? '💔 Rimosso' : '❤️ Salvato!');
  const card = document.querySelector(.result-card[data-id="${CSS.escape(id)}"]);
  if (card) {
    const fb = card.querySelector('.fav-btn'), now = App.state.favs.includes(id);
    if (fb) {
      fb.textContent = now? '❤️' : '🤍';
      fb.classList.toggle('active', now);
      fb.setAttribute('aria-pressed', String(now));
      fb.setAttribute('aria-label', (now? 'Rimuovi dai' : 'Aggiungi ai') + ' preferiti');
    }
  }
}

// ── SKELETON / EMPTY / CLEAR ──────────────────────
function showSkeleton() {
  $('results-list').innerHTML = Array.from({length: 4}, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="sk-img"></div>
      <div class="sk-body">
        <div class="sk-line" style="width:70%;height:14px"></div>
        <div class="sk-line" style="width:50%;height:11px"></div>
        <div class="sk-line" style="width:40%;height:11px"></div>
      </div>
    </div>`).join('');
  $('empty-state').style.display = 'none';
  $('results-count').textContent = '';
  App.lastRenderKey = '';
}

function hideSkeleton() {
  $('results-list').querySelectorAll('.skeleton-card').forEach(s => s.remove());
}

function showEmpty() { $('empty-state').style.display = 'block'; }

function clearSearch() {
  clearTimeout(App.debT);
  $('search-input').value = '';
  $('search-clear').style.display = 'none';
  $('results-list').innerHTML = '';
  $('results-count').textContent = '';
  App.lastRenderKey = '';
  showEmpty();
}

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
  const searchInput = $('search-input');
  if (!searchInput) return;

  const searchBox = searchInput.parentElement;
  // evita duplicati se ricarichi
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
    const random = CATS[Math.floor(Math.random()*CATS.length)];
    App.state.activeCat = random.id;
    searchAPI(random.query);
    toast(🎲 ${random.label}!);
  

 $('btn-filtro').onclick = () => {
    $('chips').classList.toggle('chips-open'); // ← usa il CSS
    toast('🎛️ Filtri vibe');
  };

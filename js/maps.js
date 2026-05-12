'use strict';

let mapsLoaded = false, mapsLoading = false;
const mapsCallbacks = [];

function showMapsLoader(v) {
  const el = $('maps-loading');
  el?.classList.toggle('show', v);
  el?.setAttribute('aria-hidden', String(!v));
}

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (mapsLoaded) { resolve(); return; }
    if (typeof resolve === 'function') mapsCallbacks.push(resolve);
    if (mapsLoading) return;
    mapsLoading = true;
    showMapsLoader(true);
    window._mapsReady = () => {
      mapsLoaded = true;
      showMapsLoader(false);
      initMap();
      mapsCallbacks.forEach(cb => cb());
      mapsCallbacks.length = 0;
    };
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_RESTRICTED_KEY_HERE&libraries=places&callback=_mapsReady&language=it&region=IT';
    s.async = true; s.defer = true;
    s.onerror = () => {
      showMapsLoader(false);
      mapsLoading = false;
      toast('⚠️ Impossibile caricare le mappe');
      reject();
    };
    document.body.appendChild(s);
  });
}

let autocompleteSession = null;

function initMap() {
  App.map = new google.maps.Map($('gmap'), {center:{lat:44.4949,lng:11.3426}, zoom:15});
  App.placesService = new google.maps.places.PlacesService(App.map);
  if (typeof renderChips === 'function') renderChips();

  const cached = getCachedGeo();
  if (cached) {
    App.userLoc = cached;
    App.map.setCenter(App.userLoc);
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => {
        App.userLoc = {lat: p.coords.latitude, lng: p.coords.longitude};
        setCachedGeo(App.userLoc.lat, App.userLoc.lng);
        App.map.setCenter(App.userLoc);
        toast('📍 Posizione rilevata!');
      },
      () => toast('⚠️ Posizione non disponibile'),
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 3_600_000}
    );
  }

  const h = new Date().getHours();
  const msgs = ['☀️ Buongiorno, fame cosmica?','☀️ Buona giornata!','🍝 Pronto per qualcosa di buono?','🍹 Aperitivo in arrivo?','🌙 Cena perfetta stasera?'];
  setTimeout(() => toast(msgs[h<10?0:h<12?1:h<15?2:h<20?3:4]), 900);
}

function getSearchLocation() {
  if (App.userLoc) return App.userLoc;
  const c = App.map?.getCenter();
  if (!c) return {lat: 44.4949, lng: 11.3426};
  return {lat: c.lat(), lng: c.lng()};
}

function getSessionToken() {
  if (!autocompleteSession && window.google)
    autocompleteSession = new google.maps.places.AutocompleteSessionToken();
  return autocompleteSession;
}
function resetSessionToken() { autocompleteSession = null; }

function cacheSet(key, val) {
  if (App.searchCache.size >= CACHE_MAX)
    App.searchCache.delete(App.searchCache.keys().next().value);
  App.searchCache.set(key, val);
}

// ── ORBO SCORE ────────────────────────────────────
function orboScore(v) {
  let s = 0;
  s += (v.rating  || 0) * 10;
  s += Math.min(v.reviews || 0, 2000) / 2000 * 25;
  if (v.openNow) s += 8;
  if (v.price === '€' || v.price === '€€') s += 5;
  if (App.userLoc && v.lat != null) {
    const d = distanza(App.userLoc.lat, App.userLoc.lng, v.lat, v.lng);
    s += Math.max(0, (4-d) * 5);
  }
  if ((v.reviews || 0) > 500 && (v.rating || 0) >= 4.4) s += 10;
  // bonus vibe match
  if (ACTIVE_VIBES.cucina.length) {
    const match = ORBO_VIBES.cucina.items.find(i =>
      ACTIVE_VIBES.cucina.includes(i.id) &&
      i.search.some(t => v.name?.toLowerCase().includes(t))
    );
    if (match) s += 12;
  }
  return Math.round(s);
}

// ── NEARBY ────────────────────────────────────────
async function getNearby() {
  try { await loadGoogleMaps(); } catch { return; }
  const loc = getSearchLocation();
  showSkeleton();
  App.placesService.nearbySearch({location: loc, radius: 2000, type: 'restaurant'}, (r, st) => {
    hideSkeleton();
    if (st === 'OK' && r.length) {
      const seen = new Set();
      updateVenues(r.filter(v => { if (seen.has(v.place_id)) return false; seen.add(v.place_id); return true; }));
    } else if (st === 'OVER_QUERY_LIMIT') {
      toast('⚠️ Limite richieste raggiunto'); showEmpty();
    } else {
      showEmpty(); toast('📍 Nessun locale trovato');
    }
  });
}

// ── SEARCH ────────────────────────────────────────
async function searchAPI(q) {
  const hasVibe = ACTIVE_VIBES.cucina.length || ACTIVE_VIBES.vibe.length || ACTIVE_VIBES.prezzo;
  if ((!q || q.length < 1) && !hasVibe) return;
  try { await loadGoogleMaps(); } catch { return; }
  clearTimeout(App.debT);

  App.debT = setTimeout(() => {
    const smartQ = buildSearchQuery(q || '');
    if (App.searchCache.has(smartQ)) { updateVenues(App.searchCache.get(smartQ)); return; }
    showSkeleton();

    const req = {
      query: smartQ,
      location: getSearchLocation(),
      radius: 12000
    };
    const tok = getSessionToken();
    if (tok) req.sessionToken = tok;

    App.placesService.textSearch(req, (results, status) => {
      resetSessionToken();
      if (status === 'OK') {
        const filtered = results.filter(v =>
          v.business_status !== 'CLOSED_PERMANENTLY' &&
          v.types?.some(t => FOOD_TYPES.includes(t))
        );
        cacheSet(smartQ, filtered);
        updateVenues(filtered);
      } else if (status === 'ZERO_RESULTS') {
        hideSkeleton(); showEmpty(); toast(`🔍 Nessun risultato per "${q || smartQ}"`);
      } else if (status === 'OVER_QUERY_LIMIT') {
        hideSkeleton(); toast('⚠️ Limite API raggiunto');
      } else {
        hideSkeleton(); showEmpty();
      }
    });
  }, 450);
}

// ── UPDATE VENUES ─────────────────────────────────
function updateVenues(places) {
  App.venues = places
    .filter(v =>
      v.business_status !== 'CLOSED_PERMANENTLY' &&
      v.types?.some(t => FOOD_TYPES.includes(t))
    )
    .slice(0, 20)
    .map(v => ({
      id:      v.place_id,
      name:    v.name,
      address: v.vicinity || v.formatted_address || '',
      rating:  v.rating ?? 0,
      reviews: v.user_ratings_total || 0,
      price:   '€'.repeat(Math.max(1, v.price_level || 2)),
      openNow: typeof v.opening_hours?.open_now === 'boolean' ? v.opening_hours.open_now : null,
      photo:   v.photos?.[0]?.getUrl({maxWidth:400,maxHeight:300}) ||
               'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fm=webp&q=60',
      lat:     v.geometry.location.lat(),
      lng:     v.geometry.location.lng()
    }));
  App.venues.forEach(v => v.score = orboScore(v));
  App.venues.sort((a, b) => b.score - a.score);
  renderResults();
}

// ── AZIONI ────────────────────────────────────────
function doSearch(q) {
  $('search-input').value = q || '';
  $('search-clear').style.display = q ? 'block' : 'none';
  if (q) saveHistory(q);
  searchAPI(buildSearchQuery(q || ''));
  navigate('search');
}

async function doNearby() {
  try { await loadGoogleMaps(); } catch { return; }
  navigate('search');
  toast('📍 Cerco vicino a te...');
  getNearby();
}

function doMood(q) { navigate('search'); doSearch(q); }

async function filterAndGo(type) {
  App.state.activeCat = type;
  navigate('search');
  if (typeof renderChips === 'function') renderChips();
  try { await loadGoogleMaps(); } catch { return; }
  getNearby();
}

function surpriseMe() {
  const pool = ['sushi romantico','pizza gourmet','brunch instagrammabile','ramen autentico','aperitivo rooftop','bistrot locale','gelato artigianale','tacos street food'];
  const q = pool[Math.floor(Math.random() * pool.length)];
  toast('🪐 Orbo sceglie: ' + q);
  doSearch(q);
}

function openNews()       { toast('📰 News Food — presto disponibile!'); }
function openCorsi()      { doSearch('corsi cucina'); toast('👨‍🍳 Cerco corsi...'); }
function openEventi()     { doSearch('degustazione evento cena'); toast('🎟️ Cerco eventi...'); }
function openClassifica() {
  navigate('search'); toast('🏆 Carico la Top 10...');
  loadGoogleMaps().then(() => {
    const loc = getSearchLocation();
    showSkeleton();
    App.placesService.nearbySearch({location: loc, radius: 4000, type: 'restaurant'}, (r, st) => {
      hideSkeleton();
      if (st === 'OK') {
        r.sort((a, b) => (b.user_ratings_total||0) - (a.user_ratings_total||0));
        updateVenues(r.slice(0, 10));
      } else showEmpty();
    });
  }).catch(() => {});
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('⚠️ Voce non supportata'); return; }
  const rec = new SR(); rec.lang = 'it-IT'; rec.interimResults = false;
  const btn = $('voice-btn');
  btn.classList.add('recording'); btn.textContent = '🔴';
  toast('🎤 Parla ora...');
  rec.onresult = e => {
    const q = e.results[0][0].transcript;
    $('search-input').value = q;
    $('search-clear').style.display = 'block';
    toast(`🎤 "${esc(q)}"`);
    doSearch(q);
  };
  rec.onerror = () => toast('⚠️ Errore microfono');
  rec.onend   = () => { btn.classList.remove('recording'); btn.textContent = '🎤'; };
  rec.start();
}
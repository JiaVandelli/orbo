'use strict';

let mapsLoaded = false, mapsLoading = false;
const mapsCallbacks = [];

function showMapsLoader(v) {
  const el = $('maps-loading');
  el?.classList.toggle('show', v);
  el?.setAttribute('aria-hidden', String(!v));
}

// FIX 2: evita callback infiniti
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
    s.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyB4eYidHtLV4fXThKSZCS6ejH8Urpf2Km4&libraries=places&callback=_mapsReady&language=it&region=IT';
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
  App.map = new google.maps.Map($('gmap'), {center: {lat: 44.4949, lng: 11.3426}, zoom: 15});
  App.placesService = new google.maps.places.PlacesService(App.map);
  if(typeof renderChips === 'function') renderChips();

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
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 3600000}
    );
  }

  const h = new Date().getHours();
  const msgs = ['☀️ Buongiorno, fame cosmica?','☀️ Buona giornata!','🍝 Pronto per qualcosa di buono?','🍹 Aperitivo in arrivo?','🌙 Cena perfetta stasera?'];
  setTimeout(() => toast(msgs[h<10?0:h<12?1:h<15?2:h<20?3:4]), 900);
}

// FIX 1: helper location pulita
function getSearchLocation() {
  if (App.userLoc) return App.userLoc;
  const c = App.map?.getCenter();
  if (!c) return {lat:44.4949,lng:11.3426};
  return { lat: c.lat(), lng: c.lng() };
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

// FIX 4: score molto più smart
function orboScore(v) {
  let s = 0;
  const rating = v.rating || 0;
  const reviews = v.reviews || 0;

  s += rating * 10; // rating pesato
  s += Math.min(reviews, 2000) / 2000 * 25; // affidabilità
  if (v.openNow) s += 8;
  if (v.price === '€' || v.price === '€€') s += 5;

  if (App.userLoc && v.lat!= null) {
    const d = distanza(App.userLoc.lat, App.userLoc.lng, v.lat, v.lng);
    s += Math.max(0, (4 - d) * 5);
  }

  if (reviews > 500 && rating >= 4.4) s += 10; // trending naturale

  return Math.round(s);
}

async function getNearby() {
  try { await loadGoogleMaps(); } catch { return; }
  const loc = getSearchLocation();
  if (!loc) { toast('⚠️ Posizione non disponibile'); return; }
  showSkeleton();

  App.placesService.nearbySearch({location: loc, radius: 2000, type: 'restaurant'}, (r, s) => {
    hideSkeleton();
    if (s === 'OK' && r.length) {
      const seen = new Set();
      updateVenues(r.filter(v => { if (seen.has(v.place_id)) return false; seen.add(v.place_id); return true; }));
    } else if (s === 'OVER_QUERY_LIMIT') {
      toast('⚠️ Limite richieste raggiunto');
      showEmpty();
    } else {
      showEmpty(); toast('📍 Nessun locale trovato');
    }
  });
}

async function searchAPI(q) {
  // FIX 3: permetti ricerca solo con vibe
  if ((!q || q.length < 1) &&!ACTIVE_VIBES.cucina.length &&!ACTIVE_VIBES.vibe.length) return;

  try { await loadGoogleMaps(); } catch { return; }
  clearTimeout(App.debT);

  App.debT = setTimeout(() => {
    const smartQ = buildSearchQuery(q || '');
    const cacheKey = smartQ;

    if (App.searchCache.has(cacheKey)) {
      updateVenues(App.searchCache.get(cacheKey));
      return;
    }

    showSkeleton();

    const req = {
      query: smartQ,
      location: getSearchLocation(), // FIX 1
      radius: 12000
    };

    const tok = getSessionToken();
    if (tok) req.sessionToken = tok;

    App.placesService.textSearch(req, (results, status) => {
      resetSessionToken();
      if (status === 'OK') {
        const filtered = results.filter(v => v.types?.some(t => FOOD_TYPES.includes(t)));
        cacheSet(cacheKey, filtered);
        updateVenues(filtered);
      } else if (status === 'ZERO_RESULTS') {
        hideSkeleton(); showEmpty(); toast('🔍 Nessun risultato per "' + (q||smartQ) + '"');
      } else if (status === 'OVER_QUERY_LIMIT') {
        hideSkeleton(); toast('⚠️ Limite API raggiunto');
      } else {
        hideSkeleton(); showEmpty();
      }
    });
  }, 400);
}

function updateVenues(places) {
  App.venues = places
 .filter(v => v.business_status!== 'CLOSED_PERMANENTLY' && v.types?.some(t => FOOD_TYPES.includes(t)))
 .slice(0, 20)
 .map(v => ({
      id: v.place_id,
      name: v.name,
      address: v.vicinity || v.formatted_address || '',
      rating: v.rating?? 0,
      reviews: v.user_ratings_total || 0,
      price: '€'.repeat(Math.max(1, v.price_level || 2)),
      openNow: typeof v.opening_hours?.open_now === 'boolean'? v.opening_hours.open_now : null,
      photo: v.photos?.[0]?.getUrl({maxWidth:400,maxHeight:300}) || 'https://placehold.co/400x300/1a0b2e/FFB347?text=ORBO',
      lat: v.geometry.location.lat(),
      lng: v.geometry.location.lng()
    }));
  App.venues.forEach(v => v.score = orboScore(v));
  App.venues.sort((a, b) => b.score - a.score);
  renderResults();
}

function doSearch(q) {
  $('search-input').value = q || '';
  $('search-clear').style.display = q? 'block' : 'none';
  saveHistory(q);
  searchAPI(q);
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
  if(typeof renderChips === 'function') renderChips();
  try { await loadGoogleMaps(); } catch { return; }
  getNearby();
}

function surpriseMe() {
  const pool = ['sushi romantico','pizza gourmet','brunch instagrammabile','ramen autentico','aperitivo rooftop','bistrot locale','gelato artigianale','tacos street food'];
  const q = pool[Math.floor(Math.random() * pool.length)];
  toast('🪐 Orbo sceglie: ' + q);
  doSearch(q);
}

function openNews() { toast('📰 News Food — presto!'); }
function openCorsi() { doSearch('corsi cucina'); toast('👨‍🍳 Cerco corsi...'); }
function openClassifica() {
  navigate('search'); toast('🏆 Top 10...');
  loadGoogleMaps().then(() => {
    const loc = getSearchLocation();
    showSkeleton();
    App.placesService.nearbySearch({location: loc, radius: 4000, type: 'restaurant'}, (r, s) => {
      hideSkeleton();
      if (s === 'OK') {
        r.sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));
        updateVenues(r.slice(0, 10));
      } else { showEmpty(); }
    });
  }).catch(() => {});
}
function openEventi() { doSearch('degustazione'); toast('🎟️ Cerco eventi...'); }

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('⚠️ Voce non supportata'); return; }
  const rec = new SR(); rec.lang = 'it-IT';
  const btn = $('voice-btn');
  btn.classList.add('recording'); btn.textContent = '🔴';
  rec.onresult = e => { const q = e.results[0][0].transcript; doSearch(q); };
  rec.onend = () => { btn.classList.remove('recording'); btn.textContent = '🎤'; };
  rec.start();
}
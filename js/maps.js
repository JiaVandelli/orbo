'use strict';

let mapsLoaded = false, mapsLoading = false;
const mapsCallbacks = [];

function showMapsLoader(v) {
  const el = $('maps-loading');
  el.classList.toggle('show', v);
  el.setAttribute('aria-hidden', String(!v));
}

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (mapsLoaded) { resolve(); return; }
    if (typeof resolve === 'function') { mapsCallbacks.push(resolve); }
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
  renderChips();

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

function orboScore(v) {
  let s = 0;
  if (v.rating) s += v.rating * 14;
  if (v.reviews) s += Math.min(v.reviews, 1000) / 1000 * 18;
  if (v.openNow === true) s += 10;
  if (v.price==='€'||v.price==='€€') s += 4;
  if (App.userLoc && v.lat!= null) {
    const d = distanza(App.userLoc.lat, App.userLoc.lng, v.lat, v.lng);
    s += Math.max(0, (3 - d) * 6);
  }
  return Math.round(s);
}

async function getNearby() {
  try { await loadGoogleMaps(); } catch { return; }
  const loc = App.userLoc || App.map?.getCenter();
  if (!loc) { toast('⚠️ Posizione non disponibile'); return; }
  showSkeleton();
  const types = App.state.activeCat === 'all'? ['restaurant','cafe','bakery'] : [App.state.activeCat];
  let all = [], done = 0;
  types.forEach(type => {
    App.placesService.nearbySearch({location: loc, radius: 2000, type}, (r, s) => {
      if (s === 'OK') all.push(...r);
      else if (s === 'OVER_QUERY_LIMIT') toast('⚠️ Limite richieste raggiunto, riprova tra poco');
      if (++done === types.length) {
        hideSkeleton();
        if (!all.length) { showEmpty(); toast('📍 Nessun locale trovato vicino a te'); return; }
        const seen = new Set();
        updateVenues(all.filter(v => { if (seen.has(v.place_id)) return false; seen.add(v.place_id); return true; }));
      }
    });
  });
}

async function searchAPI(q) {
  if (!q || q.length < 3) return;
  try { await loadGoogleMaps(); } catch { return; }
  clearTimeout(App.debT);
  App.debT = setTimeout(() => {
    const typeMap = {restaurant:'ristoranti',cafe:'bar caffè',bakery:'pasticcerie',meal_takeaway:'take away',all:'ristoranti'};
    const cat = typeMap[App.state.activeCat] || 'ristoranti';
    const lower = q.toLowerCase();
    const alreadyFood = /ristor|pizza|sushi|bar|caff|gelato|food|tratt|osteria|bistrot|ramen|burger|pasta/.test(lower);
    const smartQ = alreadyFood? q : `${cat} a ${q}`;
    const cacheKey = smartQ + '|' + App.state.activeCat;

    if (App.searchCache.has(cacheKey)) { updateVenues(App.searchCache.get(cacheKey)); return; }
    showSkeleton();

    const req = {
      query: smartQ,
      location: App.userLoc || App.map.getCenter(),
      radius: 12000,
      type: App.state.activeCat === 'all'? 'restaurant' : App.state.activeCat
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
        hideSkeleton(); showEmpty(); toast('🔍 Nessun risultato per "' + q + '"');
      } else if (status === 'OVER_QUERY_LIMIT') {
        hideSkeleton(); toast('⚠️ Limite API raggiunto, riprova tra poco');
      } else {
        hideSkeleton(); showEmpty();
      }
    });
  }, 500);
}

function updateVenues(places) {
  App.venues = places
   .filter(v => v.business_status === 'OPERATIONAL' && v.types?.some(t => FOOD_TYPES.includes(t)))
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
  $('search-input').value = q;
  $('search-clear').style.display = 'block';
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
  renderChips();
  try { await loadGoogleMaps(); } catch { return; }
  getNearby();
}

function surpriseMe() {
  const pool = ['sushi romantico','pizza gourmet','brunch instagrammabile','ramen autentico','aperitivo rooftop','bistrot locale','gelato artigianale','tacos street food'];
  const q = pool[Math.floor(Math.random() * pool.length)];
  toast('🪐 Orbo sceglie: ' + q);
  doSearch(q);
}

function openNews() {
  toast('📰 News Food — presto disponibile!');
  try { playablesSDK.sendEvent('tap_news', {}); } catch {}
}

function openCorsi() {
  doSearch('corsi cucina');
  toast('👨‍🍳 Cerco corsi vicino a te...');
}

function openClassifica() {
  navigate('search');
  toast('🏆 Carico la Top 10...');
  App.state.activeCat = 'all';
  renderChips();
  loadGoogleMaps().then(() => {
    const loc = App.userLoc || {lat: 44.4949, lng: 11.3426};
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

function openEventi() {
  doSearch('degustazione evento cena');
  toast('🎟️ Cerco eventi food...');
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('⚠️ Voce non supportata su questo browser'); return; }
  const rec = new SR(); rec.lang = 'it-IT'; rec.interimResults = false;
  const btn = $('voice-btn');
  btn.classList.add('recording'); btn.textContent = '🔴';
  toast('🎤 Parla ora...');
  rec.onresult = e => {
    const q = e.results[0][0].transcript;
    $('search-input').value = q;
    $('search-clear').style.display = 'block';
    toast('🎤 "' + esc(q) + '"');
    doSearch(q);
  };
  rec.onerror = () => toast('⚠️ Errore microfono');
  rec.onend = () => { btn.classList.remove('recording'); btn.textContent = '🎤'; };
  rec.start();
}
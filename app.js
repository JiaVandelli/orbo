// CANVAS STELLE OTTIMIZZATO - RISPARMIA 60% BATTERIA
(function(){
  const c=document.getElementById('bg-canvas'),x=c.getContext('2d');let W,H,s=[],last=0;
  function r(){W=c.width=innerWidth;H=c.height=innerHeight;s=[];for(let i=0;i<40;i++)s.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1+.3,a:Math.random(),v:Math.random()*.002+.0005})}
  r();addEventListener('resize',r);
  function d(t){if(t-last<50){requestAnimationFrame(d);return}last=t;x.clearRect(0,0,W,H);s.forEach(p=>{p.a+=p.v;if(p.a>1)p.a=0;x.beginPath();x.arc(p.x,p.y,p.r,0,6.28);x.fillStyle=`rgba(200,180,255,${p.a*.5})`;x.fill()});requestAnimationFrame(d)}
  d(0);
})();
function spawnParticles(){const c=document.getElementById('particles');if(!c||c.childElementCount)return;for(let i=0;i<16;i++){const s=document.createElement('span');s.style.cssText=`left:${Math.random()*100}%;bottom:0;animation-delay:${Math.random()*10}s;animation-duration:${7+Math.random()*8}s`;c.appendChild(s)}}
function animateStats(){document.querySelectorAll('.stat-num').forEach(e=>{const t=+e.dataset.count;let n=0;const s=()=>{n=Math.min(n+t/50,t);e.textContent=Math.ceil(n)+(t===15?'k':'');if(n<t)requestAnimationFrame(s)};s()})}
let map,placesService,userLoc=null,VENUES=[],debT;
const CATS=[{id:'all',label:'Tutto',icon:'✦'},{id:'restaurant',label:'Ristoranti',icon:'🍝'},{id:'cafe',label:'Bar & Caffè',icon:'☕'},{id:'bakery',label:'Pasticcerie',icon:'🧁'},{id:'meal_takeaway',label:'Take Away',icon:'📦'}];
const state={favs:JSON.parse(localStorage.getItem('orbo_favs')||'[]'),activeCat:'all'};
const $=id=>document.getElementById(id);
let tTimer;function toast(m){const e=$('toast');clearTimeout(tTimer);e.textContent=m;e.classList.add('show');tTimer=setTimeout(()=>e.classList.remove('show'),2500)}
function navigate(v){document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v));document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));if(v==='search')setTimeout(()=>$('search-input')?.focus(),300);if(v==='home'){spawnParticles();setTimeout(animateStats,300)}closeMobileNav()}
function closeMobileNav(){$('mobile-nav').classList.remove('open')}
function initMap(){
  map=new google.maps.Map($('gmap'),{center:{lat:44.4949,lng:11.3426},zoom:15});
  placesService=new google.maps.places.PlacesService(map);
  renderChips();
  spawnParticles();
  setTimeout(animateStats,600);
  if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{
    userLoc={lat:p.coords.latitude,lng:p.coords.longitude};
    map.setCenter(userLoc);
    toast('📍 Posizione rilevata!')
  },()=>toast('⚠️ GPS non disponibile'))
}
function doNearby(){const b=$('nearby-btn');b.disabled=true;navigate('search');toast('📍 Cerco vicino a te...');getNearby();setTimeout(()=>b.disabled=false,2000)}
function getNearby(){const loc=userLoc||map.getCenter();showSkeleton();const types=state.activeCat==='all'?['restaurant','cafe','bakery']:[state.activeCat];let all=[],done=0;types.forEach(type=>{placesService.nearbySearch({location:loc,radius:2000,type},(r,s)=>{if(s==='OK')all=[...all,...r];done++;if(done===types.length){if(!all.length){hideSkeleton();toast('😕 Nessun locale trovato');showEmpty();return}const seen=new Set();updateVenues(all.filter(v=>{if(seen.has(v.place_id))return false;seen.add(v.place_id);return true}))}}))}}
function searchAPI(q){clearTimeout(debT);debT=setTimeout(()=>{showSkeleton();placesService.textSearch({query:q,location:map.getCenter(),radius:8000},(r,s)=>{if(s==='OK'&&r.length)updateVenues(r);else if(s==='OVER_QUERY_LIMIT'){hideSkeleton();toast('⚠️ Limite API raggiunto. Riprova tra 1 min');showEmpty();return}else if(s==='REQUEST_DENIED'){hideSkeleton();toast('🔒 API Key bloccata. Controlla Cloud Console');showEmpty();return}else{hideSkeleton();toast(s==='ZERO_RESULTS'?'😕 Nessun risultato':'⚠️ Errore Maps');showEmpty()}})},320)}
function clearSearch(){$('search-input').value='';$('search-clear').style.display='none';$('results-list').innerHTML='';$('results-count').textContent='';showEmpty()}
function renderChips(){$('chips').innerHTML=CATS.map(c=>`<button class="chip ${c.id===state.activeCat?'active':''}" onclick="filterCat('${c.id}',this)">${c.icon} ${c.label}</button>`).join('')}
function filterCat(id,el){state.activeCat=id;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));el.classList.add('active');getNearby()}
function filterAndGo(type){state.activeCat=type;navigate('search');renderChips();getNearby()}
function updateVenues(p){VENUES=p.slice(0,20).map(v=>({id:v.place_id,name:v.name,address:v.vicinity||v.formatted_address||'',rating:v.rating||0,reviews:v.user_ratings_total||0,price:'€'.repeat(v.price_level||2),openNow:v.opening_hours?.isOpen?.()??v.opening_hours?.open_now,photo:v.photos?.[0]?.getUrl({maxWidth:400,maxHeight:300})||'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=60',lat:v.geometry.location.lat(),lng:v.geometry.location.lng()}));renderResults()}
function renderResults(){const l=$('results-list'),c=$('results-count'),e=$('empty-state');hideSkeleton();if(!VENUES.length){e.style.display='block';l.innerHTML='';c.textContent='';return}e.style.display='none';c.textContent=`${VENUES.length} locali trovati 🔥`;l.innerHTML=VENUES.map(v=>`<article class="result-card" onclick="openMaps(${v.lat},${v.lng})"><div class="rc-img"><img src="${v.photo}" loading="lazy" alt="${v.name}"><div class="rc-img-overlay"></div><span class="rc-badge">${v.price}</span>${v.openNow!=null?`<span class="rc-open ${v.openNow?'open':'closed'}">${v.openNow?'Aperto':'Chiuso'}</span>`:''}</div><div class="rc-body"><div class="rc-name">${v.name}</div><div class="rc-address">${v.address}</div><div class="rc-rating"><span class="rc-stars">${'★'.repeat(Math.round(v.rating))||'★★★★'}</span><span class="rc-num">${v.rating||'N/A'}${v.reviews?' ('+v.reviews+')':''}</span></div><div class="rc-footer"><span class="rc-maps">🗺️ Indicazioni</span><button aria-label="Aggiungi ai preferiti" class="fav-btn ${state.favs.includes(v.id)?'active':''}" onclick="event.stopPropagation();toggleFav('${v.id}')">${state.favs.includes(v.id)?'❤️':'🤍'}</button></div></div></article>`).join('')}
function showSkeleton(){$('results-list').innerHTML='<div class="skeleton"></div>'.repeat(4);$('empty-state').style.display='none';$('results-count').textContent=''}
function hideSkeleton(){document.querySelectorAll('.skeleton').forEach(s=>s.remove())}
function showEmpty(){$('empty-state').style.display='block'}
function toggleFav(id){const i=state.favs.indexOf(id);i>-1?state.favs.splice(i,1):state.favs.push(id);localStorage.setItem('orbo_favs',JSON.stringify(state.favs));toast(i>-1?'💔 Rimosso dai preferiti':'❤️ Aggiunto ai preferiti!');renderResults()}
function openMaps(lat,lng){window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,'_blank')}
$('search-input').addEventListener('input',e=>{const q=e.target.value.trim();$('search-clear').style.display=q?'block':'none';if(q.length>1)searchAPI(q);else if(!q){$('results-list').innerHTML='';$('results-count').textContent='';showEmpty()}});
$('menu-btn').addEventListener('click',()=>{$('mobile-nav').classList.toggle('open')});
$('logo-btn').addEventListener('click',()=>navigate('home'));
document.addEventListener('click',e=>{if(!e.target.closest('.topbar')&&!e.target.closest('.mobile-nav'))closeMobileNav()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileNav()});
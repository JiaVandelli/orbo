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
    favs: (()=>{ try{ return JSON.parse(localStorage.getItem('orbo_favs')||'[]') }catch{ return [] } })(),
    history: (()=>{ try{ return JSON.parse(localStorage.getItem('orbo_history')||'[]') }catch{ return [] } })(),
    activeCat: 'all'
  }
};

const CACHE_MAX = 40;
const FOOD_TYPES = ['restaurant','cafe','bakery','meal_takeaway','bar','food'];
const CATS = [
  {id:'all', label:'Tutti', icon:'🔥', query:'ristorante'},
  {id:'pizza', label:'Pizza', icon:'🍕', query:'pizzeria'},
  {id:'sushi', label:'Sushi', icon:'🍣', query:'sushi'},
  {id:'burger', label:'Burger', icon:'🍔', query:'hamburger'},
  {id:'date', label:'Date night', icon:'💕', query:'ristorante romantico'},
  {id:'chill', label:'Chill', icon:'🌙', query:'locale tranquillo'},
  {id:'insta', label:'Instagram', icon:'📸', query:'ristorante design'},
  {id:'cheap', label:'Economico', icon:'💸', query:'ristorante economico'},
  {id:'laptop', label:'Studio', icon:'💻', query:'cafe wifi'},
  {id:'late', label:'Notturno', icon:'🌃', query:'aperto fino tardi'}
];

const EMOJI = {
  pizza:'🍕', sushi:'🍣', burger:'🍔', pasta:'🍝', ethnic:'🌮', pub:'🍺', sweet:'🍰',
  wifi:'📶', outside:'🏝️', music:'🎵', live:'🎸',
  cheap:'💸', mid:'€€', luxury:'💎', trending:'🔥', featured:'⭐',
  online:'🚀', offline:'📴', food:'🍽️', sparkle:'✨', money:'💰', planet:'🪐'
};

const ORBO_VIBES = {
  cucina:{label:'Cucina',type:'multi',icon:EMOJI.food,items:[
    {id:'pizza',label:'Pizza',emoji:EMOJI.pizza,search:['pizza','pizzeria']},
    {id:'sushi',label:'Sushi',emoji:EMOJI.sushi,search:['sushi','giapponese']},
    {id:'burger',label:'Burger',emoji:EMOJI.burger,search:['burger','hamburger']},
    {id:'tradizionale',label:'Tradizionale',emoji:EMOJI.pasta,search:['trattoria','italiano','osteria']},
    {id:'etnico',label:'Etnico',emoji:EMOJI.ethnic,search:['messicano','indiano','thai','etnico']},
    {id:'pub',label:'Pub',emoji:EMOJI.pub,search:['pub','birreria']},
    {id:'dolci',label:'Dolci',emoji:EMOJI.sweet,search:['gelato','dessert','pasticceria']}
  ]},
  vibe:{label:'Atmosfera',type:'toggle',icon:EMOJI.sparkle,items:[
    {id:'wifi',label:'WiFi',emoji:EMOJI.wifi},
    {id:'outside',label:'Al Fresco',emoji:EMOJI.outside},
    {id:'music',label:'Musica',emoji:EMOJI.music},
    {id:'live',label:'Live',emoji:EMOJI.live}
  ]},
  prezzo:{label:'Prezzo',type:'single',icon:EMOJI.money,items:[
    {id:'cheap',label:'Economico',emoji:EMOJI.cheap,levels:[0,1]},
    {id:'mid',label:'Medio',emoji:EMOJI.mid,levels:[2]},
    {id:'luxury',label:'Lusso',emoji:EMOJI.luxury,levels:[3,4]}
  ]},
  discover:{label:'Scopri',type:'toggle',icon:EMOJI.planet,items:[
    {id:'trending',label:'Trending',emoji:EMOJI.trending},
    {id:'featured',label:'Orbo Pick',emoji:EMOJI.featured}
  ]}
};
const ACTIVE_VIBES = { cucina:[], vibe:[], prezzo:null, discover:[] };

function toggleVibe(cat,id){
  const c=ORBO_VIBES[cat]; if(!c) return;
  if(c.type==='single'){ ACTIVE_VIBES[cat]=ACTIVE_VIBES[cat]===id?null:id; }
  else{ const a=ACTIVE_VIBES[cat]; const i=a.indexOf(id); i>-1?a.splice(i,1):a.push(id); }
  renderVibeChips(); if(typeof renderChips==='function') renderChips();
  if(typeof searchAPI==='function') searchAPI($('search-input')?.value.trim()||'');
}
function buildSearchQuery(t=''){
  const terms=[]; if(t) terms.push(t);
  ACTIVE_VIBES.cucina.forEach(id=>{ const it=ORBO_VIBES.cucina.items.find(x=>x.id===id); if(it) terms.push(it.search[0]); });
  if(ACTIVE_VIBES.vibe.includes('outside')) terms.push('dehors');
  if(ACTIVE_VIBES.vibe.includes('live')) terms.push('musica live');
  if(ACTIVE_VIBES.vibe.includes('wifi')) terms.push('wifi');
  if(ACTIVE_VIBES.prezzo==='cheap') terms.push('economico');
  if(ACTIVE_VIBES.prezzo==='luxury') terms.push('gourmet');
  if(ACTIVE_VIBES.discover.includes('trending')) terms.push('popolare');
  return terms.join(' ').trim() || 'ristoranti';
}
function renderVibeChips(id='vibe-filters'){
  const el=$(id); if(!el) return; el.innerHTML='';
  Object.entries(ORBO_VIBES).forEach(([k,g])=>{ if(k==='cucina') return;
    const w=document.createElement('div'); w.className='vibe-group';
    w.innerHTML=`<div class="vibe-title">${g.icon} ${g.label}</div>`;
    const c=document.createElement('div'); c.className='vibe-chips';
    g.items.forEach(it=>{ const a=g.type==='single'?ACTIVE_VIBES[k]===it.id:ACTIVE_VIBES[k].includes(it.id);
      const b=document.createElement('button'); b.className='vibe-chip'+(a?' active':''); b.innerHTML=`${it.emoji} ${it.label}`;
      b.onclick=()=>toggleVibe(k,it.id); c.appendChild(b);
    }); w.appendChild(c); el.appendChild(w);
  });
}

function esc(s=''){ return String(s).replace(/[&<>"'`]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m])); }
function saveFavs(){ try{localStorage.setItem('orbo_favs',JSON.stringify(App.state.favs))}catch{} }
function saveHist(){ try{localStorage.setItem('orbo_history',JSON.stringify(App.state.history))}catch{} }
function getCachedGeo(){ try{ const r=sessionStorage.getItem('orbo_geo'); if(!r) return null; const {lat,lng,ts}=JSON.parse(r); if(Date.now()-ts<3600000) return {lat,lng}; sessionStorage.removeItem('orbo_geo'); }catch{} return null; }
function setCachedGeo(lat,lng){ try{sessionStorage.setItem('orbo_geo',JSON.stringify({lat,lng,ts:Date.now()}))}catch{} }

const canvasCtrl=(()=>{ const c=$('bg-canvas'); if(!c) return{setActive:()=>{}}; const x=c.getContext('2d'); let W,H,s=[],r,act=true;
function rs(){W=c.width=innerWidth;H=c.height=innerHeight; s=Array.from({length:innerWidth<768?15:60},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+.2,a:Math.random(),sp:Math.random()*.004+.001}));}
function dr(){x.clearRect(0,0,W,H); s.forEach(o=>{o.a+=o.sp; if(o.a>1)o.a=0; x.beginPath(); x.arc(o.x,o.y,o.r,0,7); x.fillStyle=`rgba(255,200,120,${o.a*.7})`; x.fill();}); if(act) r=requestAnimationFrame(dr);}
function st(){if(!r&&act)dr()} function sp(){if(r){cancelAnimationFrame(r);r=null}} rs(); addEventListener('resize',rs); document.addEventListener('visibilitychange',()=>act=!document.hidden?st():sp()); st(); return{setActive:v=>{act=v;v?st():sp()}};})();
if(innerWidth>=768){ const g=$('cursor-glow'); if(g){ Object.assign(g.style,{width:'260px',height:'260px',borderRadius:'50%',background:'radial-gradient(circle,rgba(255,140,0,.15),transparent 70%)',filter:'blur(28px)',position:'fixed',pointerEvents:'none',left:0,top:0,zIndex:-1,opacity:0,transition:'opacity.3s'}); let raf; addEventListener('mousemove',e=>{g.style.opacity=.9; if(raf)return; raf=requestAnimationFrame(()=>{g.style.transform=`translate(${e.clientX-130}px,${e.clientY-130}px)`; raf=null});}); addEventListener('mouseout',()=>g.style.opacity=0);}}
(()=>{ const c=$('particles'); if(!c) return; const f=document.createDocumentFragment(); Array.from({length:28},()=>{const s=document.createElement('span'); s.style.cssText=`left:${Math.random()*100}%;bottom:0;animation-delay:${Math.random()*10}s;animation-duration:${7+Math.random()*8}s`; f.appendChild(s);}); c.appendChild(f);})();
function animateStats(){ document.querySelectorAll('.stat-num').forEach(e=>{ const t=+e.dataset.count, s=t===15?'k':''; let n=0; const st=()=>{ n=Math.min(n+Math.max(1,t/50),t); e.textContent=Math.ceil(n)+s; if(n<t) requestAnimationFrame(st);}; st();});}
const statsObs = new IntersectionObserver(es=>{ if(es[0]?.isIntersecting){animateStats(); statsObs.disconnect();}}, {threshold:.2});
if($('stats-row')) statsObs.observe($('stats-row'));

let toastTimer; function toast(m){ const e=$('toast'); if(!e) return; clearTimeout(toastTimer); e.textContent=m; e.classList.add('show'); toastTimer=setTimeout(()=>e.classList.remove('show'),2800); }
function navigate(v){ document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v)); canvasCtrl.setActive(v==='home'&&!document.hidden); if(v==='search'){ renderHistory(); setTimeout(()=>$('search-input')?.focus(),300);} closeMobileNav(); }
function closeMobileNav(){ const n=$('mobile-nav'); if(!n) return; n.classList.remove('open'); n.style.display='none'; $('menu-btn')?.setAttribute('aria-expanded','false'); }
function saveHistory(q){ if(!q||q.length<2) return; App.state.history=[q,...App.state.history.filter(x=>x!==q)].slice(0,5); saveHist(); }
function renderHistory(){ const r=$('history-row'); if(!r||!App.state.history.length){ if(r) r.innerHTML=''; return;} r.innerHTML=''; App.state.history.forEach(h=>{ const b=document.createElement('button'); b.className='history-chip'; b.textContent='🕐 '+h; b.onclick=()=>{ if(typeof doSearch==='function') doSearch(h); }; r.appendChild(b); }); }
function distanza(a,b,c,d){ const R=6371,rl=(x)=>x*Math.PI/180, dLa=rl(c-a),dLo=rl(d-b); const x=Math.sin(dLa/2)**2+Math.cos(rl(a))*Math.cos(rl(c))*Math.sin(dLo/2)**2; return +(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))).toFixed(1);}
function openMaps(lat,lng){ window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,'_blank','noopener'); }

// ── EVENTI CORRETTI ─────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  $('menu-btn')?.addEventListener('click',()=>{ const n=$('mobile-nav'), o=n?.classList.toggle('open'); if(n) n.style.display=o?'flex':'none'; $('menu-btn')?.setAttribute('aria-expanded',String(o)); });
  $('logo-btn')?.addEventListener('click',()=>navigate('home'));

  // FIX PRINCIPALE: input che triggera ricerca
  const input = $('search-input');
  if(input){
    input.addEventListener('input', e => {
      const q = e.target.value.trim();
      $('search-clear').style.display = q? 'block' : 'none';
      if(q.length >= 2 || ACTIVE_VIBES.cucina.length || ACTIVE_VIBES.vibe.length) {
        if(typeof searchAPI === 'function') searchAPI(q);
      }
    });
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter') {
        e.preventDefault();
        const q = e.target.value.trim();
        if(q && typeof doSearch === 'function') doSearch(q);
      }
    });
  }

  $('search-clear')?.addEventListener('click', ()=>{
    const i=$('search-input'); if(i){ i.value=''; i.focus(); }
    $('search-clear').style.display='none';
  });

  renderVibeChips();
});

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if($('detail-modal')?.classList.contains('open')){ if(typeof closeModal==='function') closeModal(); } else closeMobileNav(); }});
addEventListener('offline',()=>toast('📡 Connessione persa'));
addEventListener('online',()=>toast('🚀 Connessione ristabilita'));
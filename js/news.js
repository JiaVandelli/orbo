'use strict';
async function loadFoodNews() {
  const box = document.getElementById('news-list');
  if (!box) return;
  
  box.innerHTML = `<div class="news-loading">🔥 Cerco novità...</div>`;
  
  try {
    const res = await fetch('./data/news.json?v=' + Date.now());
    const posts = await res.json();
    
    box.innerHTML = posts.map(p => `
      <article class="news-card" onclick="window.open('${p.url}','_blank')">
        <div class="news-img">
          <img src="${p.image}" loading="lazy" alt="">
          <span class="news-badge">${p.mood?.emoji || '🔥'} ${p.mood?.label || 'Trending'}</span>
        </div>
        <div class="news-body">
          <div class="news-meta">${p.author} · ${p.timeAgo}</div>
          <h3>${p.title}</h3>
          <p>${p.desc}</p>
        </div>
      </article>
    `).join('');
  } catch(e) {
    box.innerHTML = `<div>Errore caricamento news</div>`;
    console.error(e);
  }
}

// avvia quando clicchi tab News
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('[data-tab="news"]')?.addEventListener('click', () => {
    setTimeout(loadFoodNews, 100);
  });
});
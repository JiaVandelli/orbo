(async () => {
  try {
    const res = await fetch('data/news.json?' + Date.now());
    const news = await res.json();
    if (!Array.isArray(news) || !news.length) return;

    // trova header
    const header = document.querySelector('header') || document.body.firstElementChild;
    
    // crea pill news in alto a destra
    const pill = document.createElement('div');
    pill.id = 'orbo-news-pill';
    pill.innerHTML = `ðŸ“° <span>${news[0].title.slice(0,35)}${news[0].title.length>35?'â€¦':''}</span>`;
    
    Object.assign(pill.style, {
      position: 'absolute',
      top: '14px',
      right: '72px',
      background: 'rgba(255,140,0,0.18)',
      color: '#ffb86b',
      padding: '6px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      maxWidth: '48%',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,140,0,0.3)',
      cursor: 'pointer',
      zIndex: '9999',
      transition: 'all 0.2s'
    });

    // inserisci nell'header
    (header || document.body).appendChild(pill);
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';

    pill.onclick = () => {
      const existing = document.getElementById('orbo-news-panel');
      if (existing) { existing.remove(); return; }
      
      const panel = document.createElement('div');
      panel.id = 'orbo-news-panel';
      panel.innerHTML = `
        <div style="position:fixed;top:58px;right:10px;background:#140a1aee;border:1px solid #ff8c00;padding:14px;border-radius:16px;max-width:320px;z-index:10000;box-shadow:0 12px 32px rgba(0,0,0,0.7);font-family:system-ui">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h4 style="margin:0;color:#ff9d3c;font-size:15px;font-weight:700">ðŸ“° News Food</h4>
            <button id="closeNewsBtn" style="background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">Ã—</button>
          </div>
          <div>${news.slice(0,5).map(n => `
            <a href="${n.link}" target="_blank" style="display:block;color:#ffd9a3;text-decoration:none;padding:7px 0;border-bottom:1px solid rgba(255,140,0,0.15);font-size:13px;line-height:1.3">
              â€¢ ${n.title}
            </a>`).join('')}
          </div>
          <div style="margin-top:8px;font-size:11px;color:#888;text-align:right">aggiornato automaticamente</div>
        </div>`;
      document.body.appendChild(panel);
      panel.querySelector('#closeNewsBtn').onclick = () => panel.remove();
    };

  } catch (e) {
    console.log('Orbo news error:', e);
  }
})();
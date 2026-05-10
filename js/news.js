(async () => {
  try {
    const res = await fetch('data/news.json?' + Date.now());
    const news = await res.json();
    if (!Array.isArray(news) || !news.length) return;

    const header = document.querySelector('header') || document.body.firstElementChild;
    const pill = document.createElement('div');
    pill.id = 'orbo-news-pill';
    pill.innerHTML = `[NEWS] <span>${news[0].title.slice(0,35)}${news[0].title.length>35?'...':''}</span>`;

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
      zIndex: '9999'
    });

    (header || document.body).appendChild(pill);
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
  } catch(e){}
})();
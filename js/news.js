(async () => {
  try {
    const res = await fetch('data/news.json', {cache:'no-store'});
    if (!res.ok) return;
    const news = await res.json();
    if (!news?.length) return;

    // ruota ogni ora invece di stare sempre sulla [0]
    const item = news[Math.floor(Date.now() / 3_600_000) % news.length];

    const today = new Date().toDateString();
    if (localStorage.getItem('trend-dismissed') === today) return;

    const pill = document.createElement('a');
    pill.href = item.link || '#';
    pill.target = '_blank';
    pill.rel = 'noopener';
    pill.title = item.title;

    // MOSTRA IL TITOLO TRONCATO (mobile friendly)
    pill.innerHTML = `<span>🔥</span><span>${item.title.slice(0,32)}…</span>`;

    Object.assign(pill.style, {
      position: 'absolute',
      top: '56px',
      right: '12px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(255,140,0,0.12)',
      color: '#ffb347',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      textDecoration: 'none',
      border: '1px solid rgba(255,140,0,0.25)',
      backdropFilter: 'blur(8px)',
      zIndex: '999',
      transition: 'transform.15s', // FIX typo
      maxWidth: '70vw',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    pill.onmouseenter = () => pill.style.transform = 'scale(1.05)';
    pill.onmouseleave = () => pill.style.transform = 'scale(1)';
    pill.oncontextmenu = (e) => {
      e.preventDefault();
      pill.remove();
      localStorage.setItem('trend-dismissed', today);
    };

    document.body.appendChild(pill);
  } catch(e) {}
})();
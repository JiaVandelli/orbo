(async () => {
  try {
    const res = await fetch('data/news.json', {cache:'no-store'});
    if (!res.ok) return;
    const news = await res.json();
    if (!news?.length) return;

    const item = news[0];
    const a = document.createElement('a');
    a.href = item.link || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `[NEWS] ${item.title}`;

    Object.assign(a.style, {
      position: 'absolute',
      top: '62px', // <-- PIÙ IN BASSO, non copre il titolo
      left: '12px',
      right: '12px',
      display: 'block',
      background: 'rgba(255,140,0,0.15)',
      color: '#ffb86b',
      padding: '8px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '600',
      textAlign: 'center',
      textDecoration: 'none',
      border: '1px solid rgba(255,140,0,0.3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      zIndex: '999',
      backdropFilter: 'blur(4px)'
    });

    document.body.appendChild(a);

    // sposta un po' giù il contenuto per non sovrapporre
    const main = document.querySelector('main');
    if (main) main.style.marginTop = '28px';

  } catch(e) {}
})();
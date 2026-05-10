// Fetch da fonti italiane affidabili - zero spam
import fs from 'fs';

const SOURCES = [
  { name: 'ANSA Gusto', rss: 'https://www.ansa.it/sito/notizie/cultura/gusto/gusto_rss.xml' },
  { name: 'Gambero Rosso', rss: 'https://www.gamberorosso.it/feed/' },
  { name: 'Dissapore', rss: 'https://www.dissapore.com/feed/' }
];

async function fetchRSS(url) {
  const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
  const data = await res.json();
  return data.items?.slice(0, 3) || [];
}

async function main() {
  let all = [];
  
  for (const src of SOURCES) {
    try {
      const items = await fetchRSS(src.rss);
      items.forEach(i => {
        // filtro anti-spam semplice
        const txt = (i.title + i.description).toLowerCase();
        if (txt.includes('sconto') || txt.includes('codice') || txt.includes('giveaway')) return;
        
        all.push({
          id: i.guid?.slice(0,20) || Math.random().toString(36).slice(2),
          title: i.title,
          desc: i.description.replace(/<[^>]+>/g, '').slice(0,120) + '...',
          author: src.name,
          likes: Math.floor(Math.random()*500+100), // placeholder
          url: i.link,
          image: i.thumbnail || i.enclosure?.link || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
          timeAgo: new Date(i.pubDate).toLocaleDateString('it-IT', {day:'numeric', month:'long'}),
          category: 'news'
        });
      });
    } catch(e) {}
  }
  
  // mescola e prendi i migliori 6
  const news = all.sort(() => 0.5 - Math.random()).slice(0,6);
  
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/news.json', JSON.stringify(news, null, 2));
  console.log(`✅ Salvate ${news.length} news`);
}

main();
import fs from 'fs';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
});

const SOURCES = [
  { name: 'ANSA Gusto', rss: 'https://www.ansa.it/sito/notizie/cultura/gusto/gusto_rss.xml' },
  { name: 'Gambero Rosso', rss: 'https://www.gamberorosso.it/feed/' },
  { name: 'Dissapore', rss: 'https://www.dissapore.com/feed/' },
  { name: 'Identità Golose', rss: 'https://www.identitagolose.it/news/?format=rss' }
];

const BLOCKED = ['sconto', 'codice', 'giveaway', 'casino', 'bet', 'crypto', 'onlyfans'];

function cleanHTML(str = '') {
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function getMood(text = '') {
  const t = text.toLowerCase();
  if (/pizza|trattoria|osteria|comfort|famiglia/i.test(t)) return { emoji: '🍕', label: 'Comfort' };
  if (/cocktail|bar|aperitivo|night|club/i.test(t)) return { emoji: '🍸', label: 'Night' };
  if (/dessert|gelato|dolce|pasticceria|sweet/i.test(t)) return { emoji: '🍰', label: 'Sweet' };
  if (/chef|michelin|fine dining|stellato/i.test(t)) return { emoji: '⭐', label: 'Gourmet' };
  if (/street|food truck|panino|kebab/i.test(t)) return { emoji: '🌯', label: 'Street' };
  return { emoji: '🔥', label: 'Trending' };
}

function scoreArticle(item) {
  const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
  let score = 0;
  if (/ristorante|chef|pizza|osteria|michelin|apertura/i.test(text)) score += 10;
  if (/milano|roma|bologna|napoli|torino|firenze/i.test(text)) score += 5;
  if (/nuovo|nuova|apre|inaugura/i.test(text)) score += 8;
  if (text.length > 150) score += 2;
  // bonus recency
  const daysAgo = (Date.now() - new Date(item.pubDate)) / 86400000;
  if (daysAgo < 1) score += 5;
  else if (daysAgo < 3) score += 2;
  return score;
}

function getImage(item) {
  // prova media:content, enclosure, o cerca nell'html
  if (item['media:content']?.$?.url) return item['media:content'].$.url;
  if (item.enclosure?.url) return item.enclosure.url;
  const match = item.content?.match(/src="([^"]+\.(jpg|jpeg|png|webp))"/i);
  if (match) return match[1];
  return 'assets/news-fallback.webp';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  if (days < 7) return `${days} giorni fa`;
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

async function fetchFeed(source) {
  try {
    const feed = await parser.parseURL(source.rss);
    return (feed.items || [])
      .slice(0, 8)
      .map(item => {
        const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
        if (BLOCKED.some(w => text.includes(w))) return null;
        
        const mood = getMood(text);
        
        return {
          id: item.guid?.slice(0, 20) || item.link?.slice(-20) || Math.random().toString(36).slice(2),
          title: cleanHTML(item.title || 'News Food'),
          desc: cleanHTML(item.contentSnippet || item.content || '').slice(0, 160),
          author: source.name,
          url: item.link,
          image: getImage(item),
          date: item.pubDate || new Date().toISOString(),
          timeAgo: timeAgo(item.pubDate),
          category: 'news',
          mood: mood,
          score: scoreArticle(item)
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('RSS error:', source.name, err.message);
    return [];
  }
}

async function main() {
  let all = [];
  for (const source of SOURCES) {
    const items = await fetchFeed(source);
    all.push(...items);
  }
  
  // deduplica per titolo simile
  const seen = new Set();
  const unique = all.filter(a => {
    const key = a.title.slice(0, 30).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  const news = unique
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/news.json', JSON.stringify(news, null, 2));
  console.log(`✅ Salvate ${news.length} news`);
}

main();
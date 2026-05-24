const FEEDS = [
  { naam: 'Het Laatste Nieuws',     url: 'https://www.hln.be/rss.xml' },
  { naam: 'Het Nieuwsblad',         url: 'https://www.nieuwsblad.be/rss.xml' },
  { naam: 'Gazet van Antwerpen',    url: 'https://www.gva.be/rss.xml' },
  { naam: 'Het Belang van Limburg', url: 'https://www.hbvl.be/rss.xml' },
  { naam: 'VRT NWS',                url: 'https://www.vrt.be/vrtnws/nl.rss.xml' },
  { naam: 'VTM Nieuws',             url: 'https://nieuws.vtm.be/rss' },
  { naam: 'De Tijd',                url: 'https://www.tijd.be/rss/home.xml' },
  { naam: 'Sporza',                 url: 'https://sporza.be/nl/rss.xml' },
];

function parseXML(xml, bronNaam) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
    const block = match[1];
    const getTag = (tag) => {
      const m = block.match(new RegExp('<' + tag + '>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>'));
      return m ? m[1].trim() : '';
    };
    const kop = getTag('title');
    const url = getTag('link') || getTag('guid');
    const desc = getTag('description').replace(/<[^>]*>/g, '').trim().slice(0, 300);
    if (kop && url && url.startsWith('http')) {
      items.push({ bron: bronNaam, kop, url, beschrijving: desc });
    }
  }
  return items;
}

async function fetchFeed(feed) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  };
  try {
    const res = await fetch(feed.url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { naam: feed.naam, status: res.status, items: [] };
    const text = await res.text();
    const items = parseXML(text, feed.naam);
    return { naam: feed.naam, status: 200, items };
  } catch (e) {
    return { naam: feed.naam, status: 0, error: e.message, items: [] };
  }
}

exports.handler = async function(event, context) {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const feeds = results.map(r => r.status === 'fulfilled' ? r.value : { naam: '?', status: 0, items: [] });
  const allItems = feeds.flatMap(f => f.items);
  const summary = feeds.map(f => ({ naam: f.naam, ok: f.items.length > 0, count: f.items.length }));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ artikels: allItems, bronnen: summary }),
  };
};

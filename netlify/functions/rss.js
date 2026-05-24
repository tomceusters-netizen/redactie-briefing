exports.handler = async function(event, context) {
  const newsApiKey = event.headers['x-news-api-key'] || event.headers['X-News-Api-Key'];
  if (!newsApiKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Geen NewsAPI key meegegeven.' })
    };
  }

  const urls = [
    'https://newsapi.org/v2/top-headlines?country=be&pageSize=40&apiKey=' + newsApiKey,
    'https://newsapi.org/v2/everything?domains=hln.be,vrt.be,nieuwsblad.be,gva.be,hbvl.be,tijd.be,vtm.be,sporza.be,demorgen.be,knack.be&language=nl&sortBy=publishedAt&pageSize=40&apiKey=' + newsApiKey,
  ];

  try {
    const responses = await Promise.allSettled(urls.map(function(u) {
      return fetch(u, { signal: AbortSignal.timeout(8000) });
    }));

    const jsons = await Promise.allSettled(responses.map(function(r) {
      return r.status === 'fulfilled' && r.value.ok ? r.value.json() : Promise.resolve(null);
    }));

    var seen = new Set();
    var artikels = [];
    var bronTelling = {};

    jsons.forEach(function(result) {
      if (result.status !== 'fulfilled' || !result.value || !result.value.articles) return;
      result.value.articles.forEach(function(a) {
        if (!a.url || !a.title || a.title === '[Removed]') return;
        if (seen.has(a.url)) return;
        seen.add(a.url);
        var bronNaam = (a.source && a.source.name) ? a.source.name : new URL(a.url).hostname.replace('www.','');
        bronTelling[bronNaam] = (bronTelling[bronNaam] || 0) + 1;
        artikels.push({
          bron: bronNaam,
          kop: a.title.trim(),
          url: a.url,
          beschrijving: (a.description || a.content || '').replace(/<[^>]*>/g, '').trim().slice(0, 300),
          datum: a.publishedAt || '',
        });
      });
    });

    artikels.sort(function(a, b) { return b.datum.localeCompare(a.datum); });

    var bronnen = Object.keys(bronTelling).map(function(naam) {
      return { naam: naam, ok: true, count: bronTelling[naam] };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ artikels: artikels.slice(0, 80), bronnen: bronnen })
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};

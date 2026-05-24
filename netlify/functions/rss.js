exports.handler = async function(event, context) {
  const gnewsKey = event.headers['x-gnews-key'] || event.headers['X-Gnews-Key'];
  if (!gnewsKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Geen GNews API key meegegeven.' })
    };
  }

  // 3 calls: algemeen BE, sport, entertainment — blijft binnen gratis limiet van 10/dag
  var calls = [
    'https://gnews.io/api/v4/top-headlines?country=be&lang=nl&max=20&token=' + gnewsKey,
    'https://gnews.io/api/v4/top-headlines?topic=sports&country=be&lang=nl&max=10&token=' + gnewsKey,
    'https://gnews.io/api/v4/top-headlines?topic=entertainment&country=be&lang=nl&max=10&token=' + gnewsKey,
  ];

  try {
    var responses = await Promise.allSettled(calls.map(function(url) {
      return fetch(url, { signal: AbortSignal.timeout(10000) });
    }));

    var jsons = await Promise.allSettled(responses.map(function(r) {
      if (r.status !== 'fulfilled') return Promise.resolve(null);
      if (!r.value.ok) {
        return r.value.json().then(function(e) {
          throw new Error(e.errors ? e.errors.join(', ') : 'GNews fout ' + r.value.status);
        });
      }
      return r.value.json();
    }));

    var seen = new Set();
    var artikels = [];
    var bronTelling = {};
    var gnewsError = null;

    jsons.forEach(function(result) {
      if (result.status === 'rejected') {
        gnewsError = result.reason.message;
        return;
      }
      if (!result.value || !result.value.articles) return;
      result.value.articles.forEach(function(a) {
        if (!a.url || !a.title) return;
        if (seen.has(a.url)) return;
        seen.add(a.url);
        var bronNaam = (a.source && a.source.name) ? a.source.name : new URL(a.url).hostname.replace('www.','');
        bronTelling[bronNaam] = (bronTelling[bronNaam] || 0) + 1;
        artikels.push({
          bron: bronNaam,
          kop: a.title.trim(),
          url: a.url,
          beschrijving: (a.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 300),
          datum: a.publishedAt || '',
        });
      });
    });

    if (artikels.length === 0 && gnewsError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'GNews fout: ' + gnewsError })
      };
    }

    artikels.sort(function(a, b) { return b.datum.localeCompare(a.datum); });

    var bronnen = Object.keys(bronTelling).map(function(naam) {
      return { naam: naam, ok: true, count: bronTelling[naam] };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ artikels: artikels, bronnen: bronnen })
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};

const NBA_CDN = 'https://cdn.nba.com/static/json/liveData';

export async function fetchNbaJson(path: string, cacheSeconds: number): Promise<Response> {
  const upstream = await fetch(`${NBA_CDN}/${path}`, {
    headers: {
      Accept: 'application/json',
      Referer: 'https://www.nba.com/',
      'User-Agent': 'banjitino.com NBA scoreboard'
    }
  });

  if (!upstream.ok) {
    return Response.json(
      { error: 'NBA data is unavailable', status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
    }
  });
}

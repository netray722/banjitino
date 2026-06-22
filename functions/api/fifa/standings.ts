import { ESPN_FIFA_STANDINGS_API, FIFA_STANDINGS_CACHE_SECONDS } from '../../_shared/fifa.constants';

export const onRequestGet: PagesFunction = async (): Promise<Response> => {
  const upstream = await fetch(ESPN_FIFA_STANDINGS_API, {
    headers: {
      Accept: 'application/json',
      Referer: 'https://www.espn.com/',
      'User-Agent': 'banjitino.com FIFA standings'
    }
  });

  if (!upstream.ok) {
    return Response.json(
      { error: 'FIFA standings are unavailable', status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${FIFA_STANDINGS_CACHE_SECONDS}, s-maxage=${FIFA_STANDINGS_CACHE_SECONDS}`
    }
  });
};

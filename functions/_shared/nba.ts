import { ESPN_NBA_API, ESPN_NBA_WEB_API, NBA_CDN } from './nba.constants';

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

export async function fetchEspnNbaJson(path: string, cacheSeconds: number): Promise<Response> {
  return fetchNbaUrl(`${ESPN_NBA_API}${path}`, cacheSeconds);
}

export async function fetchEspnNbaWebJson(path: string, cacheSeconds: number): Promise<Response> {
  return fetchNbaUrl(`${ESPN_NBA_WEB_API}${path}`, cacheSeconds);
}

async function fetchNbaUrl(url: string, cacheSeconds: number): Promise<Response> {
  const upstream = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Referer: 'https://www.espn.com/',
      'User-Agent': 'banjitino.com NBA data'
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

export function defaultDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nbaDatePath(dateKey: string): string {
  return dateKey.replace(/-/g, '');
}

export function validDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function currentNbaSeason(now = new Date()): string {
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function nbaSeasonDateRange(season: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(season);
  if (!match) return null;
  const startYear = Number(match[1]);
  if ((startYear + 1) % 100 !== Number(match[2])) return null;
  return `${startYear}0701-${startYear + 1}0630`;
}

export function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

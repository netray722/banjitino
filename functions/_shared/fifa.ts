import { FIFA_API } from './fifa.constants';
import { FifaDateWindow } from './fifa.types';
export async function fetchFifaJson(path: string, cacheSeconds: number): Promise<Response> {
  const upstream = await fetch(`${FIFA_API}/${path}`, {
    headers: fifaHeaders('application/json')
  });

  if (!upstream.ok) {
    return Response.json(
      { error: 'FIFA data is unavailable', status: upstream.status },
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

export async function fetchFifaImage(path: string, cacheSeconds: number): Promise<Response> {
  const upstream = await fetch(`${FIFA_API}/${path}`, {
    headers: fifaHeaders('image/png,image/*')
  });

  if (!upstream.ok) {
    return Response.json(
      { error: 'FIFA image is unavailable', status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
    }
  });
}

export function fifaDateWindow(matchDate: string): FifaDateWindow {
  const previousDate = addDays(matchDate, -1);
  const nextDate = addDays(matchDate, 2);

  return {
    matchDate,
    from: previousDate,
    to: nextDate
  };
}

export function defaultDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function validDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function withMatchDate(payload: unknown, matchDate: string): unknown {
  return { ...(payload as Record<string, unknown>), matchDate };
}

function fifaHeaders(accept: string): HeadersInit {
  return {
    Accept: accept,
    Referer: 'https://www.fifa.com/',
    'User-Agent': 'banjitino.com FIFA scoreboard'
  };
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

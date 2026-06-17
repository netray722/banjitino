const FIFA_API = 'https://api.fifa.com/api/v3';
const FIFA_TIME_ZONE = 'America/New_York';

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

export function currentFifaDateWindow(now = new Date()): { matchDate: string; from: string; to: string } {
  const matchDate = localDateKey(now);
  const nextDate = localDateKey(addDaysAtNoon(matchDate, 1));

  return {
    matchDate,
    from: matchDate,
    to: nextDate
  };
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

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FIFA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDaysAtNoon(dateKey: string, days: number): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 16));
}

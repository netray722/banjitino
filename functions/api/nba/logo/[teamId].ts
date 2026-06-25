export const onRequestGet: PagesFunction<{ teamId?: string | string[] }> = async (context) => {
  const teamId = Array.isArray(context.params.teamId)
    ? context.params.teamId[0]
    : context.params.teamId;

  if (!teamId || !/^\d{10}$/.test(teamId)) {
    return new Response('Invalid NBA team ID', { status: 400 });
  }

  const upstream = await fetch(`https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`, {
    headers: {
      Accept: 'image/svg+xml,image/*',
      Referer: 'https://www.nba.com/',
      'User-Agent': 'banjitino.com NBA scoreboard'
    }
  });

  if (!upstream.ok) {
    return new Response('NBA team logo unavailable', { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  });
};

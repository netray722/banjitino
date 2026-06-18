import { defaultDateKey, fetchFifaJson, fifaDateWindow, validDateKey, withMatchDate } from '../../_shared/fifa';

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get('date');
  const { matchDate, from, to } = fifaDateWindow(validDateKey(requestedDate) ? requestedDate : defaultDateKey());
  const query = new URLSearchParams({
    language: 'en',
    count: '50',
    idCompetition: '17',
    from,
    to
  });
  const response = await fetchFifaJson(`calendar/matches?${query}`, 15);

  if (!response.ok) {
    const espnDate = matchDate.replace(/-/g, '');
    const fallback = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${espnDate}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'banjitino.com FIFA scoreboard' } }
    );
    if (!fallback.ok) return response;
    return new Response(fallback.body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15, s-maxage=15'
      }
    });
  }

  const payload = await response.json();
  return Response.json(withMatchDate(payload, matchDate), {
    headers: {
      'Cache-Control': 'public, max-age=15, s-maxage=15'
    }
  });
};

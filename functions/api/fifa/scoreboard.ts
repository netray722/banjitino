import { currentFifaDateWindow, fetchFifaJson, withMatchDate } from '../../_shared/fifa';

export const onRequestGet: PagesFunction = async () => {
  const { matchDate, from, to } = currentFifaDateWindow();
  const query = new URLSearchParams({
    language: 'en',
    count: '50',
    idCompetition: '17',
    from,
    to
  });
  const response = await fetchFifaJson(`calendar/matches?${query}`, 15);

  if (!response.ok) {
    return response;
  }

  const payload = await response.json();
  return Response.json(withMatchDate(payload, matchDate), {
    headers: {
      'Cache-Control': 'public, max-age=15, s-maxage=15'
    }
  });
};

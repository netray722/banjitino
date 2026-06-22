import { NBA_TRADES_CACHE_SECONDS, NBA_TRADES_MAX_PAGE_SIZE } from '../../_shared/nba.constants';
import { boundedInteger, currentNbaSeason, fetchEspnNbaJson, nbaSeasonDateRange } from '../../_shared/nba';

export const onRequestGet: PagesFunction = ({ request }) => {
  const url = new URL(request.url);
  const season = url.searchParams.get('season') ?? currentNbaSeason();
  const dates = nbaSeasonDateRange(season);
  if (!dates) {
    return Response.json({ error: 'Invalid NBA season. Expected YYYY-YY.' }, { status: 400 });
  }

  const page = boundedInteger(url.searchParams.get('page'), 1, 1, 100);
  const limit = boundedInteger(url.searchParams.get('limit'), NBA_TRADES_MAX_PAGE_SIZE, 1, NBA_TRADES_MAX_PAGE_SIZE);
  const query = new URLSearchParams({ dates, page: String(page), limit: String(limit) });
  return fetchEspnNbaJson(`/apis/site/v2/sports/basketball/nba/transactions?${query}`, NBA_TRADES_CACHE_SECONDS);
};

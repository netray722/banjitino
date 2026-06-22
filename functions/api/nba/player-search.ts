import { NBA_PLAYER_SEARCH_CACHE_SECONDS } from '../../_shared/nba.constants';
import { fetchEspnNbaWebJson } from '../../_shared/nba';

export const onRequestGet: PagesFunction = ({ request }) => {
  const query = new URL(request.url).searchParams.get('query')?.trim() ?? '';
  if (query.length < 2 || query.length > 80) {
    return Response.json({ error: 'Player query must contain 2 to 80 characters.' }, { status: 400 });
  }
  const params = new URLSearchParams({ region: 'us', lang: 'en', section: 'nba', query });
  return fetchEspnNbaWebJson(`/apis/search/v2?${params}`, NBA_PLAYER_SEARCH_CACHE_SECONDS);
};

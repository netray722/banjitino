import { NBA_ACTIVE_PLAYER_STATS_CACHE_SECONDS, NBA_HISTORICAL_PLAYER_STATS_CACHE_SECONDS } from '../../../_shared/nba.constants';
import { currentNbaSeason, fetchEspnNbaWebJson } from '../../../_shared/nba';

export const onRequestGet: PagesFunction<{ playerId: string }> = ({ request, params }) => {
  const playerId = params.playerId;
  const season = Number.parseInt(new URL(request.url).searchParams.get('season') ?? '', 10);
  if (!/^\d+$/.test(playerId) || !Number.isInteger(season) || season < 2001 || season > 2100) {
    return Response.json({ error: 'Invalid player or season.' }, { status: 400 });
  }
  const activeSeasonEnd = Number.parseInt(currentNbaSeason().slice(0, 4), 10) + 1;
  const cacheSeconds = season === activeSeasonEnd ? NBA_ACTIVE_PLAYER_STATS_CACHE_SECONDS : NBA_HISTORICAL_PLAYER_STATS_CACHE_SECONDS;
  const query = new URLSearchParams({ region: 'us', lang: 'en', contentorigin: 'espn', season: String(season), seasontype: '2' });
  return fetchEspnNbaWebJson(`/apis/common/v3/sports/basketball/nba/athletes/${playerId}/stats?${query}`, cacheSeconds);
};

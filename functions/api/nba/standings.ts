import { NBA_STANDINGS_CACHE_SECONDS } from '../../_shared/nba.constants';
import { fetchEspnNbaJson } from '../../_shared/nba';

export const onRequestGet: PagesFunction = () =>
  fetchEspnNbaJson('/apis/v2/sports/basketball/nba/standings', NBA_STANDINGS_CACHE_SECONDS);

import { fetchNbaJson } from '../../_shared/nba';

export const onRequestGet = async (): Promise<Response> =>
  fetchNbaJson('scoreboard/todaysScoreboard_00.json', 15);

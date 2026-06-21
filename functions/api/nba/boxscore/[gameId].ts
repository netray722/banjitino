import { fetchNbaJson } from '../../../_shared/nba';
import { BoxScoreContext } from './boxscore.types';

export const onRequestGet = async (context: BoxScoreContext): Promise<Response> => {
  const gameId = Array.isArray(context.params.gameId)
    ? context.params.gameId[0]
    : context.params.gameId;

  if (!gameId || !/^\d{10}$/.test(gameId)) {
    return Response.json({ error: 'Invalid NBA game ID' }, { status: 400 });
  }

  return fetchNbaJson(`boxscore/boxscore_${gameId}.json`, 10);
};

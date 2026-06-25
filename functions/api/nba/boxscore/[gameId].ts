import { fetchNbaJson } from '../../../_shared/nba';

export const onRequestGet: PagesFunction<{ gameId?: string | string[] }> = async (context) => {
  const gameId = Array.isArray(context.params.gameId)
    ? context.params.gameId[0]
    : context.params.gameId;

  if (!gameId || !/^\d{10}$/.test(gameId)) {
    return Response.json({ error: 'Invalid NBA game ID' }, { status: 400 });
  }

  return fetchNbaJson(`boxscore/boxscore_${gameId}.json`, 10);
};

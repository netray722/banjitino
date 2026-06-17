import { fetchFifaJson } from '../../../_shared/fifa';

export const onRequestGet: PagesFunction<{ matchId: string }> = async ({ params }) => {
  const matchId = params.matchId;

  if (!/^\d+$/.test(matchId)) {
    return Response.json({ error: 'Invalid FIFA match id' }, { status: 400 });
  }

  return fetchFifaJson(`live/football/${matchId}?language=en`, 10);
};

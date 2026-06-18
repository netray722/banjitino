import { defaultDateKey, fetchNbaJson, nbaDatePath, validDateKey } from '../../_shared/nba';

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get('date');
  if (!requestedDate) {
    return fetchNbaJson('scoreboard/todaysScoreboard_00.json', 15);
  }

  const dateKey = validDateKey(requestedDate) ? requestedDate : defaultDateKey();
  return fetchNbaJson(`scoreboard/scoreboard_${nbaDatePath(dateKey)}.json`, 15);
};

import { describe, expect, it } from 'vitest';

import { groupNbaTrades } from './nba-trades';
import { NbaTradeEntry } from './nba.types';

function entry(id: string, teamCode: string, teamName: string, description: string): NbaTradeEntry {
  return { id, date: '2026-02-05', season: '2025-26', teamId: id.charCodeAt(0), teamCode, teamName, teamLogoUrl: `${teamCode}.png`, description };
}

describe('NBA trade grouping', () => {
  it('combines reciprocal entries and parses players, picks, and direction', () => {
    const groups = groupNbaTrades([
      entry('a', 'LAL', 'Los Angeles Lakers', 'Acquired G Player Alpha from Boston in exchange for F Player Beta and a 2027 first-round pick.'),
      entry('b', 'BOS', 'Boston Celtics', 'Acquired F Player Beta and a 2027 first-round pick from Los Angeles Lakers in exchange for G Player Alpha.')
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ combined: true, teams: [{ code: 'BOS' }, { code: 'LAL' }] });
    const lakers = groups[0].teams.find((team) => team.code === 'LAL')!;
    expect(lakers.received).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'player', playerName: 'Player Alpha' })]));
    expect(lakers.sent).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'player', playerName: 'Player Beta' }),
      expect.objectContaining({ kind: 'pick' })
    ]));
  });

  it('combines a proven transitive three-team trade', () => {
    const groups = groupNbaTrades([
      entry('a', 'LAL', 'Los Angeles Lakers', 'Sent G Player Alpha to Boston. Acquired F Player Gamma from Chicago.'),
      entry('b', 'BOS', 'Boston Celtics', 'Acquired G Player Alpha from Los Angeles Lakers. Sent C Player Beta to Chicago.'),
      entry('c', 'CHI', 'Chicago Bulls', 'Acquired C Player Beta from Boston. Sent F Player Gamma to Los Angeles Lakers.')
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].teams).toHaveLength(3);
  });

  it('keeps unrelated same-day reports separate', () => {
    const groups = groupNbaTrades([
      entry('a', 'LAL', 'Los Angeles Lakers', 'Acquired G Player Alpha from Boston.'),
      entry('b', 'NYK', 'New York Knicks', 'Acquired F Player Delta from Chicago.')
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => !group.combined)).toBe(true);
    expect(groups[0].sourceNotes.length).toBe(1);
  });

  it('does not merge reciprocal team references when their assets do not match', () => {
    const groups = groupNbaTrades([
      entry('a', 'LAL', 'Los Angeles Lakers', 'Acquired G Player Alpha from Boston.'),
      entry('b', 'BOS', 'Boston Celtics', 'Acquired F Player Beta from Los Angeles Lakers.')
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => !group.combined)).toBe(true);
  });
});

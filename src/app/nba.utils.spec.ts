import { describe, expect, it } from 'vitest';

import {
  formatGameClock,
  formatMinutes,
  normalizeBoxScore,
  normalizeScoreboard,
  periodLabel
} from './nba.utils';

describe('NBA data normalization', () => {
  it('normalizes and sorts scheduled, live, and final games', () => {
    const scoreboard = normalizeScoreboard({
      scoreboard: {
        gameDate: '2026-06-13',
        games: [
          {
            gameId: '3',
            gameStatus: 3,
            gameStatusText: 'Final',
            gameTimeUTC: '2026-06-14T02:00:00Z',
            awayTeam: { teamTricode: 'BOS', score: 110 },
            homeTeam: { teamTricode: 'LAL', score: 101 }
          },
          {
            gameId: '1',
            gameStatus: 1,
            gameTimeUTC: '2026-06-13T20:00:00Z',
            awayTeam: { teamTricode: 'NYK' },
            homeTeam: { teamTricode: 'PHI' }
          },
          {
            gameId: '2',
            gameStatus: 2,
            gameClock: 'PT02M05.40S',
            period: 4,
            gameTimeUTC: '2026-06-13T23:00:00Z',
            awayTeam: { teamTricode: 'OKC', score: 92 },
            homeTeam: { teamTricode: 'MIN', score: 90 }
          }
        ]
      }
    });

    expect(scoreboard.gameDate).toBe('2026-06-13');
    expect(scoreboard.games.map((game) => game.id)).toEqual(['1', '2', '3']);
    expect(scoreboard.games.map((game) => game.status)).toEqual(['scheduled', 'live', 'final']);
    expect(scoreboard.games[1].clock).toBe('2:05');
    expect(scoreboard.games[1].awayTeam.color).toBe('#007ac1');
  });

  it('normalizes played players and team totals from a box score', () => {
    const boxScore = normalizeBoxScore({
      game: {
        gameId: '0022500001',
        gameStatusText: 'Final',
        arena: { arenaName: 'Test Arena' },
        awayTeam: {
          teamId: 1,
          teamCity: 'Boston',
          teamName: 'Celtics',
          teamTricode: 'BOS',
          score: 112,
          statistics: {
            points: 112,
            reboundsTotal: 47,
            assists: 29,
            fieldGoalsMade: 42,
            fieldGoalsAttempted: 86
          },
          players: [
            {
              personId: 7,
              name: 'Active Player',
              nameI: 'A. Player',
              jerseyNum: '7',
              position: 'F',
              starter: '1',
              played: '1',
              order: 1,
              statistics: {
                minutes: 'PT35M09.00S',
                points: 25,
                reboundsTotal: 8,
                assists: 5,
                fieldGoalsMade: 9,
                fieldGoalsAttempted: 16,
                plusMinusPoints: 6
              }
            },
            {
              personId: 8,
              name: 'Inactive Player',
              played: '0',
              order: 2
            }
          ]
        },
        homeTeam: { teamTricode: 'NYK', players: [] }
      }
    });

    expect(boxScore.arena).toBe('Test Arena');
    expect(boxScore.awayTeam.players).toHaveLength(1);
    expect(boxScore.awayTeam.players[0]).toMatchObject({
      shortName: 'A. Player',
      minutes: '35:09',
      points: 25,
      fieldGoals: '9-16',
      plusMinus: 6
    });
    expect(boxScore.awayTeam.totals).toMatchObject({
      points: 112,
      rebounds: 47,
      assists: 29,
      fieldGoals: '42-86'
    });
  });

  it('formats NBA clocks and overtime labels', () => {
    expect(formatGameClock('PT00M09.90S')).toBe('0:09');
    expect(formatMinutes('PT31M00.00S')).toBe('31:00');
    expect(formatGameClock('')).toBe('');
    expect(periodLabel(4)).toBe('Q4');
    expect(periodLabel(6)).toBe('OT2');
  });

  it('returns safe defaults for incomplete payloads', () => {
    expect(normalizeScoreboard({})).toEqual({ gameDate: '', games: [] });
    const boxScore = normalizeBoxScore({});
    expect(boxScore.gameId).toBe('');
    expect(boxScore.awayTeam.players).toEqual([]);
  });
});

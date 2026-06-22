import { describe, expect, it } from 'vitest';

import {
  formatGameDate,
  formatGameClock,
  formatMinutes,
  buildNbaStandingsLookup,
  currentNbaSeason,
  findNbaStanding,
  nbaSeasonDateRange,
  normalizeBoxScore,
  normalizeNbaStandings,
  normalizeNbaTrades,
  normalizeNbaPlayerSearch,
  normalizeNbaPlayerStats,
  nbaPlayerKey,
  normalizeScoreboard,
  periodLabel
} from './nba-data';

describe('NBA data normalization', () => {
  it('requires an exact NBA player match and reads season averages by semantic name', () => {
    const match = normalizeNbaPlayerSearch({ results: [{ type: 'player', contents: [{
      type: 'player', displayName: 'Nikola Vučević', description: 'NBA', defaultLeagueSlug: 'nba',
      uid: 's:40~l:46~a:6478', image: { default: 'headshot.png' }
    }, { type: 'player', displayName: 'Nikola Vučević', description: 'NCAAM', uid: 's:40~l:41~a:1' }] }] }, 'Nikola Vucevic');
    expect(match).toEqual({ id: '6478', name: 'Nikola Vučević', headshotUrl: 'headshot.png' });
    expect(nbaPlayerKey('Nikola Vučević')).toBe(nbaPlayerKey('Nikola Vucevic'));
    const summary = normalizeNbaPlayerStats({ categories: [{
      name: 'averages', names: ['avgAssists', 'avgPoints', 'avgRebounds'],
      statistics: [{ season: { year: 2026 }, position: 'C', stats: ['3.4', '18.2', '10.1'] }]
    }] }, match!, '2025-26');
    expect(summary).toMatchObject({ position: 'C', points: 18.2, rebounds: 10.1, assists: 3.4 });
    expect(normalizeNbaPlayerStats({}, match!, '2025-26')).toMatchObject({ points: null, rebounds: null, assists: null, headshotUrl: 'headshot.png' });
  });

  it('accepts one canonical suffix match but rejects ambiguous player matches', () => {
    const content = (name: string, id: string) => ({
      type: 'player', displayName: name, description: 'NBA', defaultLeagueSlug: 'nba', uid: `s:40~l:46~a:${id}`
    });
    expect(normalizeNbaPlayerSearch({ results: [{ type: 'player', contents: [content('Gary Trent Jr.', '1')] }] }, 'Gary Trent')?.id).toBe('1');
    expect(normalizeNbaPlayerSearch({ results: [{ type: 'player', contents: [content('Gary Trent Jr.', '1'), content('Gary Trent Sr.', '2')] }] }, 'Gary Trent')).toBeNull();
  });
  it('normalizes conference standings by stat name and supports id and code lookup', () => {
    const standings = normalizeNbaStandings({ children: [{ name: 'Eastern Conference', standings: { entries: [{
      team: { id: '18', abbreviation: 'NY' },
      stats: [
        { name: 'losses', value: 28 }, { name: 'gamesBehind', displayValue: '4.0' },
        { name: 'playoffSeed', value: 3 }, { name: 'wins', value: 42 }, { name: 'winPercent', value: .6 }
      ]
    }] } }, { name: 'Western Conference', standings: { entries: [{
      team: { id: '13', abbreviation: 'LAL' }, stats: [{ name: 'wins', value: 40 }]
    }] } }] });

    expect(standings).toHaveLength(2);
    expect(standings[0]).toEqual({ teamId: 18, teamCode: 'NYK', conference: 'East', seed: 3, wins: 42, losses: 28, winPercentage: .6, gamesBehind: 4 });
    const lookup = buildNbaStandingsLookup(standings);
    expect(findNbaStanding(lookup, { id: 18, code: 'OTHER' } as never)?.seed).toBe(3);
    expect(findNbaStanding(lookup, { id: 0, code: 'NY' } as never)?.wins).toBe(42);
  });

  it('keeps only trade-related sentences and normalizes pagination', () => {
    const page = normalizeNbaTrades({ pageIndex: 2, pageCount: 4, transactions: [{
      date: '2026-02-05T08:00Z',
      description: 'Waived G One. Acquired G Two from Boston in exchange for a pick. Signed F Three.',
      team: { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers', logos: [{ href: 'logo.png', rel: ['scoreboard'] }] }
    }, {
      date: '2026-02-04T08:00Z', description: 'Hired a new head coach.', team: { id: '1', abbreviation: 'ATL' }
    }] }, '2025-26');

    expect(page).toMatchObject({ season: '2025-26', page: 2, pageCount: 4 });
    expect(page.trades).toHaveLength(1);
    expect(page.trades[0].description).toBe('Acquired G Two from Boston in exchange for a pick.');
    expect(page.trades[0].teamLogoUrl).toBe('logo.png');
  });

  it('calculates current NBA seasons around the July boundary', () => {
    expect(currentNbaSeason(new Date(2026, 5, 30))).toBe('2025-26');
    expect(currentNbaSeason(new Date(2026, 6, 1))).toBe('2026-27');
    expect(nbaSeasonDateRange('2025-26')).toBe('20250701-20260630');
  });
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

  it('normalizes a dated stats scoreboard response', () => {
    const scoreboard = normalizeScoreboard({
      resultSets: [{
        name: 'GameHeader',
        headers: [
          'GAME_DATE_EST',
          'GAME_SEQUENCE',
          'GAME_ID',
          'GAME_STATUS_ID',
          'GAME_STATUS_TEXT',
          'HOME_TEAM_ID',
          'VISITOR_TEAM_ID',
          'LIVE_PERIOD',
          'LIVE_PC_TIME'
        ],
        rowSet: [[
          '2026-06-18T00:00:00',
          1,
          '0022500101',
          3,
          'Final',
          1610612747,
          1610612738,
          4,
          ''
        ]]
      }, {
        name: 'LineScore',
        headers: [
          'GAME_ID',
          'TEAM_ID',
          'TEAM_ABBREVIATION',
          'TEAM_CITY_NAME',
          'TEAM_NICKNAME',
          'TEAM_WINS_LOSSES',
          'PTS_QTR1',
          'PTS_QTR2',
          'PTS',
        ],
        rowSet: [[
          '0022500101',
          1610612738,
          'BOS',
          'Boston',
          'Celtics',
          '10-2',
          26,
          31,
          118
        ], [
          '0022500101',
          1610612747,
          'LAL',
          'Los Angeles',
          'Lakers',
          '8-4',
          22,
          29,
          101
        ]]
      }]
    });

    expect(scoreboard.gameDate).toBe('2026-06-18');
    expect(scoreboard.games[0]).toMatchObject({
      id: '0022500101',
      status: 'final',
      statusText: 'Final',
      awayTeam: { code: 'BOS', city: 'Boston', name: 'Celtics', score: 118 },
      homeTeam: { code: 'LAL', city: 'Los Angeles', name: 'Lakers', score: 101 }
    });
    expect(scoreboard.games[0].awayTeam.periods).toEqual([26, 31]);
  });

  it('normalizes a dated ESPN scoreboard response', () => {
    const scoreboard = normalizeScoreboard({
      day: { date: '2026-06-13T07:00Z' },
      events: [{
        id: '401859967',
        date: '2026-06-14T00:30Z',
        name: 'New York Knicks at San Antonio Spurs',
        competitions: [{
          notes: [{ headline: 'NBA Finals - Game 5' }],
          status: {
            displayClock: '0.0',
            period: 4,
            type: { id: '3', completed: true, shortDetail: 'Final' }
          },
          competitors: [{
            id: '24',
            homeAway: 'home',
            score: '90',
            team: { id: '24', abbreviation: 'SA', location: 'San Antonio', name: 'Spurs', color: '000000', logo: 'https://example.com/sas.png' },
            linescores: [{ value: 23 }, { value: 19 }],
            records: [{ type: 'total', summary: '62-20' }]
          }, {
            id: '18',
            homeAway: 'away',
            score: '94',
            team: { id: '18', abbreviation: 'NY', location: 'New York', name: 'Knicks', color: '1d428a', logo: 'https://example.com/nyk.png' },
            linescores: [{ value: 13 }, { value: 24 }],
            records: [{ type: 'total', summary: '53-29' }]
          }]
        }]
      }]
    });

    expect(scoreboard.gameDate).toBe('2026-06-13');
    expect(scoreboard.games[0]).toMatchObject({
      id: '401859967',
      status: 'final',
      statusText: 'Final',
      seriesText: 'NBA Finals - Game 5',
      awayTeam: { code: 'NYK', city: 'New York', name: 'Knicks', score: 94, logoUrl: 'https://example.com/nyk.png' },
      homeTeam: { code: 'SAS', city: 'San Antonio', name: 'Spurs', score: 90, logoUrl: 'https://example.com/sas.png' }
    });
    expect(scoreboard.games[0].homeTeam.periods).toEqual([23, 19]);
  });

  it('normalizes an ESPN summary box score response', () => {
    const boxScore = normalizeBoxScore({
      header: {
        id: '401859967',
        competitions: [{
          status: { type: { shortDetail: 'Final' } },
          competitors: [{
            id: '18',
            homeAway: 'away',
            score: '94',
            team: { id: '18', abbreviation: 'NY', location: 'New York', name: 'Knicks', color: '1d428a' }
          }, {
            id: '24',
            homeAway: 'home',
            score: '90',
            team: { id: '24', abbreviation: 'SA', location: 'San Antonio', name: 'Spurs', color: '000000' }
          }]
        }]
      },
      gameInfo: { venue: { fullName: 'Frost Bank Center' } },
      boxscore: {
        teams: [{
          homeAway: 'away',
          team: { id: '18', abbreviation: 'NY', location: 'New York', name: 'Knicks', color: '1d428a' },
          statistics: [
            { name: 'points', displayValue: '94' },
            { name: 'totalRebounds', displayValue: '48' },
            { name: 'assists', displayValue: '14' },
            { name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: '31-87' },
            { name: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', displayValue: '12-37' },
            { name: 'freeThrowsMade-freeThrowsAttempted', displayValue: '20-28' }
          ]
        }, {
          homeAway: 'home',
          team: { id: '24', abbreviation: 'SA', location: 'San Antonio', name: 'Spurs', color: '000000' },
          statistics: [
            { name: 'points', displayValue: '90' },
            { name: 'totalRebounds', displayValue: '42' },
            { name: 'assists', displayValue: '18' },
            { name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: '33-81' },
            { name: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', displayValue: '9-28' },
            { name: 'freeThrowsMade-freeThrowsAttempted', displayValue: '15-19' }
          ]
        }],
        players: [{
          team: { id: '18' },
          statistics: [{
            keys: [
              'minutes',
              'points',
              'fieldGoalsMade-fieldGoalsAttempted',
              'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
              'freeThrowsMade-freeThrowsAttempted',
              'rebounds',
              'assists',
              'turnovers',
              'steals',
              'blocks',
              'plusMinus'
            ],
            totals: ['', '94', '31-87', '12-37', '20-28', '48', '14', '10', '8', '4', ''],
            athletes: [{
              starter: true,
              didNotPlay: false,
              athlete: {
                id: '3934672',
                displayName: 'Jalen Brunson',
                shortName: 'J. Brunson',
                jersey: '11',
                position: { abbreviation: 'G' }
              },
              stats: ['41', '45', '14-27', '4-7', '13-15', '3', '3', '3', '2', '0', '+10']
            }]
          }]
        }]
      }
    });

    expect(boxScore).toMatchObject({
      gameId: '401859967',
      statusText: 'Final',
      arena: 'Frost Bank Center',
      awayTeam: {
        code: 'NYK',
        score: 94,
        totals: {
          points: 94,
          rebounds: 48,
          assists: 14,
          fieldGoals: '31-87',
          threePointers: '12-37',
          freeThrows: '20-28'
        }
      },
      homeTeam: { code: 'SAS', score: 90 }
    });
    expect(boxScore.awayTeam.players[0]).toMatchObject({
      shortName: 'J. Brunson',
      points: 45,
      fieldGoals: '14-27',
      plusMinus: 10
    });
  });

  it('formats NBA clocks and overtime labels', () => {
    expect(formatGameClock('PT00M09.90S')).toBe('0:09');
    expect(formatMinutes('PT31M00.00S')).toBe('31:00');
    expect(formatGameClock('')).toBe('');
    expect(periodLabel(4)).toBe('Q4');
    expect(periodLabel(6)).toBe('OT2');
  });

  it('formats nearby NBA dates as relative labels', () => {
    const today = new Date('2026-06-17T15:00:00Z');
    expect(formatGameDate('2026-06-16', today)).toBe('Yesterday');
    expect(formatGameDate('2026-06-17', today)).toBe('Today');
    expect(formatGameDate('2026-06-18', today)).toBe('Tomorrow');
    expect(formatGameDate('2026-06-19', today)).toContain('Friday');
  });

  it('returns safe defaults for incomplete payloads', () => {
    expect(normalizeScoreboard({})).toEqual({ gameDate: '', games: [] });
    const boxScore = normalizeBoxScore({});
    expect(boxScore.gameId).toBe('');
    expect(boxScore.awayTeam.players).toEqual([]);
  });
});

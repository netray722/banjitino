import { describe, expect, it } from 'vitest';

import { buildFifaStandingsLookup, findFifaStanding, formatFifaDate, normalizeFifaMatchDetails, normalizeFifaScoreboard, normalizeFifaStandings } from './fifa-data';

describe('FIFA normalizers', () => {
  it('normalizes all standings groups by statistic name and supports id/code lookup', () => {
    const standings = normalizeFifaStandings({
      children: Array.from({ length: 12 }, (_, index) => ({
        name: `Group ${String.fromCharCode(65 + index)}`,
        standings: {
          entries: [{
            team: { id: String(200 + index), abbreviation: `T${index}` },
            stats: [
              { name: 'points', value: 6 },
              { name: 'losses', value: 0 },
              { name: 'rank', value: 1 },
              { name: 'pointDifferential', displayValue: '+3' },
              { name: 'ties', value: 0 },
              { name: 'wins', value: 2 }
            ]
          }]
        }
      }))
    });

    expect(standings).toHaveLength(12);
    expect(standings[0]).toEqual({
      teamId: '200', teamCode: 'T0', group: 'Group A', rank: 1,
      wins: 2, draws: 0, losses: 0, points: 6, goalDifference: 3
    });

    const lookup = buildFifaStandingsLookup(standings);
    expect(findFifaStanding(lookup, { id: '200', code: 'XXX', name: '', score: null })).toBe(standings[0]);
    expect(findFifaStanding(lookup, { id: '', code: 't0', name: '', score: null })).toBe(standings[0]);
  });

  it('normalizes the ESPN World Cup fallback feed', () => {
    const scoreboard = normalizeFifaScoreboard({
      matchDate: '2026-06-18',
      events: [{
        id: '760438',
        date: '2026-06-18T16:00:00Z',
        season: { slug: 'group-stage' },
        competitions: [{
          altGameNote: 'FIFA World Cup, Group A',
          status: { type: { state: 'post', shortDetail: 'FT' } },
          venue: { fullName: 'Mercedes-Benz Stadium', address: { city: 'Atlanta, Georgia' } },
          competitors: [
            { homeAway: 'home', score: '1', team: { id: '450', abbreviation: 'CZE', displayName: 'Czechia' } },
            { homeAway: 'away', score: '1', shootoutScore: '2', team: { id: '467', abbreviation: 'RSA', displayName: 'South Africa' } }
          ]
        }]
      }]
    }, new Date('2026-06-18T18:00:00Z'));

    expect(scoreboard.matches).toHaveLength(1);
    expect(scoreboard.matches[0]).toMatchObject({
      id: '760438', status: 'final', group: 'Group A', venue: 'Mercedes-Benz Stadium'
    });
    expect(scoreboard.matches[0].homeTeam).toMatchObject({ name: 'Czechia', code: 'CZE', score: 1 });
    expect(scoreboard.matches[0].awayTeam.penaltyScore).toBe(2);
  });

  it('normalizes current-day matches and sorts by kickoff', () => {
    const scoreboard = normalizeFifaScoreboard({
      matchDate: '2026-06-17',
      Results: [
        {
          IdMatch: '0',
          Date: '2026-06-17T01:00:00Z',
          MatchStatus: 0,
          HomeTeam: { Score: 3, TeamName: [{ Description: 'Argentina' }], Abbreviation: 'ARG' },
          AwayTeam: { Score: 0, TeamName: [{ Description: 'Algeria' }], Abbreviation: 'ALG' }
        },
        {
          IdMatch: '2',
          Date: '2026-06-17T20:00:00Z',
          MatchStatus: 0,
          HomeTeam: { Score: 2, TeamName: [{ Description: 'Mexico' }], Abbreviation: 'MEX' },
          AwayTeam: { Score: 1, TeamName: [{ Description: 'Korea Republic' }], Abbreviation: 'KOR' },
          GroupName: [{ Description: 'Group B' }],
          Stadium: { CityName: [{ Description: 'Houston' }] }
        },
        {
          IdMatch: '1',
          Date: '2026-06-17T16:00:00Z',
          HomeTeam: { TeamName: [{ Description: 'Canada' }], Abbreviation: 'CAN' },
          AwayTeam: { TeamName: [{ Description: 'Japan' }], Abbreviation: 'JPN' }
        },
        {
          IdMatch: '3',
          Date: '2026-06-18T02:00:00Z',
          HomeTeam: { TeamName: [{ Description: 'Uzbekistan' }], Abbreviation: 'UZB' },
          AwayTeam: { TeamName: [{ Description: 'Colombia' }], Abbreviation: 'COL' }
        }
      ]
    }, new Date('2026-06-17T15:00:00Z'));

    expect(scoreboard.matchDate).toBe('2026-06-17');
    expect(scoreboard.matches.map((match) => match.id)).toEqual(['1', '2', '3']);
    expect(scoreboard.matches[0].status).toBe('scheduled');
    expect(scoreboard.matches[1].status).toBe('final');
    expect(scoreboard.matches[1].homeTeam.score).toBe(2);
    expect(scoreboard.matches.some((match) => match.homeTeam.code === 'ARG')).toBe(false);
    expect(scoreboard.matches[2].homeTeam.name).toBe('Uzbekistan');
  });

  it('normalizes goals, bookings, substitutions, and lineups', () => {
    const details = normalizeFifaMatchDetails({
      IdMatch: '400021496',
      MatchStatus: 0,
      MatchNumber: 19,
      Winner: '43976',
      LocalDate: '2026-06-17T16:00:00Z',
      HomeTeam: {
        IdTeam: '43976',
        Score: 3,
        PenaltyScore: 4,
        TeamName: [{ Description: 'Argentina' }],
        Abbreviation: 'ARG',
        Tactics: '4-3-3',
        Players: [{
          IdPlayer: '10',
          ShirtNumber: 10,
          Captain: true,
          PlayerName: [{ Description: 'Example Forward' }],
          ShortName: [{ Description: 'E. Forward' }],
          Position: 3,
          Status: 1
        }],
        Statistics: [{
          Name: 'Total attempts',
          HomeValue: 12,
          AwayValue: 8
        }, {
          Name: 'Shots on target',
          HomeValue: 6,
          AwayValue: 2
        }, {
          Name: 'Ball possession',
          HomeValue: 58,
          AwayValue: 42
        }],
        Goals: [{ Minute: "14'", IdPlayer: '10', Type: 3 }],
        Bookings: [{ Minute: "70'", IdPlayer: '10', Type: 1 }],
        Substitutions: [{
          Minute: "80'",
          PlayerOnName: [{ Description: 'Fresh Legs' }],
          PlayerOffName: [{ Description: 'E. Forward' }]
        }]
      },
      AwayTeam: {
        IdTeam: '43938',
        Score: 0,
        PenaltyScore: 2,
        TeamName: [{ Description: 'Tunisia' }],
        Abbreviation: 'TUN',
        Players: []
      },
      GroupName: [{ Description: 'Group C' }],
      StageName: [{ Description: 'Group stage' }],
      Stadium: { Name: [{ Description: 'Mercedes-Benz Stadium' }], CityName: [{ Description: 'Atlanta' }] },
      Attendance: '74500',
      Officials: {
        OfficialType: 1,
        NameShort: [{ Description: 'Example Referee' }],
        TypeLocalized: [{ Description: 'Referee' }]
      },
      Weather: {
        Temperature: 72,
        Humidity: 55,
        TypeLocalized: [{ Description: 'Clear' }]
      }
    });

    expect(details.homeTeam.players[0].captain).toBe(true);
    expect(details.homeTeam.penaltyScore).toBe(4);
    expect(details.awayTeam.penaltyScore).toBe(2);
    expect(details.homeTeam.players[0].position).toBe('FW');
    expect(details.goals[0].detail).toBe('Penalty');
    expect(details.bookings[0].detail).toBe('Yellow card');
    expect(details.substitutions[0].detail).toBe('On for E. Forward');
    expect(details.venue).toBe('Mercedes-Benz Stadium');
    expect(details.facts).toEqual([
      { label: 'Match', value: 'No. 19' },
      { label: 'Stage', value: 'Group stage' },
      { label: 'Group', value: 'Group C' },
      { label: 'Winner', value: 'Argentina' },
      { label: 'Referee', value: 'Example Referee' },
      { label: 'Weather', value: 'Clear - 72 deg - 55% humidity' },
      { label: 'Local kickoff', value: '12:00 PM EDT' }
    ]);
    expect(details.stats).toEqual([
      { label: 'Shots', homeValue: '12', awayValue: '8', winner: 'home' },
      { label: 'Shots on target', homeValue: '6', awayValue: '2', winner: 'home' },
      { label: 'Possession', homeValue: '58%', awayValue: '42%', winner: 'home' }
    ]);
  });

  it('normalizes ESPN match details for an expanded card', () => {
    const details = normalizeFifaMatchDetails({
      header: {
        id: '760438',
        season: { type: { name: 'Group Stage' } },
        competitions: [{
          date: '2026-06-18T16:00:00Z',
          status: { type: { shortDetail: 'FT' } },
          competitors: [
            { homeAway: 'home', score: '1', shootoutScore: '3', team: { id: '450', abbreviation: 'CZE', displayName: 'Czechia' } },
            { homeAway: 'away', score: '1', shootoutScore: '2', team: { id: '467', abbreviation: 'RSA', displayName: 'South Africa' } }
          ],
          altGameNote: 'FIFA World Cup, Group A',
          details: [{ scoringPlay: true, clock: { displayValue: "6'" }, type: { text: 'Goal', type: 'goal' }, team: { id: '450' }, participants: [{ athlete: { displayName: 'M. Sadilek' } }] }]
        }]
      },
      boxscore: { teams: [
        { homeAway: 'home', team: { id: '450', abbreviation: 'CZE' }, statistics: [{ name: 'totalShots', displayValue: '14' }, { name: 'foulsCommitted', displayValue: '12' }] },
        { homeAway: 'away', team: { id: '467', abbreviation: 'RSA' }, statistics: [{ name: 'totalShots', displayValue: '17' }, { name: 'foulsCommitted', displayValue: '10' }] }
      ] },
      rosters: [{ homeAway: 'home', formation: '3-5-2' }, { homeAway: 'away', formation: '4-3-3' }],
      gameInfo: { venue: { fullName: 'Mercedes-Benz Stadium', address: { city: 'Atlanta, Georgia' } }, attendance: 67442 },
      keyEvents: [{
        scoringPlay: true,
        clock: { displayValue: "6'" },
        type: { text: 'Goal', type: 'goal' },
        team: { id: '450' },
        participants: [{ athlete: { displayName: 'M. Sadilek' } }]
      }, {
        clock: { displayValue: "40'" },
        type: { text: 'Yellow Card', type: 'yellow-card' },
        team: { id: '467' },
        participants: [{ athlete: { displayName: 'T. Mbatha' } }]
      }, {
        clock: { displayValue: "55'" },
        type: { text: 'Substitution', type: 'substitution' },
        team: { id: '450' },
        participants: [
          { athlete: { displayName: 'J. Zeleny' } },
          { athlete: { displayName: 'A. Sojka' } }
        ]
      }]
    });

    expect(details.venue).toBe('Mercedes-Benz Stadium');
    expect(details.homeTeam.penaltyScore).toBe(3);
    expect(details.awayTeam.penaltyScore).toBe(2);
    expect(details.homeTeam.tactics).toBe('3-5-2');
    expect(details.facts).toContainEqual({ label: 'Group', value: 'Group A' });
    expect(details.goals[0]).toMatchObject({ player: 'M. Sadilek', teamCode: 'CZE' });
    expect(details.bookings[0]).toMatchObject({ player: 'T. Mbatha', teamCode: 'RSA', detail: 'Yellow Card' });
    expect(details.substitutions[0]).toEqual({
      minute: "55'", teamCode: 'CZE', player: 'J. Zeleny', detail: 'On for A. Sojka'
    });
    expect(details.stats[0]).toEqual({ label: 'Shots', homeValue: '14', awayValue: '17', winner: 'away' });
    expect(details.stats.find((stat) => stat.label === 'Fouls')).toMatchObject({
      homeValue: '12', awayValue: '10', winner: 'away', lowerIsBetter: true
    });
  });

  it('formats a FIFA match date label', () => {
    const today = new Date('2026-06-17T15:00:00Z');
    expect(formatFifaDate('2026-06-16', today)).toBe('Yesterday');
    expect(formatFifaDate('2026-06-17', today)).toBe('Today');
    expect(formatFifaDate('2026-06-18', today)).toBe('Tomorrow');
    expect(formatFifaDate('2026-06-19', today)).toContain('Jun');
  });
});

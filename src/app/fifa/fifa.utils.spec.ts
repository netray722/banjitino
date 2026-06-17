import { describe, expect, it } from 'vitest';

import { formatFifaDate, normalizeFifaMatchDetails, normalizeFifaScoreboard } from './fifa.utils';

describe('FIFA normalizers', () => {
  it('normalizes current-day matches and sorts by kickoff', () => {
    const scoreboard = normalizeFifaScoreboard({
      matchDate: '2026-06-17',
      Results: [
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
        }
      ]
    }, new Date('2026-06-17T15:00:00Z'));

    expect(scoreboard.matchDate).toBe('2026-06-17');
    expect(scoreboard.matches.map((match) => match.id)).toEqual(['1', '2']);
    expect(scoreboard.matches[0].status).toBe('scheduled');
    expect(scoreboard.matches[1].status).toBe('final');
    expect(scoreboard.matches[1].homeTeam.score).toBe(2);
  });

  it('normalizes goals, bookings, substitutions, and lineups', () => {
    const details = normalizeFifaMatchDetails({
      IdMatch: '400021496',
      MatchStatus: 0,
      HomeTeam: {
        Score: 3,
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
        Goals: [{ Minute: "14'", IdPlayer: '10', Type: 3 }],
        Bookings: [{ Minute: "70'", IdPlayer: '10', Type: 1 }],
        Substitutions: [{
          Minute: "80'",
          PlayerOnName: [{ Description: 'Fresh Legs' }],
          PlayerOffName: [{ Description: 'E. Forward' }]
        }]
      },
      AwayTeam: {
        Score: 0,
        TeamName: [{ Description: 'Tunisia' }],
        Abbreviation: 'TUN',
        Players: []
      },
      Stadium: { Name: [{ Description: 'Mercedes-Benz Stadium' }], CityName: [{ Description: 'Atlanta' }] },
      Attendance: '74500'
    });

    expect(details.homeTeam.players[0].captain).toBe(true);
    expect(details.homeTeam.players[0].position).toBe('FW');
    expect(details.goals[0].detail).toBe('Penalty');
    expect(details.bookings[0].detail).toBe('Yellow card');
    expect(details.substitutions[0].detail).toBe('On for E. Forward');
    expect(details.venue).toBe('Mercedes-Benz Stadium');
  });

  it('formats a FIFA match date label', () => {
    expect(formatFifaDate('2026-06-17')).toContain('June');
  });
});

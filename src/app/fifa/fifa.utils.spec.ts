import { describe, expect, it } from 'vitest';

import { formatFifaDate, normalizeFifaMatchDetails, normalizeFifaScoreboard } from './fifa.utils';

describe('FIFA normalizers', () => {
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

  it('formats a FIFA match date label', () => {
    const today = new Date('2026-06-17T15:00:00Z');
    expect(formatFifaDate('2026-06-16', today)).toBe('Yesterday');
    expect(formatFifaDate('2026-06-17', today)).toBe('Today');
    expect(formatFifaDate('2026-06-18', today)).toBe('Tomorrow');
    expect(formatFifaDate('2026-06-19', today)).toContain('Jun');
  });
});

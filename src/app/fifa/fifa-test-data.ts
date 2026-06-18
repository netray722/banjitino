import { FifaMatch, FifaMatchDetails, FifaScoreboard } from './fifa.models';

export const scheduledFifaMatch: FifaMatch = {
  id: '400021401',
  status: 'scheduled',
  statusText: '12:00 PM EDT',
  startTimeUtc: '2026-06-17T16:00:00Z',
  matchTime: '',
  group: 'Group A',
  stage: 'First stage',
  venue: 'BMO Field',
  city: 'Toronto',
  attendance: '',
  homeTeam: {
    id: '43922',
    name: 'Canada',
    code: 'CAN',
    score: null
  },
  awayTeam: {
    id: '43935',
    name: 'Japan',
    code: 'JPN',
    score: null
  }
};

export const finalFifaMatch: FifaMatch = {
  ...scheduledFifaMatch,
  id: '400021496',
  status: 'final',
  statusText: 'Final',
  matchTime: "97'",
  group: 'Group C',
  city: 'Atlanta',
  homeTeam: {
    id: '43976',
    name: 'Argentina',
    code: 'ARG',
    score: 3
  },
  awayTeam: {
    id: '43938',
    name: 'Tunisia',
    code: 'TUN',
    score: 0
  }
};

export const fifaScoreboardFixture: FifaScoreboard = {
  matchDate: '2026-06-17',
  matches: [scheduledFifaMatch, finalFifaMatch]
};

export const fifaDetailsFixture: FifaMatchDetails = {
  id: finalFifaMatch.id,
  statusText: 'Final',
  venue: 'Mercedes-Benz Stadium',
  city: 'Atlanta',
  attendance: '74500',
  homeTeam: {
    ...finalFifaMatch.homeTeam,
    tactics: '4-3-3',
    players: [{
      id: '1',
      name: 'Example Forward',
      shortName: 'E. Forward',
      shirtNumber: '10',
      position: 'FW',
      starter: true,
      captain: true
    }]
  },
  awayTeam: {
    ...finalFifaMatch.awayTeam,
    tactics: '4-4-2',
    players: []
  },
  facts: [{
    label: 'Match',
    value: 'No. 19'
  }, {
    label: 'Stage',
    value: 'Group stage'
  }, {
    label: 'Referee',
    value: 'Example Referee'
  }],
  stats: [{
    label: 'Shots',
    homeValue: '12',
    awayValue: '8',
    winner: 'home'
  }, {
    label: 'Shots on target',
    homeValue: '6',
    awayValue: '2',
    winner: 'home'
  }, {
    label: 'Possession',
    homeValue: '58%',
    awayValue: '42%',
    winner: 'home'
  }],
  goals: [{
    minute: "11'",
    teamCode: 'ARG',
    player: 'E. Forward',
    detail: 'Goal'
  }],
  bookings: [],
  substitutions: []
};

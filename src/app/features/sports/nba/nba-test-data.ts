import { BoxScore, NbaGame, NbaStanding, NbaTradeGroup, NbaTradePage, Scoreboard } from './nba.types';

export const scheduledGame: NbaGame = {
  id: '0022500001',
  source: 'nba',
  status: 'scheduled',
  statusText: '7:30 pm ET',
  period: 0,
  clock: '',
  startTimeUtc: '2026-06-13T23:30:00Z',
  label: 'NBA Finals',
  seriesText: 'Series tied 1-1',
  awayTeam: {
    id: 1610612752,
    city: 'New York',
    name: 'Knicks',
    code: 'NYK',
    wins: 50,
    losses: 32,
    score: 0,
    color: '#f58426',
    periods: []
  },
  homeTeam: {
    id: 1610612747,
    city: 'Los Angeles',
    name: 'Lakers',
    code: 'LAL',
    wins: 48,
    losses: 34,
    score: 0,
    color: '#552583',
    periods: []
  }
};

export const finalGame: NbaGame = {
  ...scheduledGame,
  id: '0022500002',
  status: 'final',
  statusText: 'Final',
  period: 4,
  awayTeam: { ...scheduledGame.awayTeam, score: 108, periods: [25, 29, 24, 30] },
  homeTeam: { ...scheduledGame.homeTeam, score: 104, periods: [24, 25, 28, 27] }
};

export const scoreboardFixture: Scoreboard = {
  gameDate: '2026-06-13',
  games: [scheduledGame, finalGame]
};

export const standingsFixture: NbaStanding[] = [{
  teamId: scheduledGame.awayTeam.id,
  teamCode: 'NYK',
  conference: 'East',
  seed: 3,
  wins: 42,
  losses: 28,
  winPercentage: .6,
  gamesBehind: 4
}, {
  teamId: scheduledGame.homeTeam.id,
  teamCode: 'LAL',
  conference: 'West',
  seed: 5,
  wins: 40,
  losses: 30,
  winPercentage: .571,
  gamesBehind: 7
}];

export const tradePageFixture: NbaTradePage = {
  season: '2025-26',
  page: 1,
  pageCount: 1,
  trades: [{
    id: '2026-02-05:13:test',
    date: '2026-02-05',
    season: '2025-26',
    teamId: 13,
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    teamLogoUrl: 'https://example.com/lal.png',
    description: 'Acquired G Example Player from Boston in exchange for a first-round pick.'
  }]
};

export const tradeGroupFixture: NbaTradeGroup = {
  id: 'trade:test', date: '2026-02-05', season: '2025-26', combined: true,
  playerNames: ['Example Player', 'Other Player'],
  sourceNotes: ['Los Angeles acquired Example Player from Boston.', 'Boston acquired Other Player from Los Angeles.'],
  teams: [{
    id: 13, code: 'LAL', name: 'Los Angeles Lakers', logoUrl: 'lal.png',
    received: [{ id: 'player:example', kind: 'player', label: 'Example Player', playerName: 'Example Player', position: 'G' }],
    sent: [{ id: 'player:other', kind: 'player', label: 'Other Player', playerName: 'Other Player', position: 'F' }],
    sourceNotes: ['Los Angeles acquired Example Player from Boston.']
  }, {
    id: 2, code: 'BOS', name: 'Boston Celtics', logoUrl: 'bos.png',
    received: [{ id: 'player:other', kind: 'player', label: 'Other Player', playerName: 'Other Player', position: 'F' }],
    sent: [{ id: 'player:example', kind: 'player', label: 'Example Player', playerName: 'Example Player', position: 'G' }],
    sourceNotes: ['Boston acquired Other Player from Los Angeles.']
  }]
};

export const boxScoreFixture: BoxScore = {
  gameId: finalGame.id,
  statusText: 'Final',
  arena: 'Example Arena',
  awayTeam: {
    id: finalGame.awayTeam.id,
    city: finalGame.awayTeam.city,
    name: finalGame.awayTeam.name,
    code: finalGame.awayTeam.code,
    score: 108,
    color: finalGame.awayTeam.color,
    players: [{
      id: 1,
      name: 'Example Player',
      shortName: 'E. Player',
      jersey: '1',
      position: 'G',
      starter: true,
      minutes: '34:10',
      points: 28,
      rebounds: 6,
      assists: 9,
      steals: 2,
      blocks: 0,
      turnovers: 3,
      plusMinus: 8,
      fieldGoals: '10-18',
      threePointers: '4-8',
      freeThrows: '4-4'
    }],
    totals: {
      points: 108,
      rebounds: 44,
      assists: 27,
      fieldGoals: '40-82',
      threePointers: '14-35',
      freeThrows: '14-17'
    }
  },
  homeTeam: {
    id: finalGame.homeTeam.id,
    city: finalGame.homeTeam.city,
    name: finalGame.homeTeam.name,
    code: finalGame.homeTeam.code,
    score: 104,
    color: finalGame.homeTeam.color,
    players: [],
    totals: {
      points: 104,
      rebounds: 41,
      assists: 24,
      fieldGoals: '39-84',
      threePointers: '12-34',
      freeThrows: '14-19'
    }
  }
};

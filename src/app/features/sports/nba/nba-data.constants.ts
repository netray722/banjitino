export const TEAM_COLORS: Record<string, string> = {
  ATL: '#e03a3e', BKN: '#111111', BOS: '#007a33', CHA: '#1d1160', CHI: '#ce1141',
  CLE: '#860038', DAL: '#00538c', DEN: '#0e2240', DET: '#c8102e', GSW: '#1d428a',
  HOU: '#ce1141', IND: '#002d62', LAC: '#c8102e', LAL: '#552583', MEM: '#5d76a9',
  MIA: '#98002e', MIL: '#00471b', MIN: '#0c2340', NOP: '#0c2340', NYK: '#f58426',
  OKC: '#007ac1', ORL: '#0077c0', PHI: '#006bb6', PHX: '#1d1160', POR: '#e03a3e',
  SAC: '#5a2d81', SAS: '#5f5f5f', TOR: '#ce1141', UTA: '#006435', WAS: '#002b5c'
};

export const ESPN_CODE_OVERRIDES: Record<string, string> = {
  GS: 'GSW', NY: 'NYK', NO: 'NOP', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS'
};

export const NBA_TEAM_OPTIONS = [
  { code: 'ATL', name: 'Atlanta Hawks' }, { code: 'BOS', name: 'Boston Celtics' },
  { code: 'BKN', name: 'Brooklyn Nets' }, { code: 'CHA', name: 'Charlotte Hornets' },
  { code: 'CHI', name: 'Chicago Bulls' }, { code: 'CLE', name: 'Cleveland Cavaliers' },
  { code: 'DAL', name: 'Dallas Mavericks' }, { code: 'DEN', name: 'Denver Nuggets' },
  { code: 'DET', name: 'Detroit Pistons' }, { code: 'GSW', name: 'Golden State Warriors' },
  { code: 'HOU', name: 'Houston Rockets' }, { code: 'IND', name: 'Indiana Pacers' },
  { code: 'LAC', name: 'LA Clippers' }, { code: 'LAL', name: 'Los Angeles Lakers' },
  { code: 'MEM', name: 'Memphis Grizzlies' }, { code: 'MIA', name: 'Miami Heat' },
  { code: 'MIL', name: 'Milwaukee Bucks' }, { code: 'MIN', name: 'Minnesota Timberwolves' },
  { code: 'NOP', name: 'New Orleans Pelicans' }, { code: 'NYK', name: 'New York Knicks' },
  { code: 'OKC', name: 'Oklahoma City Thunder' }, { code: 'ORL', name: 'Orlando Magic' },
  { code: 'PHI', name: 'Philadelphia 76ers' }, { code: 'PHX', name: 'Phoenix Suns' },
  { code: 'POR', name: 'Portland Trail Blazers' }, { code: 'SAC', name: 'Sacramento Kings' },
  { code: 'SAS', name: 'San Antonio Spurs' }, { code: 'TOR', name: 'Toronto Raptors' },
  { code: 'UTA', name: 'Utah Jazz' }, { code: 'WAS', name: 'Washington Wizards' }
] as const;

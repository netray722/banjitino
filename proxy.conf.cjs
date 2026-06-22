function dateWindow(dateKey = new Date().toISOString().slice(0, 10)) {
  return {
    from: addDays(dateKey, -1),
    to: addDays(dateKey, 2)
  };
}

function fifaCalendarPath(request) {
  const dateKey = selectedDateKey(request);
  return `/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateKey.replace(/-/g, '')}`;
}

function selectedDateKey(request) {
  const url = new URL(request.url, 'http://localhost');
  const date = url.searchParams.get('date');
  return /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : undefined;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

module.exports = {
  '/api/nba/scoreboard': {
    target: 'https://cdn.nba.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/nba/scoreboard': '/static/json/liveData/scoreboard/todaysScoreboard_00.json'
    },
    headers: {
      Referer: 'https://www.nba.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  },
  '/api/nba/boxscore': {
    target: 'https://cdn.nba.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/nba/boxscore/(.*)': '/static/json/liveData/boxscore/boxscore_$1.json'
    },
    headers: {
      Referer: 'https://www.nba.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  },
  '/api/nba/logo': {
    target: 'https://cdn.nba.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/nba/logo/(.*)': '/logos/nba/$1/primary/L/logo.svg'
    },
    headers: {
      Referer: 'https://www.nba.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  },
  '/api/nba/standings': {
    target: 'https://site.api.espn.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/api/nba/standings': '/apis/v2/sports/basketball/nba/standings' },
    headers: { Referer: 'https://www.espn.com/', 'User-Agent': 'Mozilla/5.0' }
  },
  '/api/nba/trades': {
    target: 'https://site.api.espn.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/nba/trades\\?season=[^&]+&': '/apis/site/v2/sports/basketball/nba/transactions?',
      '^/api/nba/trades': '/apis/site/v2/sports/basketball/nba/transactions'
    },
    headers: { Referer: 'https://www.espn.com/', 'User-Agent': 'Mozilla/5.0' }
  },
  '/api/nba/player-search': {
    target: 'https://site.web.api.espn.com', secure: true, changeOrigin: true,
    pathRewrite: { '^/api/nba/player-search': '/apis/search/v2' },
    headers: { Referer: 'https://www.espn.com/', 'User-Agent': 'Mozilla/5.0' }
  },
  '/api/nba/player-stats': {
    target: 'https://site.web.api.espn.com', secure: true, changeOrigin: true,
    pathRewrite: { '^/api/nba/player-stats/([^?]+)': '/apis/common/v3/sports/basketball/nba/athletes/$1/stats' },
    headers: { Referer: 'https://www.espn.com/', 'User-Agent': 'Mozilla/5.0' }
  },
  '/api/fifa/scoreboard': {
    target: 'https://site.api.espn.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: (_path, request) => fifaCalendarPath(request),
    headers: {
      Referer: 'https://www.espn.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  },
  '/api/fifa/standings': {
    target: 'https://site.api.espn.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/fifa/standings': '/apis/v2/sports/soccer/fifa.world/standings'
    },
    headers: {
      Referer: 'https://www.espn.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  },
  '/api/fifa/match': {
    target: 'https://api.fifa.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/fifa/match/(.*)': '/api/v3/live/football/$1?language=en'
    },
    headers: {
      Referer: 'https://www.fifa.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  },
  '/api/fifa/flag': {
    target: 'https://api.fifa.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/fifa/flag/(.*)': '/api/v3/picture/flags-sq-4/$1'
    },
    headers: {
      Referer: 'https://www.fifa.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  }
};

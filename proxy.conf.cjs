function dateWindow(dateKey = new Date().toISOString().slice(0, 10)) {
  return {
    from: addDays(dateKey, -1),
    to: addDays(dateKey, 2)
  };
}

function fifaCalendarTarget() {
  const { from, to } = dateWindow();
  return `https://api.fifa.com/api/v3/calendar/matches?language=en&count=50&idCompetition=17&from=${from}&to=${to}`;
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
  '/api/fifa/scoreboard': {
    target: fifaCalendarTarget(),
    secure: true,
    changeOrigin: true,
    ignorePath: true,
    headers: {
      Referer: 'https://www.fifa.com/',
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

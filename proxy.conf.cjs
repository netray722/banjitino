const FIFA_TIME_ZONE = 'America/New_York';

function fifaDateWindow(now = new Date()) {
  const from = localDateKey(now);
  const next = localDateKey(addDaysAtNoon(from, 1));

  return {
    from,
    to: next
  };
}

function fifaCalendarTarget() {
  const { from, to } = fifaDateWindow();
  return `https://api.fifa.com/api/v3/calendar/matches?language=en&count=50&idCompetition=17&from=${from}&to=${to}`;
}

function localDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FIFA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDaysAtNoon(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 16));
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

# banjitino.com NBA Scoreboard

A mobile-first Angular scoreboard for today's NBA games, live scores, schedules, and expandable player box scores.

## Features

- Scheduled, live, and final game states
- Automatic scoreboard refresh every 30 seconds
- Live expanded box-score refresh every 20 seconds
- Responsive game cards and horizontally scrollable stat tables
- Cloudflare Pages Functions proxy for NBA data and team logos
- Angular Vitest coverage thresholds

## Local development

```sh
npm install
npm start
```

Open `http://localhost:4200`. The Angular development proxy forwards NBA API requests.

## Verification

```sh
npm run build
npm test
npm run test:coverage
```

## Cloudflare Pages

Build command:

```sh
npm run build
```

Build output directory:

```text
dist/cloudflare
```

The `functions/` directory provides the same-origin scoreboard, box-score, and team-logo endpoints.

# sidequests.

My personal corner for scores, projects, and curiosities. The site currently focuses on an NBA timeline and is structured to grow with more interest-based sections over time.

## Current features

- NBA game-day waterfall timeline
- Landing on today with quick date-picker and Today shortcuts
- Lazy loading for earlier and upcoming game days
- Empty dates omitted automatically
- Live score refresh for the visible date
- Expandable NBA box scores
- Responsive light and dark themes
- Accessible Sports navigation dropdown

## Data sources

- ESPN public standings for NBA data
- NBA live feeds for current NBA scores and box scores where available

Requests are cached per date in the client and additional dates are fetched only when the user navigates or approaches a timeline edge.

## Technology

- Angular 21
- TypeScript and RxJS
- Vitest
- Cloudflare Pages and Pages Functions

## Project structure

The Angular application uses feature-first organization so new interests can be added without turning the root application folder into a collection of unrelated files:

```text
src/app/
|-- core/
|   `-- layout/
|       `-- site-header/
|-- features/
|   `-- sports/
|       |-- nba/
|       |   |-- components/
|       |   |-- data-access/
|       |   |-- models/
|       |   |-- testing/
|       |   `-- utils/
|-- app.component.*
`-- app.routes.ts
```

Future interests should be added as sibling feature areas under `src/app/features/`. Cloudflare function directories remain route-oriented because their folder names define public API paths.

## Local development

```sh
npm install
npm start
```

Open:

- `http://localhost:4200/nba`

The Angular development server uses `proxy.conf.cjs` for same-origin API routes where needed.

## Verification

```sh
npm run build
npm test
npm run test:coverage
```

The production build is written to `dist/cloudflare`.

## Cloudflare Pages

Build command:

```sh
npm run build
```

Build output directory:

```text
dist/cloudflare
```

The `functions/` directory contains the Cloudflare Pages Functions used for proxied scoreboards, box scores, standings, and team logos.

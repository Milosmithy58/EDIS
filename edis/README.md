# EDIS – Emergency Disaster Incident System

A monorepo MVP that combines geocoding, weather, crime, and news data into a single responsive dashboard. The project is designed for local development on Node 20 with Vite + React on the frontend and an Express proxy on the backend. The architecture keeps providers modular so we can later migrate to Wix (Velo) with minimal friction.

## Getting started

### Prerequisites

- Node.js 20+
- npm 9+

### Installation

```bash
npm install
```

This installs dependencies for both workspaces (`apps/web` and `apps/server`).

### Environment variables

Copy the example file and fill in any API keys you have available:

```bash
cp .env.example .env
```

Keys are optional unless you enable the related adapters. The defaults (Open-Meteo, UK Police, GNews) only require a `GNEWS_API_KEY`.

| Variable | Description |
| --- | --- |
| `GNEWS_API_KEY` | Required for the default news provider. |
| `NEWSAPI_API_KEY` | Used when enabling the optional NewsAPI provider. |
| `OPENWEATHER_API_KEY` | Used when enabling the optional OpenWeather provider. |
| `MAPBOX_TOKEN` | Optional geocoding provider. |
| `FBI_CRIME_API_KEY` | Required for US crime stats. |
| `DEFAULT_COUNTRY` | Fallback for ambiguous searches (defaults to `UK`). |
| `ENABLE_OPENWEATHER` | Set to `true` to switch the weather provider. |
| `ENABLE_NEWSAPI` | Set to `true` to switch the news provider. |

> ⚠️ Never commit your `.env` file. Secrets stay local or move into secret managers.

### Running the app

Start the web client and API proxy together:

```bash
npm run dev:all
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

You can run them individually if needed:

```bash
npm run dev:web
npm run dev:server
```

### Testing and linting

```bash
npm run test     # Runs Vitest suites for both workspaces
npm run lint     # ESLint across frontend and backend
npm run format   # Prettier on the full repo
```

### Dependency funding notices

Running `npm fund` prints a long list of third-party packages along with the
maintainers' sponsorship URLs. This is an informational report from npm—it does
not indicate an error or a missing dependency. You can safely ignore the
output, or follow the provided links if you want to sponsor the upstream
projects.

## Architecture overview

```
edis/
├── apps/
│   ├── web/        # Vite + React app with TailwindCSS and React Query
│   └── server/     # Express API proxy with provider adapters
├── package.json    # Workspace root
├── tsconfig.base.json
├── .eslintrc.cjs
└── README.md
```

### Geo workflow

1. Search or geolocation hits `/api/geocode`.
2. Geocode resolves to a `GeoContext` (country, admin levels, lat/lon, bbox).
3. Frontend fans out to `/api/weather`, `/api/crime`, and `/api/news` using the context.

Each provider adapter is isolated to `apps/server/src/adapters/**` so we can swap APIs quickly.

### Default providers

| Domain | Default adapter | Optional alternative |
| --- | --- | --- |
| Weather | Open-Meteo | OpenWeather (requires `ENABLE_OPENWEATHER=true` + key) |
| Crime | UK Police (by lat/lon) | FBI Crime Data (requires state + key) |
| News | GNews | NewsAPI (requires `ENABLE_NEWSAPI=true` + key) |

The server auto-detects the crime provider based on `country` (UK vs US). If the provider can’t answer the request, the UI displays a friendly message with retry guidance.

### Client UX notes

- Location search uses debounced geocoding results with optional “Use my location” fallback.
- React Query powers all network calls with caching and retries.
- Responsive cards stack on mobile and line up as a three-column grid on desktop.
- Persistent state: the last successful `GeoContext` is restored from `localStorage`.
- WCAG AA-friendly colors, focus outlines, and keyboard accessible lists/buttons.

## Adapter customization

Adapters share normalized DTOs in `apps/server/src/core/types.ts`. To add a new provider:

1. Implement an adapter in the relevant directory.
2. Normalize to the DTO shape (see `core/normalize.ts`).
3. Wire it into the associated route with a feature flag or config toggle.

Example: swapping the weather provider

```ts
// apps/server/src/routes/weather.ts
const weather = flags.openWeather
  ? await openWeather.getWeather(lat, lon)
  : await openMeteo.getWeather(lat, lon);
```

Toggle by setting `ENABLE_OPENWEATHER=true` and providing an `OPENWEATHER_API_KEY` in `.env`.

## Wix (Velo) migration guide

The project intentionally mirrors how Wix backend web modules and frontend pages work.

### Backend modules

Create backend web modules under `backend/edis/*.jsw`:

```js
// backend/edis/geocode.jsw
import { geocode } from 'backend/edis/providers/geocode';

export async function geocode(query, country) {
  return geocode(query, country);
}
```

Port each Express route:

| Express route | Wix module |
| --- | --- |
| `/api/geocode` | `backend/edis/geocode.jsw` → `export async function geocode(query, country)` |
| `/api/weather` | `backend/edis/weather.jsw` → `export async function weather(lat, lon)` |
| `/api/crime` | `backend/edis/crime.jsw` → `export async function crime(params)` |
| `/api/news` | `backend/edis/news.jsw` → `export async function news(params)` |

Move adapter code into `backend/edis/providers/*`. Replace `fetch` calls with `wix-fetch` and move secrets into the Wix Secrets Manager:

```js
// backend/edis/providers/news/gnews.jsw
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

export async function getNews(query, country) {
  const token = await getSecret('GNEWS_API_KEY');
  const response = await fetch(`https://gnews.io/api/v4/search?q=${query}&token=${token}&country=${country}`);
  return response.json();
}
```

### Frontend page

On a Wix page, enable Dev Mode and call backend functions:

```js
// public/pages/edis.js
import { geocode, weather, crime, news } from 'backend/edis';

$w.onReady(async function () {
  const geo = await geocode('London', 'UK');
  const weatherData = await weather(geo.lat, geo.lon);
  const crimeData = await crime({ country: geo.countryCode, lat: geo.lat, lon: geo.lon });
  const newsData = await news({ query: `${geo.city}, ${geo.admin1}`, country: geo.countryCode });

  // Bind to page elements (repeaters, text, charts)
  $w('#weatherCard').data = weatherData;
  // ...
});
```

### Secrets & configuration

- Store API keys in Wix Secrets Manager.
- Read them with `wix-secrets-backend` inside backend modules.
- Use Wix collections or memory for caching if needed.

### Crime provider note

- UK crime data uses the same `data.police.uk` endpoint with `lat/lon` parameters.
- US crime data requires a state abbreviation and the FBI API key.
- Ensure your Wix UI sets the correct `country` so the backend knows which adapter to call.

## Smoke test locations

Try these queries to validate the stack:

- “London, UK” (UK weather + UK crime + GNews headlines)
- “New York, US” (US weather + FBI crime when configured + news)

## Contributing

- Run `npm run lint` before committing.
- Keep adapters documented with inline comments for future maintainers.
- PRs should include screenshots for visual tweaks and link to any API docs referenced.

Enjoy exploring real-time situational awareness with EDIS!

# EDIS – Emergency Disaster Incident System

A monorepo MVP that combines geocoding, weather, crime, and news data into a single responsive dashboard. The project is designed for local development on Node 20 with Vite + React on the frontend and an Express proxy on the backend. The architecture keeps providers modular so we can later migrate to Wix (Velo) with minimal friction.

## Getting started

### Prerequisites

- Node.js 20+
- npm 9+

#### Installing Node.js, npm, and Homebrew

If your machine does not already have Node.js/npm, install them before running the steps below. Node.js bundles npm by default.

**macOS**

1. Download and run the **LTS** macOS installer from [nodejs.org](https://nodejs.org/en/download).
2. Or install [Homebrew](https://brew.sh/) (if not installed) using:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Once Homebrew is available, install Node.js (with npm):
   ```bash
   brew install node@20
   ```
4. Verify:
   ```bash
   node -v
   npm -v
   ```

**Windows**

1. Install the **LTS** Windows installer from [nodejs.org](https://nodejs.org/en/download) and follow the setup wizard.
2. Optionally use winget in an elevated PowerShell prompt:
   ```powershell
   winget install --id OpenJS.NodeJS.LTS -e
   ```
3. Confirm the install:
   ```powershell
   node -v
   npm -v
   ```

**Linux (Debian/Ubuntu)**

1. Add the NodeSource repo and install Node.js (includes npm):
   ```bash
   sudo apt-get update && sudo apt-get install -y curl
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. Verify:
   ```bash
   node -v
   npm -v
   ```
3. Optional: install Homebrew on Linux for an alternate workflow:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.profile
   eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
   ```

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

Keys are optional unless you enable the related adapters. Because Webz.io is the default news provider, supply a `WEBZIO_TOKEN` or override `NEWS_PROVIDER` to `gnews`/`newsapi` when you don't have credentials yet.

#### Updating `.env` from the command line

When you already have concrete credential values, you can create or update the server workspace `.env` in one shot. From the repository root run:

```bash
cd edis/apps/server
cat <<'EOF' >> .env
ADMIN_TOKEN="your-admin-token"
SECRETBOX_KEY="your-base64-secretbox-key"
WEBZIO_TOKEN="your-webzio-token"
VISUALCROSSING_API_KEY="your-visualcrossing-api-key"
EOF
```

The `>>` operator appends to the existing file (creating it if needed). Adjust the placeholder values with your real keys. If you prefer to overwrite the file instead of appending, switch `>>` to `>`. After editing, restart the backend so the new environment variables are loaded.

| Variable | Description |
| --- | --- |
| `WEBZIO_TOKEN` | Required when `NEWS_PROVIDER=webzio` (Webz.io News API Lite). |
| `NEWS_PROVIDER` | Choose the active news adapter (`webzio`, `gnews`, `newsapi`). |
| `GNEWS_API_KEY` | Required when `NEWS_PROVIDER=gnews`. |
| `NEWSAPI_API_KEY` | Used when enabling the optional NewsAPI provider. |
| `OPENWEATHER_API_KEY` | Used when enabling the optional OpenWeather provider. |
| `VISUALCROSSING_API_KEY` | Required for the Visual Crossing weather adapter. |
| `MAPBOX_TOKEN` | Optional geocoding provider. |
| `FBI_CRIME_API_KEY` | Optional fallback for US crime stats (LessCrime data is default). |
| `LESSCRIME_DATASET_URL` | Override the LessCrime CSV endpoint (defaults to the hosted package URL). |
| `DEFAULT_COUNTRY` | Fallback for ambiguous searches (defaults to `UK`). |
| `ENABLE_OPENWEATHER` | Legacy flag for the OpenWeather adapter (prefer `WEATHER_PROVIDER`). |
| `ENABLE_NEWSAPI` | Set to `true` to switch the news provider. |
| `WEATHER_PROVIDER` | Choose `visualcrossing` (default), `openmeteo`, or `openweather`. |

> ⚠️ Never commit your `.env` file. Secrets stay local or move into secret managers.

## Managing API Keys Securely (Dev & Wix)

### Local development

- Populate `.env` with a strong `ADMIN_TOKEN`, a 32-byte base64 `SECRETBOX_KEY`, and the desired `KEYS_STORE_PATH` (defaults to `./secrets/keys.enc`).
- Start the stack with `npm run dev:all`, then visit `http://localhost:5173/admin-login` and enter the admin token. The in-memory session unlocks the **Admin → API Keys** screen.
- Use the write-only form to rotate provider credentials. Keys are encrypted with AES-256-GCM and stored at `KEYS_STORE_PATH`; the raw secrets never appear in responses or logs.
- Existing adapters (Visual Crossing, NewsAPI, GNews) pull credentials from the secure store at runtime. If the store is empty on first run, any values from `.env` seed the encrypted file.
- After saving a key you can click **Test connection** to invoke `POST /api/admin/test`.
  The endpoint performs a lightweight provider call and responds with
  `{ ok, details: { status, providerLatencyMs } }`, helping you confirm credentials
  without exposing the secret value.

### Wix (Velo)

- Create `backend/edis/keys.jsw` with server-side methods to `setKey` and `testKey`, validating the same admin token before updating Wix Secrets Manager entries (`VC_KEY`, `NEWSAPI_KEY`, `GNEWS_KEY`).
- Call those backend functions from the Wix admin UI; never surface stored secrets in the browser.
- Provider fetchers on Wix should resolve credentials from the secrets manager at call time so live traffic never depends on client-supplied keys.

### Webz.io setup

- Endpoint: `https://api.webz.io/newsApiLite` with `token`, `q`, optional `ts`, and pagination via the `'next'` URL.
- Quotas: Free tier allows **1,000 calls/month** with up to **10 results per request**.
- Pagination: the response includes a `'next'` cursor; reuse it verbatim for the next page.
- Time windowing: pass a Unix millisecond `ts` to pivot within the last 30 days.
- The server caches identical `{q, ts}` lookups for 10 minutes and stops hitting the API when the monthly budget exceeds 90%.
- UI labels in `apps/web/src/lib/newsFilters.ts` feed directly into the boolean query, so update both client and server maps when you add filters.

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

### Nearby Critical Services (OSM)
• Shows three nearest **Airports**, **Hospitals**, **Police** for searched address.<br />
• Data source: OpenStreetMap (Nominatim + Overpass).<br />
• Each result includes a **Directions** button (Google Maps route).<br />

Server env vars:<br />
PLACES_SEARCH_RADIUS_KM=50<br />
OSM_NOMINATIM_URL=https://nominatim.openstreetmap.org/search<br />
OSM_OVERPASS_URL=https://overpass-api.de/api/interpreter

### Default providers

| Domain | Default adapter | Optional alternative |
| --- | --- | --- |
| Weather | Visual Crossing Timeline API | Open-Meteo (`WEATHER_PROVIDER=openmeteo`) or OpenWeather (`WEATHER_PROVIDER=openweather` + key) |
| Crime | UK Police (UK) / LessCrime Crime Data (US) | FBI Crime Data fallback (requires state + key) |
| News | Webz.io News API Lite | GNews (`NEWS_PROVIDER=gnews`) or NewsAPI (requires `ENABLE_NEWSAPI=true` + key) |

The server auto-detects the crime provider based on `country` (UK vs US). If the provider can’t answer the request, the UI displays a friendly message with retry guidance.

### Weather provider (Visual Crossing Timeline API)

- Sign up for an API key at [visualcrossing.com](https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api-old/)
  and place it in `.env` as `VISUALCROSSING_API_KEY`.
- Requests hit the Timeline endpoint, e.g.
  `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/London,UK?unitGroup=metric&include=current,hours,days,alerts&lang=en&key=YOUR_KEY`.
- The adapter normalizes current, hourly (24 hours), and daily (7 days) forecasts into our shared `WeatherDTO`.
- Configure a different provider by setting `WEATHER_PROVIDER` to `openmeteo` or `openweather`.
- When no Visual Crossing key is stored (secure store or `.env`), the route automatically
  falls back to Open-Meteo and tags the JSON payload with `meta.source = "openmeteo"`
  so the UI can display the active data source.
- The weather card renders a small “Data source” label sourced from the API response so
  operators can confirm which upstream service is in use.

### Client UX notes

- Location search uses debounced geocoding results with optional “Use my location” fallback.
- React Query powers all network calls with caching and retries.
- Responsive cards stack on mobile and line up as a three-column grid on desktop.
- Persistent state: the last successful `GeoContext` is restored from `localStorage`.
- WCAG AA-friendly colors, focus outlines, and keyboard accessible lists/buttons.

## Filtering news by safety topics

The news card now supports topic filters so operators can zero in on
high-impact incidents (crime, infrastructure, weather, travel, health).
With Webz.io the server builds a boolean query that boosts the selected
city/region in `title:` and `text:` clauses, groups each filter label
inside parentheses, and appends quality boosters (`site_type:news`
and `is_first:true`).

### Single source of truth

- Frontend keywords live in [`apps/web/src/lib/newsFilters.ts`](apps/web/src/lib/newsFilters.ts).
- The Express proxy mirrors the same map in
  [`apps/server/src/adapters/news/filterKeywords.ts`](apps/server/src/adapters/news/filterKeywords.ts).
- Update **both** files when you add or rename labels so the UI, cache keys, and
  provider queries stay in sync.
- Quick-apply presets live alongside the keywords in
  [`apps/web/src/lib/newsFilters.ts`](apps/web/src/lib/newsFilters.ts) as the exported
  `PRESETS` map. Updating those arrays changes the dashboard chips instantly; the
  server will ignore any unknown labels if you remove or rename a preset entry.

Each label maps to an array of synonyms that are OR-joined inside parentheses.
Queries look like:

```
London, UK (flood OR flooding OR "flash flood" OR "river levels" OR deluge) OR (protest OR demonstration OR march OR strike OR picket)
```

### Calling `/api/news`

The server still supports `GET /api/news`, but `POST /api/news` keeps long filter
lists out of the query string. Submit the location query, optional ISO country code,
and filters in the JSON body:

```bash
curl -X POST http://localhost:4000/api/news \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "London, UK",
    "country": "GB",
    "filters": ["Flooding", "Civil Unrest / Protests"],
    "ts": 1704067200000
  }'
```

The response matches the GET payload shape. Pagination continues to use the
`next` cursor with `GET /api/news?next=...`. Unknown or outdated filter labels are
safely ignored by the server so you can phase presets in or out without errors.

### Data flow

1. Users toggle checkboxes in the `FilterPanel` component. Selections persist to
   `localStorage` (`edis.news.filters.v1`).
2. The news React Query uses `serializeFilters()` to keep cache keys stable and
   sends the active labels, country code, and location text to `/api/news`.
3. The Express route sanitizes the labels, builds Webz.io OR groups, and calls
   `fetchNewsWebz()` which handles caching, rate-limit retries, and pagination.
4. React renders removable pills above the news list, shows any provider
   warnings, and exposes “Load more (10)” and “Older (30d)” controls to stay
   within the free-tier budget.

### Porting to Wix (Velo)

- Create `backend/edis/news.jsw` that accepts `{ base, filters, country, ts, next }`.
- Copy the `FILTER_KEYWORDS` map and boolean query helpers used on the server so Wix mirrors the same Webz.io logic.
- Fetch provider data with:

  ```js
  import { fetch } from 'wix-fetch';
  import { getSecret } from 'wix-secrets-backend';

  export async function news({ base, filters = [], country, ts, next }) {
    const token = await getSecret('WEBZIO_TOKEN');

    if (next) {
      const url = new URL(next);
      url.searchParams.set('token', token);
      const response = await fetch(url.toString());
      return response.json();
    }

    const filterGroups = buildFilterClauses(filters);
    const query = composeWebzQuery(base, filterGroups, country);
    const search = new URLSearchParams({ token, q: query, size: '10' });
    if (typeof ts === 'number') {
      search.set('ts', String(ts));
    }

    const response = await fetch(`https://api.webz.io/newsApiLite?${search.toString()}`);
    return response.json();
  }
  ```

- Store tokens in Wix Secrets Manager and reuse the React-side
  serialization helpers to keep behaviour aligned.

## Adapter customization

Adapters share normalized DTOs in `apps/server/src/core/types.ts`. To add a new provider:

1. Implement an adapter in the relevant directory.
2. Normalize to the DTO shape (see `core/normalize.ts`).
3. Wire it into the associated route with a feature flag or config toggle.

Example: swapping the weather provider

```ts
// apps/server/src/routes/weather.ts
const provider = flags.weatherProvider;

if (provider === 'visualcrossing') {
  return getWeatherVC(geoContext, units);
}

if (provider === 'openweather') {
  return openWeather.getWeather(lat, lon);
}

return openMeteo.getWeather(lat, lon);
```

Select the adapter via `WEATHER_PROVIDER` in `.env` and supply the matching API key (e.g. `VISUALCROSSING_API_KEY`).

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
- Keep `VISUALCROSSING_API_KEY` in Secrets Manager and load it within `backend/edis/weather.jsw` before calling the Timeline API.
- Replace any `node-fetch` usage with `wix-fetch` when porting adapters (Visual Crossing included).
- Use Wix collections or memory for caching if needed.

### Crime provider note

- UK crime data uses the same `data.police.uk` endpoint with `lat/lon` parameters.
- US crime data uses the LessCrime dataset by default and still requires a state abbreviation. Provide an FBI API key to enable the fallback adapter if the dataset is unreachable.
- Ensure your Wix UI sets the correct `country` so the backend knows which adapter to call.

## Smoke test locations

Try these queries to validate the stack:

- “London, UK” (UK weather + UK crime + GNews headlines)
- “New York, US” (US weather + LessCrime crime stats (FBI fallback when configured) + news)

## Trip planner

- The web app now includes a `/trip-planner` page for building multi-stop journeys with Mapbox visualization.
- Provide a `VITE_MAPBOX_TOKEN` in your environment (or configure the backend token endpoint) to render maps locally.

## Contributing

- Run `npm run lint` before committing.
- Keep adapters documented with inline comments for future maintainers.
- PRs should include screenshots for visual tweaks and link to any API docs referenced.

Enjoy exploring real-time situational awareness with EDIS!

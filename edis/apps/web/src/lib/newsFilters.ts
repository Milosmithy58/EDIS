// Centralized configuration for news filters so both the UI and request logic
// can stay in sync. Update the label strings or keyword arrays here when adding
// or removing safety topics.
export const FILTER_KEYWORDS = {
  'Violent Crime': [
    'assault',
    'stabbing',
    'stabbings',
    'shooting',
    'gunfire',
    'homicide',
    'GBH',
    'grievous bodily harm',
    'knife crime'
  ],
  'Property Crime / Burglary': ['burglary', 'break-in', 'theft', 'robbery', 'vandalism'],
  'Fraud & Scams': ['fraud', 'scam', 'phishing', 'identity theft'],
  Cybercrime: ['ransomware', 'data breach', 'hacked', 'cyber attack', 'malware', 'DDoS'],
  'Drugs / Narcotics': ['drug trafficking', 'narcotics', 'overdose', 'opioid'],
  'Public Disorder': ['disturbance', 'riot', 'unrest', 'clashes'],
  'Arson / Fire Incidents': ['arson', 'fire broke out', 'warehouse fire', 'blaze'],
  'Terrorism / Explosives': ['terror', 'IED', 'bomb', 'explosive', 'extremist'],
  'Active Shooter / Armed Incident': ['active shooter', 'armed suspect', 'shots fired'],
  'Civil Unrest / Protests': ['protest', 'demonstration', 'march', 'strike', 'picket'],
  'Infrastructure Attack': ['substation', 'grid attack', 'telecom outage', 'pipeline sabotage', 'rail sabotage'],
  'Police / Military Activity': ['lockdown', 'cordon', 'raid', 'shelter in place'],
  'Storm / High Winds': ['storm', 'gale', 'high winds', 'gusts'],
  Flooding: ['flood', 'flooding', 'flash flood', 'river levels', 'deluge'],
  'Snow / Ice / Blizzard': ['snow', 'blizzard', 'ice', 'icy roads'],
  'Extreme Heat / Cold': ['heatwave', 'record heat', 'cold snap', 'wind chill'],
  'Lightning / Thunderstorms': ['thunderstorm', 'lightning', 'electrical storm'],
  'Earthquake / Tremor': ['earthquake', 'tremor', 'seismic'],
  'Wildfire / Smoke': ['wildfire', 'bushfire', 'forest fire', 'smoke', 'air quality'],
  'Road Accidents / Closures': ['collision', 'pile-up', 'road closed', 'lane closure', 'motorway shut'],
  'Rail / Tube Disruption': ['signal failure', 'points failure', 'service suspended', 'rail disruption', 'tube delays'],
  'Airport / Flight Delays': ['flight canceled', 'flight delayed', 'airport closed', 'ground stop'],
  'Port / Maritime Issues': ['ferry canceled', 'port strike', 'maritime disruption'],
  'Public Transport Strike / Protest': ['strike action', 'industrial action', 'walkout'],
  'Power / Communication Outages': ['power outage', 'blackout', 'grid failure', 'internet outage'],
  'Pandemic / Disease Outbreak': ['outbreak', 'case surge', 'pandemic', 'epidemic'],
  'Emergency Services Overload': ['ambulance delays', 'hospital capacity', 'A&E wait times'],
  'Contamination / Chemical Spill': ['chemical spill', 'contamination', 'hazmat', 'toxic leak']
} as const satisfies Record<string, readonly string[]>;

export type NewsFilterLabel = keyof typeof FILTER_KEYWORDS;

// Matches the server-side boosters so that both layers document the ranking
// knobs that influence Webz.io's search quality. Update both files together
// when experimenting with Webz query modifiers.
export const QUALITY_BOOSTERS = ['site_type:news', 'is_first:true', 'site_category:top_news'] as const;

export const FILTER_GROUPS: Record<string, NewsFilterLabel[]> = {
  'Crime & Public Safety': [
    'Violent Crime',
    'Property Crime / Burglary',
    'Fraud & Scams',
    'Cybercrime',
    'Drugs / Narcotics',
    'Public Disorder',
    'Arson / Fire Incidents'
  ],
  'Security & Terrorism': [
    'Terrorism / Explosives',
    'Active Shooter / Armed Incident',
    'Civil Unrest / Protests',
    'Infrastructure Attack',
    'Police / Military Activity'
  ],
  'Weather & Environmental': [
    'Storm / High Winds',
    'Flooding',
    'Snow / Ice / Blizzard',
    'Extreme Heat / Cold',
    'Lightning / Thunderstorms',
    'Earthquake / Tremor',
    'Wildfire / Smoke'
  ],
  'Transport & Travel': [
    'Road Accidents / Closures',
    'Rail / Tube Disruption',
    'Airport / Flight Delays',
    'Port / Maritime Issues',
    'Public Transport Strike / Protest',
    'Power / Communication Outages'
  ],
  'Health & Emergency': [
    'Pandemic / Disease Outbreak',
    'Emergency Services Overload',
    'Contamination / Chemical Spill'
  ]
};

export const FILTER_LABELS = Object.keys(FILTER_KEYWORDS) as NewsFilterLabel[];

export const DEFAULT_FILTERS: NewsFilterLabel[] = [];

export const FILTER_STORAGE_KEY = 'edis.news.filters.v1';

export const normalizeFilters = (filters: string[]): NewsFilterLabel[] => {
  const seen = new Set<NewsFilterLabel>();
  const normalized: NewsFilterLabel[] = [];

  for (const raw of filters) {
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim() as NewsFilterLabel;
    if (!trimmed || !(trimmed in FILTER_KEYWORDS)) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
};

export const serializeFilters = (filters: string[]): string => {
  const normalized = normalizeFilters(filters);
  const sorted = [...normalized].sort((a, b) => a.localeCompare(b));
  return JSON.stringify(sorted);
};

export const composeNewsQuery = (base: string, filters: string[]): string => {
  const trimmedBase = base.trim();
  const normalized = normalizeFilters(filters);

  if (normalized.length === 0) {
    return trimmedBase;
  }

  const clauses = normalized.map((label) => {
    const terms = FILTER_KEYWORDS[label]
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    const uniqueTerms = Array.from(new Set(terms));
    const joinedTerms = uniqueTerms
      .map((term) => (term.includes(' ') ? `"${term}"` : term))
      .join(' OR ');
    return `(${joinedTerms})`;
  });

  const filtersPart = clauses.join(' OR ');

  if (!trimmedBase) {
    return filtersPart;
  }

  return `${trimmedBase} ${filtersPart}`;
};

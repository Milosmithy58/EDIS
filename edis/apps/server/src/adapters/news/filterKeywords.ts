// Server-side mirror of the news filter configuration. Keep the label strings
// and keyword arrays aligned with the frontend version in
// `apps/web/src/lib/newsFilters.ts` so both layers compose the same provider
// queries.
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

export const normalizeFilters = (filters: unknown): NewsFilterLabel[] => {
  if (!Array.isArray(filters)) {
    return [];
  }

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

export const buildFilterQuery = (base: string, filters: string[]): string => {
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
    const joined = uniqueTerms
      .map((term) => (term.includes(' ') ? `"${term}"` : term))
      .join(' OR ');
    return `(${joined})`;
  });

  const filtersPart = clauses.join(' OR ');

  if (!trimmedBase) {
    return filtersPart;
  }

  return `${trimmedBase} ${filtersPart}`;
};

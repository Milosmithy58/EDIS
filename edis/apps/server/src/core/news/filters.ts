export type NewsFilter = {
  slug: string;
  label: string;
  keywords: string[];
};

export const FILTERS: NewsFilter[] = [
  { slug: 'crime-violent', label: 'Violent Crime', keywords: ['shooting', 'stabbing', 'homicide', 'assault', 'violence'] },
  { slug: 'crime-property', label: 'Property Crime', keywords: ['burglary', 'robbery', 'theft', 'vandalism', 'break-in'] },
  { slug: 'crime-cyber', label: 'Cyber & Fraud', keywords: ['cyberattack', 'ransomware', 'phishing', 'fraud', 'identity theft'] },
  { slug: 'crime-terror', label: 'Terror & Security', keywords: ['terror', 'extremist', 'bomb threat', 'security alert', 'counterterrorism'] },
  { slug: 'crime-unrest', label: 'Civil Unrest', keywords: ['protest', 'riot', 'demonstration', 'civil unrest', 'strike rally'] },
  { slug: 'crime-police', label: 'Law Enforcement', keywords: ['police', 'law enforcement', 'officer-involved', 'arrest', 'investigation'] },
  { slug: 'weather-storm', label: 'Storms', keywords: ['storm', 'hurricane', 'typhoon', 'cyclone', 'severe weather'] },
  { slug: 'weather-flood', label: 'Flooding', keywords: ['flood', 'flash flood', 'inundation', 'levee'] },
  { slug: 'weather-wildfire', label: 'Wildfire', keywords: ['wildfire', 'bushfire', 'forest fire', 'grass fire'] },
  { slug: 'weather-heat', label: 'Heat & Cold', keywords: ['heatwave', 'cold snap', 'temperature record', 'heat advisory', 'polar vortex'] },
  { slug: 'weather-quake', label: 'Earthquakes', keywords: ['earthquake', 'seismic', 'aftershock', 'magnitude'] },
  { slug: 'weather-landslide', label: 'Landslides', keywords: ['landslide', 'mudslide', 'rockslide'] },
  { slug: 'health-outbreak', label: 'Disease Outbreak', keywords: ['outbreak', 'epidemic', 'pandemic', 'virus', 'infection'] },
  { slug: 'health-hospital', label: 'Hospital Incidents', keywords: ['hospital incident', 'ER closure', 'medical emergency', 'ambulance delay'] },
  { slug: 'health-ems', label: 'Emergency Services', keywords: ['emergency services', 'paramedic', 'ems', 'ambulance'] },
  { slug: 'transport-road', label: 'Road & Traffic', keywords: ['road closure', 'traffic', 'highway', 'car crash', 'accident'] },
  { slug: 'transport-rail', label: 'Rail & Transit', keywords: ['train', 'railway', 'metro', 'subway', 'rail service'] },
  { slug: 'transport-aviation', label: 'Aviation', keywords: ['flight', 'airport', 'aviation', 'runway', 'airline'] },
  { slug: 'transport-maritime', label: 'Maritime', keywords: ['port', 'shipping', 'maritime', 'vessel', 'coast guard'] },
  { slug: 'transport-strike', label: 'Strikes & Labor', keywords: ['strike', 'walkout', 'union action', 'industrial action'] },
  { slug: 'infrastructure-power', label: 'Power & Utilities', keywords: ['power outage', 'electricity', 'grid failure', 'utility disruption'] },
  { slug: 'infrastructure-water', label: 'Water & Sewage', keywords: ['water main', 'water shortage', 'sewage', 'boil water notice'] },
  { slug: 'infrastructure-telecom', label: 'Telecom & Internet', keywords: ['internet outage', 'telecom', 'network disruption', 'fiber cut'] },
  { slug: 'economy-market', label: 'Markets & Economy', keywords: ['market', 'inflation', 'economy', 'gdp', 'recession'] },
  { slug: 'governance-policy', label: 'Policy & Regulation', keywords: ['policy', 'legislation', 'government order', 'decree', 'executive order'] },
  { slug: 'community-events', label: 'Community Alerts', keywords: ['community alert', 'public notice', 'local event', 'community safety'] },
  { slug: 'technology', label: 'Technology & Cyber', keywords: ['technology', 'software', 'data breach', 'cybersecurity'] },
  { slug: 'environment', label: 'Environment & Climate', keywords: ['environment', 'climate', 'emissions', 'conservation', 'pollution'] }
];

export const filterSlugs = new Set(FILTERS.map((filter) => filter.slug));

export const buildQueryForFilters = (filters: string[]): string[] => {
  const clauses: string[] = [];
  const seen = new Set<string>();

  for (const slug of filters) {
    const filter = FILTERS.find((item) => item.slug === slug);
    if (!filter) continue;
    const normalized = filter.keywords
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .map((keyword) => keyword.toLowerCase());
    if (!normalized.length) continue;
    const key = normalized.join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const clause = normalized
      .map((keyword) => (keyword.includes(' ') ? `"${keyword}"` : keyword))
      .join(' OR ');
    if (clause) {
      clauses.push(`(${clause})`);
    }
  }

  return clauses;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const keywordMatchers = FILTERS.map((filter) => ({
  slug: filter.slug,
  regexes: filter.keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .map((keyword) => new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`, 'i'))
}));

export const mapArticleToFilters = (text: string, url?: string): string[] => {
  const haystack = text.toLowerCase();
  const urlHaystack = url?.toLowerCase() ?? '';
  const matches = new Set<string>();

  for (const matcher of keywordMatchers) {
    if (matcher.regexes.some((regex) => regex.test(haystack))) {
      matches.add(matcher.slug);
      continue;
    }
    if (urlHaystack && matcher.slug.split('-').some((part) => urlHaystack.includes(part))) {
      matches.add(matcher.slug);
    }
  }

  return Array.from(matches);
};

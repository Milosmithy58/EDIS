export type ScrapeDomain = {
  name: string;
  homepage: string;
  rss?: string[];
  selectors?: { item: string; title: string; link: string; date?: string };
  tags: string[]; // e.g., ["crime","security","weather","transport","health"]
  geo?: 'global' | 'uk' | 'us' | 'eu';
};

export const DEFAULT_DOMAINS: ScrapeDomain[] = [
  {
    name: 'BBC',
    homepage: 'https://www.bbc.co.uk',
    rss: [
      'https://feeds.bbci.co.uk/news/rss.xml',
      'https://feeds.bbci.co.uk/news/uk/rss.xml'
    ],
    tags: ['security', 'weather', 'transport', 'health']
  },
  {
    name: 'The Guardian',
    homepage: 'https://www.theguardian.com/',
    rss: [
      'https://www.theguardian.com/uk/rss',
      'https://www.theguardian.com/world/rss'
    ],
    tags: ['security', 'weather', 'transport', 'health']
  },
  {
    name: 'Met Office',
    homepage: 'https://www.metoffice.gov.uk',
    rss: ['https://www.metoffice.gov.uk/rss/warnings'],
    tags: ['weather']
  }
  // Add more global/regional sources later via an admin domains feature
];

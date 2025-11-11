const ALLOWED_HOSTS = new Set([
  'api.tfl.gov.uk',
  'tfl.gov.uk',
  'www.nationalrail.co.uk',
  'www.networkrail.co.uk',
  'news.leeds.gov.uk',
  'www.leeds.gov.uk'
]);

export const isHostAllowed = (host: string) => ALLOWED_HOSTS.has(host.toLowerCase());

export const getAllowedHosts = () => Array.from(ALLOWED_HOSTS);

export const formatTemperature = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(1)}°C` : '—';

export const formatWind = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(1)} km/h` : '—';

export const formatPrecip = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(1)} mm` : '—';

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso));

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));

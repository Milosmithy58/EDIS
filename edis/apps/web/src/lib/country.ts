export const COUNTRY_OPTIONS = [
  { label: 'United Kingdom', value: 'UK' },
  { label: 'United States', value: 'US' }
];

export const getDefaultCountry = () => {
  const envDefault = import.meta.env.VITE_DEFAULT_COUNTRY as string | undefined;
  if (envDefault) {
    return envDefault;
  }
  return 'UK';
};

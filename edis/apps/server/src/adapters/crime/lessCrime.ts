import { env } from '../../core/env';
import { fetchText } from '../../core/fetcher';
import { CrimeDTO } from '../../core/types';

const DEFAULT_DATASET_URL = 'https://pkgs.lesscrime.info/crimedata/data/offenses_known_to_police.csv';
const SOURCE_URL = 'https://pkgs.lesscrime.info/crimedata/';

type LessCrimeRecord = {
  state: string;
  year: number;
  offense: string;
  value: number;
};

let datasetCache: Promise<LessCrimeRecord[]> | null = null;
const stateCache = new Map<string, CrimeDTO>();

const normaliseState = (state: string | undefined): string | null => {
  if (!state) return null;
  const trimmed = state.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const parseNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
};

const parseCsv = (csv: string): LessCrimeRecord[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const getCell = (row: string[], keyOptions: string[]): string | undefined => {
    for (const key of keyOptions) {
      const index = headerCells.findIndex((cell) => cell === key.toLowerCase());
      if (index >= 0 && row[index] !== undefined) {
        return row[index];
      }
    }
    return undefined;
  };

  const records: LessCrimeRecord[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length === 0) continue;

    const state = normaliseState(
      getCell(cells, ['state', 'state_abbr', 'state_abb', 'state_id', 'state_code'])
    );
    const yearRaw = getCell(cells, ['year', 'data_year']);
    const offense = getCell(
      cells,
      [
        'offense',
        'offense_name',
        'offense_type',
        'offense_category',
        'offense_subcat',
        'offense_description'
      ]
    );
    const valueRaw = getCell(cells, ['actual', 'value', 'count', 'data_value', 'total']);

    const year = yearRaw ? Number(yearRaw) : NaN;
    const value = parseNumber(valueRaw ?? '');

    if (!state || !offense || Number.isNaN(year) || value === null) {
      continue;
    }

    records.push({
      state,
      year,
      offense,
      value
    });
  }

  return records;
};

const loadDataset = async (): Promise<LessCrimeRecord[]> => {
  if (!datasetCache) {
    datasetCache = (async () => {
      const url = env.LESSCRIME_DATASET_URL ?? DEFAULT_DATASET_URL;
      const csv = await fetchText(url, {
        headers: {
          accept: 'text/csv,text/plain,*/*'
        }
      });
      return parseCsv(csv);
    })();
  }
  return datasetCache;
};

const matchesOffense = (offense: string, keyPart: string) => {
  const normalized = keyPart.toLowerCase();
  return (
    offense === normalized ||
    offense.startsWith(`${normalized} `) ||
    offense.startsWith(`${normalized}(`)
  );
};

const offenseMatchers: Array<{
  keys: string[];
  category:
    | 'violent'
    | 'property'
    | 'homicide'
    | 'robbery'
    | 'aggravatedAssault'
    | 'burglary'
    | 'larceny'
    | 'motorVehicleTheft';
}> = [
  { keys: ['violent crime', 'violent crime total'], category: 'violent' },
  { keys: ['property crime', 'property crime total'], category: 'property' },
  {
    keys: ['murder and nonnegligent manslaughter', 'murder & nonnegligent manslaughter', 'homicide'],
    category: 'homicide'
  },
  { keys: ['robbery'], category: 'robbery' },
  { keys: ['aggravated assault'], category: 'aggravatedAssault' },
  { keys: ['burglary'], category: 'burglary' },
  { keys: ['larceny-theft', 'larceny'], category: 'larceny' },
  { keys: ['motor vehicle theft'], category: 'motorVehicleTheft' }
];

const normalizeOffense = (offense: string) => offense.toLowerCase().replace(/\s+/g, ' ').trim();

export const getCrimeForState = async (stateAbbr: string): Promise<CrimeDTO> => {
  const key = stateAbbr.toUpperCase();
  if (stateCache.has(key)) {
    return stateCache.get(key)!;
  }

  const dataset = await loadDataset();
  const rows = dataset.filter((row) => row.state === key);

  if (rows.length === 0) {
    throw new Error(`No LessCrime data available for state ${key}`);
  }

  const latestYear = rows.reduce((max, row) => Math.max(max, row.year), rows[0].year);
  const latestRows = rows.filter((row) => row.year === latestYear);

  const aggregates = {
    violent: 0,
    property: 0,
    homicide: 0,
    robbery: 0,
    aggravatedAssault: 0,
    burglary: 0,
    larceny: 0,
    motorVehicleTheft: 0
  };

  for (const row of latestRows) {
    const offense = normalizeOffense(row.offense);
    for (const matcher of offenseMatchers) {
      if (matcher.keys.some((keyPart) => matchesOffense(offense, keyPart))) {
        aggregates[matcher.category] += row.value;
        break;
      }
    }
  }

  if (aggregates.violent === 0) {
    aggregates.violent = aggregates.homicide + aggregates.robbery + aggregates.aggravatedAssault;
  }
  if (aggregates.property === 0) {
    aggregates.property = aggregates.burglary + aggregates.larceny + aggregates.motorVehicleTheft;
  }

  const totals = [
    { category: 'Violent crime', count: Math.round(aggregates.violent) },
    { category: 'Homicide', count: Math.round(aggregates.homicide) },
    { category: 'Robbery', count: Math.round(aggregates.robbery) },
    { category: 'Aggravated assault', count: Math.round(aggregates.aggravatedAssault) },
    { category: 'Property crime', count: Math.round(aggregates.property) },
    { category: 'Burglary', count: Math.round(aggregates.burglary) },
    { category: 'Larceny', count: Math.round(aggregates.larceny) },
    { category: 'Motor vehicle theft', count: Math.round(aggregates.motorVehicleTheft) }
  ].filter((item) => item.count > 0);

  if (totals.length === 0) {
    throw new Error(`LessCrime dataset did not return usable stats for state ${key}`);
  }

  const total = totals
    .filter((item) => item.category === 'Violent crime' || item.category === 'Property crime')
    .reduce((sum, item) => sum + item.count, 0);

  const payload: CrimeDTO = {
    period: `${latestYear}`,
    totalsByCategory: totals,
    total,
    source: 'LessCrime Crime Data (UCR)',
    url: SOURCE_URL
  };

  stateCache.set(key, payload);
  return payload;
};

export const __internal = {
  parseCsv,
  normalizeOffense,
  loadDataset
};

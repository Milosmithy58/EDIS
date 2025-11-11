import { fetchJson } from '../core/fetcher';
import { FemaDisasterDTO } from '../core/types';

const BASE_URL = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';

export type DisasterQueryParams = {
  state: string;
  county?: string;
  since?: string;
  types?: string[];
  limit?: number;
  page?: number;
};

type NormalizedQueryParams = {
  state: string;
  county?: string;
  since?: string;
  types?: string[];
  limit: number;
  page: number;
};

type DisasterRecord = {
    disasterNumber: number;
    declarationType: string;
    state: string;
    declaredCountyArea?: string | null;
    title?: string | null;
    incidentBeginDate?: string | null;
    incidentEndDate?: string | null;
    declarationDate?: string | null;
    placeCodes?: Array<{ placeCode?: string | null }> | null;
};

type DisasterDeclarationsSummariesResponse = {
  DisasterDeclarationsSummaries?: DisasterRecord[];
  metadata?: {
    count?: number;
    totalCount?: number;
    ['@odata.count']?: number;
  } | null;
  ['@odata.count']?: number;
};

const escapeLiteral = (value: string) => value.replace(/'/g, "''");

const normalizeSince = (value?: string) => {
  if (!value) return undefined;
  if (value.includes('T')) {
    return value;
  }
  return `${value}T00:00:00Z`;
};

const clampLimit = (value?: number) => {
  const limit = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN;
  if (Number.isNaN(limit) || limit <= 0) return 100;
  if (limit > 500) return 500;
  return limit;
};

const normalizePage = (value?: number) => {
  const page = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN;
  if (Number.isNaN(page) || page <= 0) return 1;
  return page;
};

const sanitizeTypes = (values?: string[]) => {
  if (!values || values.length === 0) return undefined;
  const unique = Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0)
    )
  );
  return unique.length > 0 ? unique : undefined;
};

export class OpenFemaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string = 'openfema_error'
  ) {
    super(message);
    this.name = 'OpenFemaError';
  }
}

export const buildDisasterQuery = (
  params: DisasterQueryParams
): { url: string; normalized: NormalizedQueryParams } => {
  const state = params.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new Error('state must be a 2-letter code');
  }

  const county = params.county?.trim() || undefined;
  const sinceRaw = params.since?.trim() || undefined;
  const since = normalizeSince(sinceRaw);
  const types = sanitizeTypes(params.types);
  const limit = clampLimit(params.limit);
  const page = normalizePage(params.page);

  const filters: string[] = [`state eq '${escapeLiteral(state)}'`];

  if (county) {
    filters.push(`substringof('${escapeLiteral(county.toLowerCase())}', tolower(declaredCountyArea))`);
  }

  if (since) {
    filters.push(`incidentBeginDate ge datetime'${escapeLiteral(since)}'`);
  }

  if (types && types.length > 0) {
    const typeFilter = types
      .map((type) => `declarationType eq '${escapeLiteral(type)}'`)
      .join(' or ');
    filters.push(`(${typeFilter})`);
  }

  const searchParams = new URLSearchParams();
  if (filters.length > 0) {
    searchParams.set('$filter', filters.join(' and '));
  }
  searchParams.set('$orderby', 'declarationDate desc');
  searchParams.set('$top', String(limit));
  searchParams.set('$skip', String((page - 1) * limit));
  searchParams.set('$inlinecount', 'allpages');

  return {
    url: `${BASE_URL}?${searchParams.toString()}`,
    normalized: {
      state,
      county,
      since: sinceRaw,
      types,
      limit,
      page
    }
  };
};

const mapToDto = (item: DisasterRecord): FemaDisasterDTO => {
  const placeCodes = item.placeCodes
    ?.map((entry) => entry?.placeCode)
    .filter((code): code is string => Boolean(code && code.trim().length > 0));

  return {
    disasterNumber: item.disasterNumber,
    declarationType: item.declarationType,
    state: item.state,
    county: item.declaredCountyArea?.trim() || null,
    title: item.title?.trim() || null,
    incidentBeginDate: item.incidentBeginDate ?? null,
    incidentEndDate: item.incidentEndDate ?? null,
    declarationDate: item.declarationDate ?? null,
    placeCodes: placeCodes && placeCodes.length > 0 ? placeCodes : undefined
  };
};

const getTotalCount = (payload: DisasterDeclarationsSummariesResponse) => {
  if (typeof payload['@odata.count'] === 'number') {
    return payload['@odata.count'];
  }
  if (payload.metadata) {
    if (typeof payload.metadata.count === 'number') {
      return payload.metadata.count;
    }
    if (typeof payload.metadata.totalCount === 'number') {
      return payload.metadata.totalCount;
    }
    if (typeof payload.metadata['@odata.count'] === 'number') {
      return payload.metadata['@odata.count'];
    }
  }
  return undefined;
};

export const fetchDisasters = async (
  params: DisasterQueryParams
): Promise<{ items: FemaDisasterDTO[]; page: number; pageSize: number; total?: number }> => {
  const { url, normalized } = buildDisasterQuery(params);
  try {
    const payload = await fetchJson<DisasterDeclarationsSummariesResponse>(url);
    const items = (payload.DisasterDeclarationsSummaries ?? []).map(mapToDto);
    const total = getTotalCount(payload);
    return {
      items,
      page: normalized.page,
      pageSize: normalized.limit,
      total
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch FEMA disasters';
    const statusMatch = typeof message === 'string' ? message.match(/Request failed: (\d{3})/) : null;
    const status = statusMatch ? Number(statusMatch[1]) : 502;
    throw new OpenFemaError('Failed to fetch FEMA disasters', status);
  }
};

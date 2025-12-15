import { LRUCache } from 'lru-cache';
import { fetchJson, fetchText } from '../../core/fetcher';
import type { ErrorDTO, TicketDTO } from '../../core/types';
import { createTicketId } from './hash';
import { getAllowedHosts, isHostAllowed } from './allowlist';
import type { TicketAreaContext, TicketSourceClient, TicketSourceDefinition } from './types';
import { sources } from './sources';

const RESULT_CACHE = new LRUCache<string, { tickets: TicketDTO[]; sourceErrors: ErrorDTO[] }>({
  max: 200,
  ttl: 1000 * 60 * 5
});

const RESPONSE_CACHE = new LRUCache<string, any>({
  max: 400,
  ttl: 1000 * 60 * 5
});

const USER_AGENT =
  'EDIS/1.0 (+https://example.com) Node.js Service Ticket Scraper';

const normalizeContext = (context: TicketAreaContext): TicketAreaContext => {
  const normalized: TicketAreaContext = {};
  if (context.countryCode) {
    normalized.countryCode = context.countryCode.trim().toUpperCase();
  }
  if (context.admin1) {
    normalized.admin1 = context.admin1.trim();
  }
  if (context.admin2) {
    normalized.admin2 = context.admin2.trim();
  }
  if (context.city) {
    normalized.city = context.city.trim();
  }
  if (context.postalCode) {
    normalized.postalCode = context.postalCode.trim();
  }
  if (typeof context.lat === 'number' && Number.isFinite(context.lat)) {
    normalized.lat = context.lat;
  }
  if (typeof context.lon === 'number' && Number.isFinite(context.lon)) {
    normalized.lon = context.lon;
  }
  return normalized;
};

const ensureAllowed = (url: string) => {
  const parsed = new URL(url);
  if (!isHostAllowed(parsed.hostname)) {
    const allowed = getAllowedHosts().join(', ');
    throw new Error(`Host ${parsed.hostname} is not in the scraping allowlist. Allowed hosts: ${allowed}`);
  }
};

const buildClient = (): TicketSourceClient => {
  return {
    fetchText: async (url: string) => {
      ensureAllowed(url);
      const cacheKey = `text:${url}`;
      if (RESPONSE_CACHE.has(cacheKey)) {
        return RESPONSE_CACHE.get(cacheKey) as string;
      }
      const body = await fetchText(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml'
        }
      });
      RESPONSE_CACHE.set(cacheKey, body);
      return body;
    },
    fetchJson: async <T>(url: string) => {
      ensureAllowed(url);
      const cacheKey = `json:${url}`;
      if (RESPONSE_CACHE.has(cacheKey)) {
        return RESPONSE_CACHE.get(cacheKey) as T;
      }
      const data = await fetchJson<T>(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json'
        }
      });
      RESPONSE_CACHE.set(cacheKey, data);
      return data;
    }
  };
};

const dedupeTickets = (tickets: TicketDTO[]) => {
  const seen = new Set<string>();
  return tickets.filter((ticket) => {
    if (seen.has(ticket.id)) {
      return false;
    }
    seen.add(ticket.id);
    return true;
  });
};

const SEVERITY_ORDER: Record<NonNullable<TicketDTO['severity']>, number> = {
  critical: 5,
  major: 4,
  moderate: 3,
  minor: 2,
  info: 1
};

const dateValue = (value?: string) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

const sortTickets = (tickets: TicketDTO[]) => {
  return tickets.sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[b.severity ?? 'info'] ?? 0) - (SEVERITY_ORDER[a.severity ?? 'info'] ?? 0);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    const updatedDiff = dateValue(b.updatedAt) - dateValue(a.updatedAt);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }
    return dateValue(b.startedAt) - dateValue(a.startedAt);
  });
};

const enrichTicket = (ticket: TicketDTO, context: TicketAreaContext): TicketDTO => {
  const areaTags = new Set(ticket.areaTags ?? []);
  if (context.city) areaTags.add(context.city);
  if (context.admin1) areaTags.add(context.admin1);
  if (context.admin2) areaTags.add(context.admin2);
  if (context.postalCode) areaTags.add(context.postalCode);
  const tags = Array.from(areaTags).filter((tag) => tag && tag.trim().length > 0);
  return {
    ...ticket,
    areaTags: tags,
    location: ticket.location ??
      (context.city || context.admin1
        ? {
            name: [context.city, context.admin1].filter(Boolean).join(', ') || undefined,
            lat: context.lat,
            lon: context.lon
          }
        : undefined)
  };
};

export const getTicketsForArea = async (
  rawContext: TicketAreaContext
): Promise<{ tickets: TicketDTO[]; sourceErrors: ErrorDTO[] }> => {
  const context = normalizeContext(rawContext);
  const key = JSON.stringify(context);
  if (RESULT_CACHE.has(key)) {
    return RESULT_CACHE.get(key)!;
  }

  const activeSources: TicketSourceDefinition[] = sources.filter((source) => {
    try {
      return source.match(context);
    } catch (error) {
      console.warn('Ticket source match failure', { source: source.id, error });
      return false;
    }
  });

  if (activeSources.length === 0) {
    const empty = { tickets: [], sourceErrors: [] as ErrorDTO[] };
    RESULT_CACHE.set(key, empty);
    return empty;
  }

  const client = buildClient();
  const settled = await Promise.allSettled(
    activeSources.map(async (source) => {
      const results = await source.fetchTickets(context, client);
      return results.map((ticket) => ({
        ...ticket,
        id: ticket.id || createTicketId(source.id, ticket.url, ticket.title),
        source: ticket.source ?? {
          id: source.id,
          name: source.name,
          url: source.infoUrl
        },
        category: ticket.category ?? source.category
      }));
    })
  );

  const tickets: TicketDTO[] = [];
  const errors: ErrorDTO[] = [];

  settled.forEach((entry, index) => {
    const source = activeSources[index];
    if (entry.status === 'fulfilled') {
      entry.value.forEach((ticket) => {
        tickets.push(enrichTicket(ticket, context));
      });
    } else {
      const error = entry.reason as Error;
      const dto: ErrorDTO = {
        code: 'SCRAPE_FAILED',
        message: error?.message ?? 'Unknown error',
        source: source.id,
        status: 502,
        retryable: true
      };
      errors.push(dto);
    }
  });

  const deduped = dedupeTickets(tickets);
  const sorted = sortTickets(deduped);
  const payload = { tickets: sorted, sourceErrors: errors };
  RESULT_CACHE.set(key, payload);
  return payload;
};

export { createTicketId } from './hash';
export type { TicketAreaContext } from './types';

export const clearTicketCaches = () => {
  RESULT_CACHE.clear();
  RESPONSE_CACHE.clear();
};

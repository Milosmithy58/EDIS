import type { TicketDTO } from '../../../core/types';
import type { TicketAreaContext, TicketSourceClient, TicketSourceDefinition } from '../types';
import { createTicketId } from '../hash';

const TFL_STATUS_URL =
  'https://api.tfl.gov.uk/Line/Mode/tube%2Cdlr%2Coverground%2Ctram/Status';

const severityFromStatus = (value: number | undefined): TicketDTO['severity'] => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value <= 2) return 'critical';
  if (value <= 4) return 'major';
  if (value <= 6) return 'moderate';
  if (value <= 8) return 'minor';
  return 'info';
};

const normalizeLondon = (value?: string) => value?.toLowerCase().includes('london');

const isLondonContext = (context: TicketAreaContext) => {
  if (!context.countryCode) return false;
  if (context.countryCode !== 'GB' && context.countryCode !== 'UK') {
    return false;
  }
  return Boolean(normalizeLondon(context.city) || normalizeLondon(context.admin1));
};

type TflLineStatus = {
  statusSeverity: number;
  statusSeverityDescription: string;
  reason?: string;
  created?: string;
  validityPeriods?: Array<{
    fromDate?: string;
    toDate?: string;
    isNow?: boolean;
  }>;
  disruption?: {
    category?: string;
    description?: string;
    additionalInfo?: string;
    created?: string;
    lastUpdate?: string;
    closureText?: string;
    startDate?: string;
    endDate?: string;
  };
};

type TflLine = {
  id: string;
  name: string;
  modeName: string;
  lineStatuses: TflLineStatus[];
};

const buildTicketFromStatus = (line: TflLine, status: TflLineStatus): TicketDTO | null => {
  const severity = status.statusSeverity;
  if (severity === 10 && !status.reason) {
    return null;
  }
  const mappedSeverity = severityFromStatus(severity);
  const startedAt =
    status.disruption?.startDate ||
    status.validityPeriods?.find((period) => period.isNow)?.fromDate ||
    status.created;
  const updatedAt = status.disruption?.lastUpdate || status.disruption?.endDate || status.created;
  const description =
    status.reason ||
    status.disruption?.description ||
    status.disruption?.additionalInfo ||
    status.disruption?.closureText;
  const statusLabel = status.statusSeverityDescription?.trim();
  const title = `${line.name} – ${statusLabel || 'Service update'}`;
  const url = `https://tfl.gov.uk/status-updates/${line.id}`;
  const mappedStatus = status.disruption?.category === 'PlannedWork' ? 'planned' : 'ongoing';

  return {
    id: createTicketId('tfl', url, title),
    source: {
      id: 'tfl',
      name: 'Transport for London',
      url: 'https://tfl.gov.uk/status-updates'
    },
    title,
    description: description?.trim(),
    category: 'Transport',
    severity: mappedSeverity,
    status: mappedStatus,
    startedAt: startedAt ?? undefined,
    updatedAt: updatedAt ?? undefined,
    areaTags: ['London'],
    url
  };
};

const parseTflResponse = (lines: TflLine[]): TicketDTO[] => {
  const tickets: TicketDTO[] = [];
  lines.forEach((line) => {
    line.lineStatuses?.forEach((status) => {
      const ticket = buildTicketFromStatus(line, status);
      if (ticket) {
        tickets.push(ticket);
      }
    });
  });
  return tickets;
};

export const tflSource: TicketSourceDefinition = {
  id: 'tfl',
  name: 'Transport for London',
  homepage: 'https://tfl.gov.uk',
  infoUrl: 'https://tfl.gov.uk/status-updates',
  category: 'Transport',
  match: isLondonContext,
  fetchTickets: async (_context, client: TicketSourceClient) => {
    const payload = await client.fetchJson<TflLine[]>(TFL_STATUS_URL);
    return parseTflResponse(payload);
  }
};

export { parseTflResponse };

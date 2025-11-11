import type { TicketDTO } from '../../../core/types';
import type { TicketAreaContext, TicketSourceClient, TicketSourceDefinition } from '../types';
import { createTicketId } from '../hash';

const NATIONAL_RAIL_URL = 'https://www.nationalrail.co.uk/service_disruptions.aspx';

const isUkContext = (context: TicketAreaContext) => {
  if (!context.countryCode) return false;
  return context.countryCode === 'GB' || context.countryCode === 'UK';
};

const parseDate = (text?: string) => {
  if (!text) return undefined;
  const cleaned = text.replace(/Last updated:?\s*/i, '').trim();
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return undefined;
};

const detectSeverity = (text: string): TicketDTO['severity'] => {
  const lower = text.toLowerCase();
  if (lower.includes('suspend') || lower.includes('cancel')) return 'critical';
  if (lower.includes('major') || lower.includes('significant')) return 'major';
  if (lower.includes('moderate') || lower.includes('delays')) return 'moderate';
  if (lower.includes('minor') || lower.includes('minor delays')) return 'minor';
  return 'info';
};

const detectStatus = (text: string): TicketDTO['status'] => {
  const lower = text.toLowerCase();
  if (lower.includes('resume') || lower.includes('resolved')) return 'resolved';
  if (lower.includes('planned') || lower.includes('scheduled')) return 'planned';
  return 'ongoing';
};

export const parseNationalRail = (html: string): TicketDTO[] => {
  const tickets: TicketDTO[] = [];
  const sectionRegex = /<(section|article)[^>]*?(service-item|serviceItem|disruption)[^>]*>([\s\S]*?)<\/\1>/gi;
  const stripTags = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(html)) !== null) {
    const block = match[0];
    const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const headingMatch = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i.exec(block);
    const titleText = stripTags(linkMatch?.[2] ?? headingMatch?.[1] ?? '');
    if (!titleText) continue;
    const href = linkMatch?.[1] ?? '#';
    const url = href.startsWith('http') ? href : `https://www.nationalrail.co.uk${href}`;
    const summaryMatch = /<p[^>]*class="[^"]*(summary|description)[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const paragraphMatch = /<p>([\s\S]*?)<\/p>/i.exec(block);
    const description = stripTags(summaryMatch?.[2] ?? paragraphMatch?.[1] ?? '');
    const updatedMatch = /<p[^>]*class="[^"]*(lastupdated|updated)[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(
      block
    );
    const timeMatch = /<time[^>]*>([\s\S]*?)<\/time>/i.exec(block);
    const updatedText = stripTags(updatedMatch?.[2] ?? timeMatch?.[1] ?? '');

    const ticket: TicketDTO = {
      id: createTicketId('national-rail', url, titleText),
      source: {
        id: 'national-rail',
        name: 'National Rail',
        url: NATIONAL_RAIL_URL
      },
      title: titleText,
      description: description || undefined,
      category: 'Transport',
      severity: detectSeverity(`${titleText} ${description}`),
      status: detectStatus(description || titleText),
      updatedAt: parseDate(updatedText),
      url,
      areaTags: ['United Kingdom']
    };
    tickets.push(ticket);
  }
  return tickets;
};

export const nationalRailSource: TicketSourceDefinition = {
  id: 'national-rail',
  name: 'National Rail',
  homepage: 'https://www.nationalrail.co.uk',
  infoUrl: NATIONAL_RAIL_URL,
  category: 'Transport',
  match: isUkContext,
  fetchTickets: async (_context, client: TicketSourceClient) => {
    const html = await client.fetchText(NATIONAL_RAIL_URL);
    return parseNationalRail(html);
  }
};

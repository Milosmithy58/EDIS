import type { TicketDTO } from '../../../core/types';
import type { TicketAreaContext, TicketSourceClient, TicketSourceDefinition } from '../types';
import { createTicketId } from '../hash';

const LEEDS_NOTICES_URL = 'https://news.leeds.gov.uk/search?query=service+disruption';

const matchesLeeds = (context: TicketAreaContext) => {
  const values = [context.city, context.admin1, context.admin2, context.postalCode]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  return values.some((value) => value.includes('leeds') || value.startsWith('ls'));
};

const detectCouncilSeverity = (text: string): TicketDTO['severity'] => {
  const lower = text.toLowerCase();
  if (lower.includes('emergency') || lower.includes('closure')) return 'major';
  if (lower.includes('maintenance') || lower.includes('repair')) return 'moderate';
  if (lower.includes('update') || lower.includes('notice')) return 'info';
  return 'info';
};

const detectCouncilStatus = (text: string): TicketDTO['status'] => {
  const lower = text.toLowerCase();
  if (lower.includes('reopen') || lower.includes('completed')) return 'resolved';
  if (lower.includes('from') && lower.includes('to')) return 'planned';
  return 'ongoing';
};

export const parseLeedsCouncil = (html: string): TicketDTO[] => {
  const tickets: TicketDTO[] = [];
  const articleRegex = /<(article|div)[^>]*?(search-result)?[^>]*>([\s\S]*?)<\/\1>/gi;
  const stripTags = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  let match: RegExpExecArray | null;
  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[0];
    const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const headingMatch = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i.exec(block);
    const title = stripTags(linkMatch?.[2] ?? headingMatch?.[1] ?? '');
    if (!title) continue;
    const summaryMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const summary = stripTags(summaryMatch?.[1] ?? '');
    const timeMatch = /<time[^>]*datetime="([^"]+)"[^>]*>/i.exec(block);
    const timeTextMatch = /<time[^>]*>([\s\S]*?)<\/time>/i.exec(block);
    const dateText = timeMatch?.[1] ?? stripTags(timeTextMatch?.[1] ?? '');
    const href = linkMatch?.[1] ?? '#';
    const url = href.startsWith('http') ? href : `https://news.leeds.gov.uk${href}`;

    const ticket: TicketDTO = {
      id: createTicketId('leeds-council', url, title),
      source: {
        id: 'leeds-council',
        name: 'Leeds City Council',
        url: LEEDS_NOTICES_URL
      },
      title,
      description: summary || undefined,
      category: 'Council',
      severity: detectCouncilSeverity(`${title} ${summary}`),
      status: detectCouncilStatus(`${title} ${summary}`),
      startedAt: dateText ? new Date(dateText).toISOString() : undefined,
      url,
      areaTags: ['Leeds']
    };
    tickets.push(ticket);
  }
  return tickets;
};

export const leedsCouncilSource: TicketSourceDefinition = {
  id: 'leeds-council',
  name: 'Leeds City Council',
  homepage: 'https://www.leeds.gov.uk',
  infoUrl: LEEDS_NOTICES_URL,
  category: 'Council',
  match: matchesLeeds,
  fetchTickets: async (_context, client: TicketSourceClient) => {
    const html = await client.fetchText(LEEDS_NOTICES_URL);
    return parseLeedsCouncil(html);
  }
};

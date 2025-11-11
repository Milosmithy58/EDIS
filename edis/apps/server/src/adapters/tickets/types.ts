import type { TicketDTO } from '../../core/types';

export type TicketAreaContext = {
  countryCode?: string;
  admin1?: string;
  admin2?: string;
  city?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
};

export type TicketSourceDefinition = {
  id: string;
  name: string;
  homepage: string;
  infoUrl: string;
  category: TicketDTO['category'];
  match: (context: TicketAreaContext) => boolean;
  fetchTickets: (context: TicketAreaContext, client: TicketSourceClient) => Promise<TicketDTO[]>;
};

export type TicketSourceClient = {
  fetchText: (url: string) => Promise<string>;
  fetchJson: <T>(url: string) => Promise<T>;
};

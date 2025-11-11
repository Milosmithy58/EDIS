import { tflSource } from './tfl';
import { nationalRailSource } from './nationalRail';
import { leedsCouncilSource } from './leedsCouncil';
import type { TicketSourceDefinition } from '../types';

export const sources: TicketSourceDefinition[] = [tflSource, nationalRailSource, leedsCouncilSource];

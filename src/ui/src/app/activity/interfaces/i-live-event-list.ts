import type { LiveEvent } from './i-live-event';

export interface LiveEventList {
  events: LiveEvent[];
  cursor: string;
}

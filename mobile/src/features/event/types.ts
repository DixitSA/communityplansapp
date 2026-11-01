import type { EventCardData } from '@/design';

/** Everything the event page needs, on top of what a feed card shows. */
export type EventDetail = EventCardData & {
  description: string;
  /** Street address, shown under the venue name. */
  address: string;
  /** Organizer (a person) or venue, for API and curated events. */
  host: { name: string; kind: 'organizer' | 'venue' };
  /** "Free", "$15", "$20 to $35". */
  priceLabel: string;
  /** Category tags, primary category first. */
  tags: { label: string; interest: string }[];
  /** Where we got the listing from. */
  source: { name: string; url?: string; /** Picked by us rather than pulled from a listing site. */ curated?: boolean };
  /** The flyer's most prominent vivid color ("#rrggbb"), for the page's tint. Missing until the server has read it. */
  imageColor?: string;
  /** Other people going (not friends). Only shown once the viewer is Going. */
  otherAttendees: { id: string; name: string }[];
  /** All other people going (>= otherAttendees.length). */
  othersGoing: number;
};

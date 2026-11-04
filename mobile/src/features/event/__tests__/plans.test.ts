import {
  attributionLine,
  eventSummary,
  goingTogetherLine,
  listingButtonLabel,
  nextStatus,
  othersLabel,
  othersRevealed,
  privacyHint,
} from '../plansLogic';
import { usePlansStore } from '../plansStore';

describe('listing button and summary', () => {
  it('labels ticket sources and plain listings', () => {
    expect(listingButtonLabel('Ticketmaster')).toBe('Get tickets on Ticketmaster');
    expect(listingButtonLabel('Listed via SeatGeek')).toBe('Get tickets on SeatGeek');
    expect(listingButtonLabel('Google')).toBe('View listing on Google');
    // Instagram handles say where the link goes instead of naming the account.
    expect(listingButtonLabel('@vintagemarketclt', 'https://www.instagram.com/p/abc/')).toBe('View on Instagram');
    expect(listingButtonLabel('Listed via @cltguide', 'https://example.com/event')).toBe('View listing');
  });
  it('builds a summary from known facts only', () => {
    expect(eventSummary({ category: 'Music', venue: 'The Fillmore' })).toBe('Music at The Fillmore.');
    expect(eventSummary({ category: 'Music', venue: 'The Fillmore', endText: '10:00 PM' })).toBe(
      'Music at The Fillmore. Runs until 10:00 PM.',
    );
    expect(eventSummary({ venue: 'The Fillmore' })).toBe('At The Fillmore.');
  });
});

const reset = () => usePlansStore.setState({ statuses: {} });
const status = (id: string) => usePlansStore.getState().statuses[id] ?? null;

describe('plansStore', () => {
  beforeEach(reset);

  it('starts with no plan', () => {
    expect(status('ev-1')).toBeNull();
  });

  it('sets and clears a status per event', () => {
    const { setStatus } = usePlansStore.getState();
    setStatus('ev-1', 'going');
    setStatus('ev-2', 'down_if_friends');
    expect(status('ev-1')).toBe('going');
    expect(status('ev-2')).toBe('down_if_friends');
    setStatus('ev-1', null);
    expect(status('ev-1')).toBeNull();
    expect(status('ev-2')).toBe('down_if_friends');
  });

  it('toggleInterested flips between Interested and no plan', () => {
    const { toggleInterested } = usePlansStore.getState();
    toggleInterested('ev-1');
    expect(status('ev-1')).toBe('interested');
    toggleInterested('ev-1');
    expect(status('ev-1')).toBeNull();
  });

  it('toggleInterested never downgrades Going or Down if friends go', () => {
    const { setStatus, toggleInterested } = usePlansStore.getState();
    setStatus('ev-1', 'going');
    setStatus('ev-2', 'down_if_friends');
    toggleInterested('ev-1');
    toggleInterested('ev-2');
    expect(status('ev-1')).toBe('going');
    expect(status('ev-2')).toBe('down_if_friends');
  });
});

describe('privacyHint', () => {
  it('says nothing until the viewer chooses', () => {
    expect(privacyHint(null)).toBeNull();
  });
  it('keeps Interested and Down if private', () => {
    expect(privacyHint('interested')).toBe('Only you can see this');
    expect(privacyHint('down_if_friends')).toBe('Only you can see this');
  });
  it('tells the viewer Going is visible to others', () => {
    expect(privacyHint('going')).toBe('Friends and other attendees can see this');
  });
});

describe('others visibility', () => {
  it('reveals other attendees only once Going', () => {
    expect(othersRevealed(null)).toBe(false);
    expect(othersRevealed('interested')).toBe(false);
    expect(othersRevealed('down_if_friends')).toBe(false);
    expect(othersRevealed('going')).toBe(true);
  });
  it('words the hidden count', () => {
    expect(othersLabel(14)).toBe('+14 others');
    expect(othersLabel(1)).toBe('+1 other');
  });
});

describe('nextStatus', () => {
  it('choosing the active Interested or Down if clears it', () => {
    expect(nextStatus('interested', 'interested')).toBeNull();
    expect(nextStatus('down_if_friends', 'down_if_friends')).toBeNull();
  });
  it('switches between choices', () => {
    expect(nextStatus(null, 'interested')).toBe('interested');
    expect(nextStatus('interested', 'down_if_friends')).toBe('down_if_friends');
    expect(nextStatus('going', 'interested')).toBe('interested');
  });
  it('Going always stays Going', () => {
    expect(nextStatus(null, 'going')).toBe('going');
    expect(nextStatus('going', 'going')).toBe('going');
  });
});

describe('attributionLine', () => {
  it('credits curated events and listings differently', () => {
    expect(attributionLine({ name: 'yard', curated: true })).toBe('Curated by yard');
    expect(attributionLine({ name: 'Eventbrite' })).toBe('Listed via Eventbrite');
  });

  it('drops the lead-in some sources store with their name', () => {
    expect(attributionLine({ name: 'via charlotte-theater.com' })).toBe('Listed via charlotte-theater.com');
    expect(attributionLine({ name: 'Tickets on Ticketmaster' })).toBe('Listed via Ticketmaster');
    expect(attributionLine({ name: 'Source: camp.nc' })).toBe('Listed via camp.nc');
    expect(attributionLine({ name: 'via' })).toBe('Listed via via'); // nothing after it: keep the name as is
  });
});

describe('goingTogetherLine', () => {
  it('leads with friends', () => {
    expect(goingTogetherLine(['Maya'], 1, 0)).toBe('Maya is going too');
    expect(goingTogetherLine(['Maya', 'Sam'], 2, 0)).toBe('Maya and Sam are going too');
    expect(goingTogetherLine(['Maya', 'Sam', 'Jo'], 3, 10)).toBe('Maya, Sam and 11 others are going too');
    expect(goingTogetherLine(['Maya'], 1, 1)).toBe('Maya and 1 other are going too');
  });
  it('counts strangers without naming them', () => {
    expect(goingTogetherLine([], 0, 6)).toBe('You and 6 others are going');
    expect(goingTogetherLine([], 0, 1)).toBe('You and 1 other are going');
  });
  it('nudges when nobody else is in yet', () => {
    expect(goingTogetherLine([], 0, 0)).toBe("You're the first one in. Bring a friend?");
  });
});

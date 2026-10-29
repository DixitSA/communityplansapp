import { attributionLine, nextStatus, othersLabel, othersRevealed, privacyHint } from '../plansLogic';
import { usePlansStore } from '../plansStore';

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
});

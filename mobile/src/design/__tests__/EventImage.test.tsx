import { act, render, screen } from '@testing-library/react-native';

import { EventImage, useRevealedImages } from '..';

// The label is hidden from VoiceOver (the tap target speaks instead), so queries must include hidden elements.
const LABEL = 'Sensitive image · Tap to view';

describe('EventImage', () => {
  beforeEach(() => useRevealedImages.setState({ revealed: {} }));

  it('shows a plain image when not flagged', async () => {
    await render(<EventImage eventId="e1" source="https://example.com/a.jpg" overlay="label" />);
    expect(screen.queryByText(LABEL, { includeHiddenElements: true })).toBeNull();
  });

  it('hides a flagged image behind the label until revealed', async () => {
    await render(<EventImage eventId="e1" source="https://example.com/a.jpg" sensitive overlay="label" />);
    expect(screen.getByText(LABEL, { includeHiddenElements: true })).toBeTruthy();
    await act(async () => useRevealedImages.getState().reveal('e1'));
    expect(screen.queryByText(LABEL, { includeHiddenElements: true })).toBeNull();
  });

  it('revealing one event leaves the others hidden', async () => {
    useRevealedImages.getState().reveal('other');
    await render(<EventImage eventId="e1" source="https://example.com/a.jpg" sensitive overlay="label" />);
    expect(screen.getByText(LABEL, { includeHiddenElements: true })).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react-native';

import Index from '../index';

describe('Index screen', () => {
  it('renders the PlansApp placeholder', async () => {
    await render(<Index />);
    expect(screen.getByText('PlansApp')).toBeTruthy();
  });
});

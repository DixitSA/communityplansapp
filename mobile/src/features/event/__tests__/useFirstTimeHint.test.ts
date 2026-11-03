import { Alert } from 'react-native';

import { showHintOnce } from '../useFirstTimeHint';

const mockStore = new Map<string, string>();
jest.mock('@/lib/kv', () => ({
  kv: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mockStore.set(k, v);
    },
  },
}));

describe('showHintOnce', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('shows the explainer the first time only', async () => {
    await showHintOnce('down_if_friends');
    await showHintOnce('down_if_friends');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Down if friends go',
      expect.stringContaining('only you can see this'),
      [expect.objectContaining({ text: 'Got it' })],
    );
  });

  it('stays quiet when already seen', async () => {
    mockStore.set('hint_seen_down_if_friends', '1');
    await showHintOnce('down_if_friends');
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

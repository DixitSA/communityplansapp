import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

import { createRemoteApi } from '../remote';

it('rejects an old onboarding photo if the session changes while reading auth', async () => {
  const storage = jest.fn();
  const client = {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'new-user' } } } }) },
    storage: { from: storage },
  } as unknown as SupabaseClient<Database>;
  await expect(createRemoteApi(client).setMyAvatar('file:///old-person.jpg', 'original-user')).rejects.toMatchObject({ code: 'not_authenticated' });
  expect(storage).not.toHaveBeenCalled();
});

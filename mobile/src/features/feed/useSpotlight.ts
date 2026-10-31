import { useQuery } from '@tanstack/react-query';

import { api, CHARLOTTE_CITY_ID, demoSpotlight } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

import { CHARLOTTE_CENTER, getOrigin } from './origin';

const FIVE_MINUTES = 5 * 60 * 1000;

/** "Popping this week" for the feed's spotlight row. It ignores the feed's filters: it's what the city is doing. */
export function useSpotlight() {
  const origin = useQuery({ queryKey: ['origin'], queryFn: getOrigin, staleTime: FIVE_MINUTES, enabled: isBackendConfigured });
  const where = origin.data ?? CHARLOTTE_CENTER;
  return useQuery({
    queryKey: ['spotlight', CHARLOTTE_CITY_ID, where.lat, where.lng],
    queryFn: () => api.getSpotlight({ cityId: CHARLOTTE_CITY_ID, lat: where.lat, lng: where.lng }),
    enabled: !isBackendConfigured || origin.isFetched,
    staleTime: FIVE_MINUTES,
    // Demo data is local, so it is there on the first frame.
    initialData: isBackendConfigured ? undefined : () => demoSpotlight(),
  });
}

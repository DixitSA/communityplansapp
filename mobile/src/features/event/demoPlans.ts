import { useEffect } from 'react';

import { useFiltersStore } from '@/features/feed/filtersStore';
import { getFixtureEvents } from '@/features/feed/fixtures';
import { isBackendConfigured } from '@/lib/env';
import { startOfDay } from '@/lib/dates';

import { usePlansStore } from './plansStore';

/**
 * Dev-only, demo mode only: a screen opened with `?demoPlans=1` pre-sets one event Going, one Down if
 * and one Interested (and jumps the Feed to their day), so plan indicators and the Profile's
 * upcoming list can be screenshotted without tapping through.
 */
export function useDemoPlans(param: string | undefined) {
  const enabled = __DEV__ && !isBackendConfigured && param === '1';
  useEffect(() => {
    if (!enabled) return;
    const plans = usePlansStore.getState();
    plans.setStatus('ev-005', 'going');
    plans.setStatus('ev-004', 'down_if_friends');
    plans.setStatus('ev-003', 'interested');
    const day = getFixtureEvents(new Date()).find((e) => e.id === 'ev-005')?.startsAt;
    if (day) useFiltersStore.getState().setSelectedDay(startOfDay(day));
  }, [enabled]);
}

import { AppText, EmptyState, Screen } from '@/design';

export default function SearchScreen() {
  return (
    <Screen>
      <AppText variant="largeTitle">Search</AppText>
      <EmptyState
        symbol="magnifyingglass"
        title="Find your next plan"
        message="Search events, venues and people. Coming soon."
      />
    </Screen>
  );
}

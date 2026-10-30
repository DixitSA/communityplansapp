import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Chip,
  CodeField,
  DateStrip,
  EmptyState,
  EventCard,
  EventImage,
  EventRow,
  Facepile,
  FriendButton,
  GlassButton,
  GlassPill,
  GlassSurface,
  Icon,
  InterestTile,
  MeshArt,
  NavRow,
  PersonRow,
  PersonRowSkeleton,
  PrimaryButton,
  RollingNumber,
  Screen,
  SearchField,
  SegmentedControl,
  Skeleton,
  StepProgress,
  TextField,
  useRevealedImages,
  useTheme,
  type CardPlan,
  type DayMeta,
  type SymbolName,
  type TypeVariant,
} from '@/design';
import { EventCardLink, EventRowLink } from '@/features/event/EventCardLink';
import { getFixtureEvents } from '@/features/feed/fixtures';
import { startOfDay, toISODate } from '@/lib/dates';

// Any picture works to show the blur; the app icon ships with the bundle, so the gallery works offline.
const SAMPLE_IMAGE: number = require('../../../assets/images/icon.png');

const VARIANTS: TypeVariant[] = [
  'display', 'largeTitle', 'title', 'title2', 'headline', 'body', 'subheadline', 'footnote', 'caption', 'overline',
];
const COLOR_TOKENS = [
  'canvas', 'surface', 'surfaceMuted', 'ink', 'inkSecondary', 'line', 'accent', 'accentSoft', 'danger',
  'peach', 'peachSoft', 'mint', 'mintSoft', 'deep',
] as const;
const PEOPLE = [
  { id: '1', name: 'Maya Chen' },
  { id: '2', name: 'Jordan Lee' },
  { id: '3', name: 'Sam Ortiz' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.md, paddingTop: space.xxl }}>
      <AppText variant="overline" color="inkSecondary">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export default function Gallery() {
  const { colors, space, scheme, radius } = useTheme();
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [seg, setSeg] = useState('a');
  const [chipOn, setChipOn] = useState<Record<string, boolean>>({ accent: true });
  const [interested, setInterested] = useState(false);
  const [rowPlan, setRowPlan] = useState<CardPlan>(null);
  const [count, setCount] = useState(24);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [tiles, setTiles] = useState<Record<string, boolean>>({ music: true });
  const events = getFixtureEvents();
  const today = toISODate(new Date());
  const dayMeta: Record<string, DayMeta> = { [today]: { count: 5, friendsGoing: true } };
  const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md } as const;

  return (
    <Screen>
      <AppText variant="largeTitle">Gallery</AppText>
      <AppText variant="subheadline" color="inkSecondary">
        Scheme: {scheme}
      </AppText>

      <Section title="Colors">
        <View style={row}>
          {COLOR_TOKENS.map((c) => (
            <View key={c} style={{ width: 72, gap: space.xs }}>
              <View
                style={{
                  height: 44,
                  borderRadius: radius.thumb,
                  borderCurve: 'continuous',
                  backgroundColor: colors[c],
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              />
              <AppText variant="caption" color="inkSecondary">
                {c}
              </AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Type">
        {VARIANTS.map((v) => (
          <AppText key={v} variant={v}>
            {v} · Charlotte plans
          </AppText>
        ))}
        <AppText variant="headline" rounded>
          Rounded 0123456789
        </AppText>
      </Section>

      <Section title="Icon">
        <View style={row}>
          <Icon name="sparkles" size={28} color="accent" />
          <Icon name="heart" size={28} />
          <Icon name="heart.fill" size={28} color="accent" />
          <Icon name="bell" size={28} />
          {/* Deliberately unmapped: shows the dot fallback. */}
          <Icon name={"unmapped.symbol" as SymbolName} size={28} />
        </View>
      </Section>

      <Section title="Chip">
        <View style={row}>
          {(['accent', 'peach', 'mint'] as const).map((tone) => (
            <Chip
              key={tone}
              label={tone}
              tone={tone}
              symbol="sparkles"
              selected={!!chipOn[tone]}
              onPress={() => setChipOn((s) => ({ ...s, [tone]: !s[tone] }))}
            />
          ))}
          <Chip label="Tonight" trailingSymbol="chevron.down" selected filled />
          <Chip label="Interests" trailingSymbol="chevron.down" />
          <Chip label="Unselected" />
          <Chip label="Small tag" size="small" />
          <Chip label="Music" size="small" category="music" />
          <Chip label="Food & Drinks" size="small" category="food_drinks" />
          <Chip label="Fitness" size="small" category="fitness" />
          <Chip label="Arts" size="small" category="arts_culture" />
          <Chip label="Nightlife" size="small" category="nightlife" />
          <Chip label="Music (ring, selected)" symbol="music.note" category="music" selected ring />
          <Chip label="Music (ring, off)" symbol="music.note" ring={false} />
        </View>
      </Section>

      <Section title="PrimaryButton and RollingNumber">
        <PrimaryButton label="Continue" onPress={() => setCount((c) => c + 1)} />
        <PrimaryButton accessibilityLabel={`Show ${count} events`} onPress={() => setCount((c) => c + 7)}>
          <AppText variant="headline" color="onAccent">Show</AppText>
          <RollingNumber value={count} color="onAccent" />
          <AppText variant="headline" color="onAccent">events (tap to roll)</AppText>
        </PrimaryButton>
        <PrimaryButton label="Disabled" disabled onPress={() => {}} />
      </Section>

      <Section title="Button (icon, primary and secondary)">
        <Button variant="primary" symbol="message.fill" label="Open chat" onPress={() => {}} />
        <Button symbol="calendar.badge.plus" label="Add to Calendar" onPress={() => {}} />
      </Section>

      <Section title="TextField (idle, prefix, success, checking, error)">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <TextField label="Username" prefix="@" value="maya.c" onChangeText={() => {}} status={{ tone: 'success', text: '@maya.c is available' }} />
        <TextField label="Username" prefix="@" value="maya" onChangeText={() => {}} status={{ tone: 'checking', text: 'Checking…' }} />
        <TextField label="Email" value="maya@example" onChangeText={() => {}} status={{ tone: 'error', text: 'That email doesn’t look right.' }} />
      </Section>

      <Section title="CodeField (type 6 digits; second one shows the error state)">
        <CodeField value={code} onChangeText={setCode} autoFocus={false} />
        <CodeField value="123" onChangeText={() => {}} error autoFocus={false} />
      </Section>

      <Section title="InterestTile (tap to select)">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {([['music', 'Music', 'music.note'], ['sports', 'Sports', 'sportscourt.fill']] as const).map(([slug, label, symbol]) => (
            <InterestTile
              key={slug}
              slug={slug}
              label={label}
              symbol={symbol}
              selected={!!tiles[slug]}
              onPress={() => setTiles((t) => ({ ...t, [slug]: !t[slug] }))}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {([['comedy', 'Comedy', 'theatermasks.fill'], ['wellness', 'Wellness', 'leaf.fill']] as const).map(([slug, label, symbol]) => (
            <InterestTile key={slug} slug={slug} label={label} symbol={symbol} selected={slug === 'comedy'} onPress={() => {}} />
          ))}
        </View>
      </Section>

      <Section title="StepProgress">
        <View style={{ flexDirection: 'row' }}>
          <StepProgress step={2} />
        </View>
      </Section>

      <Section title="GlassSurface (RSVP bar backing)">
        <GlassSurface style={{ padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' }}>
          <AppText variant="subheadline">Glass on iOS 26, solid canvas elsewhere or with Reduce Transparency.</AppText>
        </GlassSurface>
      </Section>

      <Section title="Avatar and Facepile">
        <View style={row}>
          <Avatar name="Maya Chen" size={40} />
          <Avatar name="Jordan Lee" size={40} />
          <Avatar name="Sam" size={40} />
        </View>
        <Facepile people={PEOPLE.slice(0, 1)} total={1} />
        <Facepile people={PEOPLE.slice(0, 2)} total={2} />
        <Facepile people={PEOPLE} total={5} />
        <AppText variant="caption" color="inkSecondary">
          Compact (list rows): friends&apos; faces and +N, or &ldquo;N going&rdquo; with no friends
        </AppText>
        <View style={row}>
          <Facepile people={PEOPLE} total={12} compact />
          <Facepile people={PEOPLE.slice(0, 1)} total={1} compact />
          <Facepile people={[]} total={7} compact />
        </View>
      </Section>

      <Section title="SearchField">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search people" />
      </Section>

      <Section title="FriendButton (regular: the profile's main button)">
        <FriendButton state="none" name="Maya" onAction={() => undefined} />
        <FriendButton state="outgoing" name="Maya" onAction={() => undefined} />
        <FriendButton state="incoming" name="Maya" onAction={() => undefined} />
        <FriendButton state="friends" name="Maya" onAction={() => undefined} />
        <FriendButton state="none" name="Maya" busy onAction={() => undefined} />
      </Section>

      <Section title="PersonRow with compact FriendButton (Search, Friends)">
        <View>
          <PersonRow name="Maya Chen" username="maya.chen" onPress={() => undefined} trailing={<FriendButton size="compact" state="none" name="Maya Chen" onAction={() => undefined} />} />
          <PersonRow name="Jordan Lee" username="jordan.lee" onPress={() => undefined} trailing={<FriendButton size="compact" state="outgoing" name="Jordan Lee" onAction={() => undefined} />} />
          <PersonRow name="Priya Nair" username="priya.nair" onPress={() => undefined} trailing={<FriendButton size="compact" state="incoming" name="Priya Nair" onAction={() => undefined} />} />
          <PersonRow name="Sam Ortiz" username="sam.ortiz" onPress={() => undefined} trailing={<FriendButton size="compact" state="friends" name="Sam Ortiz" onAction={() => undefined} />} />
        </View>
        <AppText variant="caption" color="inkSecondary">
          A request, with Accept and Decline on their own line
        </AppText>
        <PersonRow name="Noah Kim" username="noah.kim" subtitle="@noah.kim · 2d ago" />
        <View style={{ paddingLeft: 48 + space.md }}>
          <FriendButton size="compact" state="incoming" showDecline name="Noah Kim" onAction={() => undefined} />
        </View>
      </Section>

      <Section title="PersonRowSkeleton">
        <PersonRowSkeleton count={2} />
      </Section>

      <Section title="NavRow (with and without the unread dot)">
        <NavRow symbol="bell" label="Activity" unread onPress={() => undefined} />
        <NavRow symbol="person.2" label="Friends and requests" onPress={() => undefined} />
      </Section>

      <Section title="MeshArt">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {(['music', 'food_drinks', 'fitness', 'arts_culture', 'nightlife'] as const).map((k, i) => (
            <View key={k} style={{ flex: 1, height: 96, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
              <MeshArt id={`gallery-${i}`} interest={k} symbol="sparkles" />
            </View>
          ))}
        </View>
      </Section>

      <Section title="GlassButton">
        <View style={row}>
          <GlassButton symbol="chevron.left" accessibilityLabel="Back" />
          <GlassButton symbol="square.and.arrow.up" accessibilityLabel="Share" />
          <GlassButton symbol="bell" accessibilityLabel="Notifications" />
          <GlassButton symbol="heart" iconColor="onImage" overImage accessibilityLabel="Save" />
        </View>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          options={[{ value: 'a', label: 'Nearby' }, { value: 'b', label: 'Friends' }]}
          value={seg}
          onChange={setSeg}
        />
        <SegmentedControl
          options={[{ value: 'a', label: 'Day' }, { value: 'b', label: 'Week' }, { value: 'c', label: 'Month' }]}
          value={seg}
          onChange={setSeg}
        />
      </Section>

      <Section title="DateStrip">
        <View style={{ marginHorizontal: -space.lg }}>
          <DateStrip selected={selectedDay} onSelect={setSelectedDay} dayMeta={dayMeta} />
        </View>
      </Section>

      <Section title="Skeleton">
        <View style={{ gap: space.sm }}>
          <Skeleton height={160} radius={radius.sheet} />
          <Skeleton width="60%" />
          <Skeleton width="40%" height={12} />
        </View>
      </Section>

      <Section title="EmptyState">
        <EmptyState symbol="sparkles" title="Nothing planned yet" message="Try another date." />
      </Section>

      <Section title="EventRow (agenda row; quick plan menu on the right)">
        <EventRow event={{ ...events[4], goingCount: 14 }} plan={rowPlan} onSetPlan={setRowPlan} />
        <EventRow event={events[1]} plan="interested" />
        {/* Time line variants: past-midnight range above, no end time here. */}
        <EventRow event={{ ...events[3], endsAt: undefined }} />
        <EventRow event={events[3]} plan="down_if_friends" />
        <EventRow event={{ ...events[2], title: 'Lunchtime Food Truck Rally with a very long title that wraps' }} plan="going" />
        {/* Opens the event page with the zoom transition; the plan menu shares the plans store. */}
        <EventRowLink event={events[5]} />
      </Section>

      <Section title="GlassPill (the agenda's Today button)">
        <View style={row}>
          <GlassPill label="Today" onPress={() => undefined} />
        </View>
      </Section>

      <Section title="EventCard">
        <EventCard
          event={events[4]}
          plan={interested ? 'interested' : null}
          onToggleInterested={() => setInterested((s) => !s)}
        />
        <EventCard event={events[1]} plan="down_if_friends" />
        <EventCard event={events[3]} plan="going" />
        {/* Opens the event page with the zoom transition; the corner indicator shares the plans store. */}
        <EventCardLink event={events[2]} />
      </Section>

      <Section title="EventImage (flagged images blur until revealed; tap the label to reveal both)">
        {/* Cards and rows: blurred with an eye-slash badge (the card's tap still opens the event). */}
        <View style={{ height: 120, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
          <EventImage eventId="gallery-sensitive" source={SAMPLE_IMAGE} sensitive />
        </View>
        {/* Event page hero: the label; tapping it reveals the image everywhere for this session. */}
        <Pressable
          onPress={() => useRevealedImages.getState().reveal('gallery-sensitive')}
          accessibilityRole="button"
          accessibilityLabel="Sensitive image. Show image"
          style={{ height: 180, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}
        >
          <EventImage eventId="gallery-sensitive" source={SAMPLE_IMAGE} sensitive overlay="label" />
        </Pressable>
      </Section>
    </Screen>
  );
}

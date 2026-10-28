# Design

**The app is called yard.** Its visual direction is the owner's v2 mockup, `design/reference/mockups-v2-yard.webp` (Discover, Map, Event):
- warm cream canvas, deep forest green
- photo-first cards with text on the image
- the lowercase **yard.** wordmark and the line **"Find your people."**

The v1 HTML mockups (`mockups-v1.html`) are superseded and kept only for history.

This document sets the **bar**. Follow the v2 direction's look, and apply the interaction upgrades below. They come from the best iOS apps shipping today.

**North star: it should feel like Apple built a social app.** Native first, content first, quietly delightful, and never another engagement-bait feed.

The app is built with Expo, but it must not *look* cross-platform. Wherever iOS has a native component (tabs, sheets, menus, link previews, Liquid Glass, SF Symbols, Apple Maps), use the native one through Expo. §9 maps every technique here to its implementation.

---

## 1. Principles

1. **Content is the interface.** Event imagery and friends' faces carry the screen. Chrome recedes. No decorative borders or boxes around boxes.
2. **Names beat numbers.** "Maya, Jordan + 3 friends" beats "5 going". Social context is the product, so show it as people.
3. **Calm by default, joyful on commitment.** Browsing is quiet. Tapping **Going** is a celebration with haptics, motion and the ✦ sparkle.
4. **One thumb.** Primary actions sit in the bottom third: the RSVP bar, map carousel, chat composer, sheet buttons.
5. **Native, not themed.** Use native iOS navigation, tabs, sheets, menus and Liquid Glass, and build custom components only where they earn it. System behavior (text size, dark mode, VoiceOver, Reduce Motion) must keep working.
6. **Privacy you can feel.** Every RSVP state says who will see it, right where you choose it.

## 2. References: what we take from each

| App | Take this | Where it shows up |
|---|---|---|
| **Apple Invites** | Full-bleed event hero, background tinted from the image, RSVP pinned to the bottom | Event detail |
| **Apple Calendar** | Snapping week strip with density dots; swipe the day content to change day | Feed date strip |
| **Apple Maps / Find My** | Full-screen map + persistent sheet with detents; place cards | Map |
| **Partiful** | Personality in RSVP moments, guest-list facepiles, celebratory confirmation | Going moment, attendee list |
| **Airbnb** | Image-first cards, heart-to-save with bounce, shared-element card → detail | Feed cards, transitions |
| **Luma** | Clean information hierarchy on event pages; add-to-calendar | Event detail info rows |
| **iMessage** | Chat conventions people already know: tapbacks, swipe-to-reply, grouped bubbles | Event chat |
| **Flighty** | Live Activities and dense-but-calm status info | Event-day Live Activity (v1.1) |
| **Apple Music / Sports** | Dynamic color from artwork, big confident type | Detail hero, chat header |
| **Things 3** | Interaction polish: springs, sheets, haptics that feel physical | Everywhere |

Take patterns, not assets. Never reuse another app's icons, illustrations or copy.

## 3. Design tokens

Defined once in `mobile/src/design/` and read through `useTheme()`. Screens never use raw colors, font sizes or numbers.

### Color
The yard palette, checked for **WCAG AA**: text ≥ 4.5:1, glyphs on solid pins and chips ≥ 3:1.

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F6F3EC` | `#101411` | Screen background (warm cream) |
| `surface` | `#FFFFFF` | `#1A1F1B` | Cards, sheets |
| `surfaceMuted` | `#ECE8DF` | `#232A25` | Segmented track, inputs, unselected chips |
| `ink` | `#16201A` | `#EEF2EE` | Primary text |
| `inkSecondary` | `#5E665F` (5.4:1) | `#A3ADA5` (8.0:1) | Secondary text |
| `line` | `#E4E0D6` | `#2C342E` | Hairlines (use sparingly) |
| `accent` | `#2E5B45` forest green (7.8:1 w/ white) | `#7FC3A0` | Selected states, primary buttons, active tab, Going |
| `accentSoft` | `#DCE9E0` | `#1F3328` | Soft selection, "Down if friends go" selected state |

**Category colors** are used for interest tags, map pins and placeholder art:

| Interest | Solid (pins, ≥ 3:1 w/ white) | Tag background |
|---|---|---|
| Music | `#D9722A` | `#FDE7D6` |
| Food & Drinks | `#8E6FD1` | `#ECE5FA` |
| Fitness | `#3F8F5F` | `#DDF0E3` |
| Arts & Culture | `#B87A30` | `#FBEBD6` |
| Nightlife | `#C9567A` | `#FBE1EA` |
| Others | `inkSecondary` | `surfaceMuted` |

**Dynamic event tint.** On event detail and chat headers, use a desaturated version of the event image's dominant color as the background wash, the way Apple Invites and Apple Music do.
- Compute the color server-side during ingestion and store it on the event (a later migration), so the client never has to process the image.
- Clamp it so text stays AA.

**Plan states:**
- **Interested:** ♡ heart outline, filled when chosen (the same glyph on cards, the RSVP row and Profile "Saved").
- **Down if friends go:** a two-person glyph, with an `accentSoft` fill when chosen.
- **Going:** ✓ on a filled `accent` button.

The same treatment applies everywhere these states appear.

**Social labels say "going", never "interested"** ("Maya + 3 going"). Interested is private.

### Type
The system font (SF Pro), with a scale that mirrors iOS text styles (largeTitle 34, title2 22, headline 17 semibold, body 17, subheadline 15, footnote 13, caption 12). Text scales with the user's text-size setting: keep `allowFontScaling` on and cap only tight chrome with `maxFontSizeMultiplier`.
- Titles are bold with slightly tightened letter spacing, matching the mockups' confident headlines.
- Numerals in the date strip, counts and countdowns use `fontFamily: 'ui-rounded'` + `fontVariant: ['tabular-nums']`.
- Overlines (the mockups' small caps such as "UPCOMING EVENTS") are caption, semibold, uppercase, `letterSpacing: 1.2`.

### Shape, spacing, depth
- Spacing scale: `4 · 8 · 12 · 16 · 20 · 24 · 32`. The screen gutter is 16.
- Radii: `12` (thumbnails), `16` (cards), `22` (sheet cards), `28` (hero cards), and capsules for chips. Always use `borderCurve: 'continuous'` for Apple's squircle corners.
- Depth: content is flat. Only floating controls use **Liquid Glass** (see §5). Shadows are limited to one soft card shadow, used only in light mode.

### Iconography
**SF Symbols** via `expo-symbols`, using the `interests.symbol` column from the database. Use symbol animations (bounce on toggle, replace on state change). The ✦ sparkle is the brand motif: use it for celebration, not decoration.

### Placeholder art
Curated events often lack good images. Generate art with **`expo-mesh-gradient`**, seeded from the event ID, using the interest's palette and a large SF Symbol. Every card then looks intentional, and the gradient vibe from the mockups carries over.

## 4. Signature interactions

These are what make the app feel exceptional rather than merely fine.

1. **Living date strip.** Weeks snap horizontally.
   - Each day shows density dots: one per few events, and an accent-green dot if a friend is going.
   - Selecting a day plays a selection haptic and slides the capsule highlight with a spring.
   - The **day's feed is itself swipeable** horizontally, synced to the strip, like Calendar's day view.
   - A "Today" pill appears when you scroll away.
2. **Card → detail zoom.** The native iOS zoom transition: the card's image grows into the hero, and swiping down dismisses it interactively.
3. **Long-press preview.** A native context menu with a live preview of the event and quick actions: Going, Interested, Share, Directions. Power users never need to open the detail page.
4. **RSVP row (per the v2 mockup).** Three equal buttons pinned at the bottom of the event page: **♡ Interested · 👥 Down if friends go · ✓ Going**.
   - Going is the filled `accent` button. The others are `surface` buttons with a hairline border.
   - The selected state fills in, with a symbol bounce and a haptic.
   - After you choose, a one-line privacy hint appears under the row ("Only you can see this" / "Friends and other attendees can see this").
   - Once you're Going, the Going button becomes **"Going · Open chat"**.
5. **The Going moment.**
   - Success haptic, then a ✦ particle burst (honors Reduce Motion).
   - A ticket-style card for the event, with actions: Open chat, Add to Calendar, Invite a friend.
   - It's a sheet, not a full page, so you're never pulled out of browsing.
6. **"Go to see who's going."** On event detail, friends show by name and face. Other attendees appear as a blurred facepile ("+14 others") until you commit. The privacy rule becomes the motivation.
7. **Map like Apple Maps.**
   - A filter row above the map matches the feed (Tonight · Interests · 10 mi · List).
   - Pins use the **category color** with the interest's SF Symbol. Friends going show as avatar pins. A blue dot marks you.
   - A full-screen Apple Map with a persistent sheet in three detents:
     - **Peek:** "24 events · Wed".
     - **Medium:** a horizontal card carousel synced to the selected pin.
     - **Large:** the full list.
   - Pins are rounded glyph pins using the interest symbol. When friends are going, the pin shows a friend's avatar. Pins cluster, and the selected pin springs up.
8. **Live filter count.** The filter sheet's button reads "Show 24 events", and the number rolls as you change filters.
9. **Chat that feels like iMessage.**
   - Grouped bubbles, tapbacks, swipe-to-reply.
   - A pinned glass header shows the event image tint, "Tonight · in 3h", and a Directions shortcut.
   - The chat list uses event thumbnails with countdown badges (Tonight / Fri). Past events collapse into an Archived section.
10. **After the night: "Who did you meet?"** The morning after an event, a gentle card shows fellow attendees (you could already see them, since you both went) with one-tap friend requests. **This is the loop that turns events into friendships.** It's cheap to build and core to the product.

**Motion and haptics.** Use springs, not linear easing. Add subtle scroll-linked scale and opacity on cards. Haptics: selection (date, chip), light impact (heart), success (Going, friend accepted), warning (block/report confirm). Never haptics on scroll.

## 5. Liquid Glass rules (iOS 26)

- **Use it on:**
  - The tab bar (free with `NativeTabs`).
  - Floating buttons over the hero and the map (back, share, locate).
  - The RSVP bar.
  - The chat header and composer.
  - Sheet toolbars.
- **Never on:** content cards, list rows, or text-heavy surfaces.
- Tint glass with `accent` only for the single primary action on screen.
- Group adjacent glass controls in a `GlassContainer` so they merge and morph.
- Known gotcha: never animate a `GlassView` (or its parent) to `opacity: 0`, because the glass stops rendering. Use its built-in `animate` prop instead.
- Test with Reduce Transparency and Increase Contrast. Fallbacks must stay legible.
- Tab bar: **Feed · Chats · Profile**, plus iOS 26's separated search tab (native tabs `role: 'search'`) for searching events and people.

## 6. Screen inventory

The 11 mockup screens, each with its upgrade, plus the 7 missing screens v1 needs.

| # | Screen | Upgrade over mockup |
|---|---|---|
| 01 | Welcome | Slowly animating mesh-gradient blob with a ✦. Sign in with Apple as the primary button. |
| 02 | Interests | Large tactile tiles with SF Symbols. Selected tiles fill with the interest color, with a bounce and a haptic. The Continue button shows "Pick 3+" until valid. |
| 03 | Location | A priming screen *before* the system prompt. A real Apple Map preview of Charlotte neighborhoods. "City only" fallback. |
| 04 | Feed | **Header:** the `yard.` wordmark, a "📍 Charlotte, NC ⌄" city picker and a bell. **Controls:** a full-width Nearby/Friends segmented control (selected segment filled green) and the headline **"Find your people."**. **Date strip:** day pills with a filled green selected day. **Filter row:** Tonight ⌄ · Interests ⌄ · 10 mi ⌄ · map button. **Cards:** photo cards with text on a gradient scrim, the category tag bottom-right, the heart top-right, and "Maya + 3 going" with faces. The day is swipeable. |
| 05 | Map | Same header and filter row as the feed. Category-colored pins, friend-avatar pins, an Apple Maps-style sheet with detents and a synced carousel. |
| 06 | Event detail | Zoom transition into a full-bleed photo hero with glass back / share / ··· buttons. A content sheet with rounded top corners overlaps the hero and holds:
- the title, date and time, a 📍 venue with distance, and category tags
- a **Hosted by** row (organizer or venue for API and curated events)
- a friends row ("Maya + 3 friends going")
- the description
- the three-button RSVP row

The stretchy hero and source attribution stay. |
| 07 | Going | Becomes a celebratory **sheet** (see §4.5), not a page. |
| 08 | Event chat | iMessage conventions, a glass header with a countdown, Report/Block in the ··· menu (required by App Store guideline 1.2). |
| 09 | Chats list | Event thumbnails, countdown badges, unread dots, a collapsible Archived section. |
| 10 | Profile | Upcoming plans as a horizontal ticket stack, interest chips, a friends count that leads to a friends list, settings moved to the gear. |
| 11 | Filters | Native form sheet with detents, a stepped distance slider with haptic ticks, a live count button. |
| 12 | **Sign up / profile basics** | Name, @username (availability checked live), photo (picker + crop), birthdate (18+ gate). |
| 13 | **Find friends** | Contacts permission (limited access where iOS offers it), hashed matching, invite via share sheet. Skippable. |
| 14 | **Other user's profile** | Mutual friends, shared past events ("You both went to…"), an Add Friend button with clear states. |
| 15 | **Friends & requests** | Requests at top with Accept/Decline, then the friends list and search. |
| 16 | **Activity** | Friend going (from "Down if"), requests, accepts, "Who did you meet?" prompts. Reached from a bell in the Feed header. |
| 17 | **Settings & privacy** | Who can see my plans (explained), discoverable by phone, blocked users, notifications, **delete account** (App Store requirement). |
| 18 | **Empty & error states** | Every list has one: no events today (suggest the next busy day / expand radius), no friends yet (find friends), offline. |

## 7. Accessibility and quality bar

- Every screen works at the largest accessibility text size. Cards reflow vertically, and nothing truncates important information.
- VoiceOver: cards read as a single element (`accessible` + `accessibilityLabel`), for example "Warehouse Party, Wednesday 9 PM, The District, 2.1 miles. Bob and Carol are going." `accessibilityActions` cover Save and Going.
- Dark mode is first-class, not an afterthought. Many sessions happen at night, before going out.
- Honor Reduce Motion (Reanimated `useReducedMotion`) and Reduce Transparency (`AccessibilityInfo`).
- The **dev gallery** route (`(dev)/gallery`) renders every design-system component in light, dark and large text. Check it on your phone after design-system changes, and send Claude a screenshot.
- Perceived performance: show cached feed data instantly, then refresh. Use skeletons, not spinners.

## 8. Copy voice

The tagline is **"Find your people."** Warm, short, a little playful, and never pushy. Lowercase charm is allowed in moments ("a good plan just became a real plan"), but labels stay clear ("Going", not "I'm so in!!"). Never guilt-trip ("Your friends are going without you").

## 9. Implementation map (Expo SDK 58)

| Technique | Implementation |
|---|---|
| Tab bar with Liquid Glass, search tab | `NativeTabs` from `expo-router/native-tabs` |
| Card → detail zoom | `Link.AppleZoom` (Expo Router, iOS 18+) |
| Long-press preview + menu | `Link.Preview` + `Link.Menu` (Expo Router) |
| Sheets with detents (filters, Going) | Route with `presentation: 'formSheet'`, `sheetAllowedDetents` |
| Persistent map sheet | `@expo/ui` `BottomSheet` over `expo-maps` (Apple Maps) |
| Glass buttons/bars | `GlassView` / `GlassContainer` from `expo-glass-effect` |
| Native toggles, pickers, segmented control, slider | `@expo/ui` SwiftUI components |
| SF Symbols + symbol animations | `expo-symbols` |
| Mesh-gradient placeholder art | `expo-mesh-gradient` |
| Springs, scroll-linked effects, number roll, particle burst | `react-native-reanimated` 4 |
| Snapping week strip / day paging | Horizontal `FlatList` with `pagingEnabled` / `snapToInterval`, synced via shared state |
| Haptics | `expo-haptics` (`selectionAsync`, `impactAsync`, `notificationAsync`) |
| Images with caching + blurhash placeholders | `expo-image` |
| Skeleton loading | `Skeleton` component in `src/design` (Reanimated shimmer, still under Reduce Motion) |
| Add to Calendar | `expo-calendar` |
| Share | React Native `Share` API (system share sheet) |

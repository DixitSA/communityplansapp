import { AbsoluteFill, Audio, Easing, Sequence, Series, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { Burst, Caption, Screen, Tap, at, useEnter } from './components';
import { Messages, type Msg } from './Messages';
import { BEAT, PT, SCENES, STATUS_BAR, colors, font } from './theme';

// Scene start frames, for the sound effects.
const S = (() => {
  let t = 0;
  const out = {} as Record<keyof typeof SCENES, number>;
  for (const [k, v] of Object.entries(SCENES)) {
    out[k as keyof typeof SCENES] = t;
    t += v;
  }
  return out;
})();

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const THREAD: Msg[] = [
  { at: 25, from: 'them', text: "it's friday. wtm?", typing: 16 },
  { at: 58, from: 'me', text: "idk everything's kinda dead" },
  { at: 100, from: 'them', text: "nah there's literally so much going on", typing: 20 },
  { at: 132, from: 'them', card: true },
  { at: 172, from: 'me', text: "wait maya's going??" },
  { at: 200, from: 'me', text: 'say less' },
];

/** 1. The group chat. Ends by pushing into the app on the drop. */
function Texts() {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [SCENES.texts - 10, SCENES.texts], [1, 1.12], clamp);
  const fade = interpolate(frame, [SCENES.texts - 6, SCENES.texts], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: '#FFF' }}>
      <AbsoluteFill style={{ transform: `scale(${out})` }}>
        <Messages messages={THREAD} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: colors.canvas, opacity: fade }} />
    </AbsoluteFill>
  );
}

/** Push in from the right, like opening a screen. */
function usePush() {
  const s = useEnter(0, { damping: 20, stiffness: 170 });
  return { transform: `translateX(${interpolate(s, [0, 1], [380, 0])}px)`, opacity: Math.min(1, s * 1.6) };
}

const WAREHOUSE_ROW_PT = 913; // "Warehouse Party" in the feed's tomorrow list (full capture)
const FEED_SCROLL = 1500;

/** 2. The feed, scrolled like a screen recording. */
function Feed() {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [22, 90], [0, FEED_SCROLL], { ...clamp, easing: Easing.bezier(0.3, 0.0, 0.1, 1) });
  const zoomIn = interpolate(useEnter(0, { damping: 18 }), [0, 1], [1.08, 1]);
  const row = at(196, WAREHOUSE_ROW_PT);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoomIn})` }}>
      <Screen src="feed-full.png" scroll={scroll} statusBg={colors.canvas}>
        <Tap x={row.x} y={row.y} at={106} />
      </Screen>
      <Caption text="every event in charlotte. one feed." at={6} top={1580} />
    </AbsoluteFill>
  );
}

const EVENT_SCROLL = 569; // bottom of the event page lines up with the bottom of the frame
const FRIENDS = { top: 625, bottom: 685, left: 16, right: 377 }; // pt, the "friends going" row
const GOING = { x: 349, y: 771 }; // pt, the Going button

/** 3. The event page: who's going. */
function Event() {
  const frame = useCurrentFrame();
  const push = usePush();
  const scroll = interpolate(frame, [40, 64], [0, EVENT_SCROLL], { ...clamp, easing: Easing.bezier(0.3, 0.0, 0.1, 1) });
  const ring = useEnter(66, { damping: 10, stiffness: 180 });
  const pulse = 1 + Math.sin(frame / 4) * 0.01;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={push}>
        <Screen src="event-open.png" scroll={scroll} statusBg="#000" statusTone="light">
          <div
            style={{
              position: 'absolute',
              left: FRIENDS.left * PT - 12,
              width: (FRIENDS.right - FRIENDS.left) * PT + 24,
              top: STATUS_BAR + FRIENDS.top * PT - 12,
              height: (FRIENDS.bottom - FRIENDS.top) * PT + 24,
              borderRadius: 52,
              border: `8px solid ${colors.hot}`,
              boxShadow: `0 0 0 16px ${colors.hot}30`,
              opacity: ring,
              transform: `scale(${interpolate(ring, [0, 1], [1.12, 1]) * pulse})`,
            }}
          />
        </Screen>
      </AbsoluteFill>
      <Caption text="and who's actually going 👀" at={68} top={330} />
    </AbsoluteFill>
  );
}

/** 4. Tap Going. */
function Going() {
  const frame = useCurrentFrame();
  const g = at(GOING.x, GOING.y);
  const y = g.y - EVENT_SCROLL;
  const press = interpolate(frame, [12, 15, 22], [1, 0.97, 1], clamp);
  const banner = useEnter(30, { damping: 16, stiffness: 150 });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${press})`, transformOrigin: `${g.x}px ${y}px` }}>
        <Screen src="event-open.png" scroll={EVENT_SCROLL} statusBg="#000" statusTone="light" />
      </AbsoluteFill>
      <Tap x={g.x} y={y} at={14} />
      <Burst x={g.x} y={y} at={16} />
      {/* an in-app style toast */}
      <div
        style={{
          position: 'absolute',
          top: STATUS_BAR + 20,
          left: 40,
          right: 40,
          padding: '30px 36px',
          borderRadius: 40,
          background: 'rgba(255,255,255,0.96)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          fontFamily: font,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          transform: `translateY(${interpolate(banner, [0, 1], [-360, 0])}px)`,
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: 24,
            background: colors.accent,
            color: '#FFF',
            fontSize: 40,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          y.
        </div>
        <div>
          <div style={{ fontSize: 40, fontWeight: 800, color: colors.ink }}>you're Going 🎉</div>
          <div style={{ fontSize: 34, color: colors.inkSecondary, marginTop: 4 }}>Warehouse Party chat unlocked</div>
        </div>
      </div>
      <Caption text="tap Going → you're in the group chat" at={40} top={880} />
    </AbsoluteFill>
  );
}

/** 5. The event chat. */
function Chat() {
  const push = usePush();
  return (
    <AbsoluteFill style={{ background: '#FBE1EA' }}>
      <AbsoluteFill style={push}>
        <Screen src="chat.png" statusBg="rgb(251,225,234)" />
      </AbsoluteFill>
      <Caption text="where the plan actually happens" at={10} top={1560} />
    </AbsoluteFill>
  );
}

/** 6. Back in the texts. */
function Callback() {
  const thread: Msg[] = [
    ...THREAD.map((m) => ({ ...m, at: m.at - 400, typing: undefined })),
    { at: 4, from: 'me', text: "ok i'm Going" },
    { at: 34, from: 'them', text: 'bet. see u at 9 🔥', typing: 14 },
  ];
  return (
    <AbsoluteFill>
      <Messages messages={thread} />
    </AbsoluteFill>
  );
}

/** 7. The end card, slammed in on the downbeat. */
function End() {
  const frame = useCurrentFrame();
  const mark = useEnter(0, { damping: 11, stiffness: 260 });
  const line = useEnter(BEAT * 2, { damping: 14 });
  const foot = useEnter(BEAT * 4, { damping: 18 });
  const shake = frame < 8 ? Math.sin(frame * 3) * (8 - frame) * 1.5 : 0;
  return (
    <AbsoluteFill style={{ background: colors.canvas, transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
        <div
          style={{
            fontSize: 330,
            fontWeight: 900,
            letterSpacing: -16,
            color: colors.accent,
            transform: `scale(${interpolate(mark, [0, 1], [1.6, 1])})`,
            opacity: Math.min(1, mark * 2),
          }}
        >
          yard<span style={{ color: colors.hot }}>.</span>
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: colors.ink,
            letterSpacing: -2,
            opacity: line,
            transform: `translateY(${interpolate(line, [0, 1], [30, 0])}px)`,
          }}
        >
          know the move.
        </div>
        <div style={{ position: 'absolute', bottom: 230, fontSize: 40, fontWeight: 600, color: colors.inkSecondary, opacity: foot }}>
          charlotte · coming soon to the App Store
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Sound effects, placed on the full timeline. */
const SFX: { file: string; at: number; volume?: number }[] = [
  { file: 'sfx-receive.wav', at: 25 },
  { file: 'sfx-send.wav', at: 58 },
  { file: 'sfx-receive.wav', at: 100 },
  { file: 'sfx-receive.wav', at: 132 },
  { file: 'sfx-send.wav', at: 172 },
  { file: 'sfx-send.wav', at: 200 },
  { file: 'sfx-tap.wav', at: S.feed + 106 },
  { file: 'sfx-tap.wav', at: S.going + 14 },
  { file: 'sfx-sparkle.wav', at: S.going + 16, volume: 0.8 },
  { file: 'sfx-send.wav', at: S.callback + 4 },
  { file: 'sfx-receive.wav', at: S.callback + 34 },
];

export function Trailer() {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('music.wav')} volume={0.9} />
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.at} durationInFrames={30}>
          <Audio src={staticFile(s.file)} volume={s.volume ?? 0.7} />
        </Sequence>
      ))}
      <Series>
        <Series.Sequence durationInFrames={SCENES.texts}>
          <Texts />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.feed}>
          <Feed />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.event}>
          <Event />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.going}>
          <Going />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.chat}>
          <Chat />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.callback}>
          <Callback />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.end}>
          <End />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}

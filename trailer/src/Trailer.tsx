import { AbsoluteFill, Img, Series, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { Centered, Phone, Words, useEnter } from './components';
import { SCENES, colors, font } from './theme';

const PAD = 90;

/** 1. The hook: the question every group chat asks. */
function Hook() {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, SCENES.hook], [0.9, 1.15]);
  return (
    <AbsoluteFill style={{ background: colors.night }}>
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: `radial-gradient(circle at 30% 40%, ${colors.accent}aa 0%, transparent 45%), radial-gradient(circle at 75% 70%, ${colors.hot}88 0%, transparent 40%)`,
          transform: `scale(${glow})`,
        }}
      />
      <Centered style={{ alignItems: 'flex-start', padding: PAD }}>
        <Words text="it's friday night." size={128} color="#FFFFFF" />
        <Words text="what are we doing?" size={128} color={colors.peach} delay={26} style={{ marginTop: 24 }} />
      </Centered>
    </AbsoluteFill>
  );
}

const MONTAGE = [
  { img: 'music-1.jpg', word: 'live music' },
  { img: 'food_drinks-1.jpg', word: 'food trucks' },
  { img: 'nightlife-1.jpg', word: 'warehouse parties' },
  { img: 'sports-1.jpg', word: 'game day' },
  { img: 'arts_culture-1.jpg', word: 'art nights' },
];

/** 2. Quick cuts of the city. */
function Montage() {
  const frame = useCurrentFrame();
  const per = Math.ceil(SCENES.montage / MONTAGE.length);
  const i = Math.min(MONTAGE.length - 1, Math.floor(frame / per));
  const local = frame - i * per;
  const shot = MONTAGE[i];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img
        src={staticFile(shot.img)}
        style={{
          position: 'absolute',
          height: '100%',
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(local, [0, per], [1.08, 1.2])})`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.75) 100%)' }} />
      <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 260, fontFamily: font, color: '#FFFFFF' }}>
        <div style={{ fontSize: 64, fontWeight: 600, opacity: 0.9 }}>charlotte has</div>
        <div key={i} style={{ fontSize: 132, fontWeight: 900, letterSpacing: -4, lineHeight: 1 }}>
          <Words text={shot.word} size={132} color="#FFFFFF" stagger={2} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** A canvas scene: a kinetic caption on top and a phone rising from below. */
const PHONE_W = 720;
const PHONE_TOP = 560;
const SCREEN_H = (PHONE_W * 1704) / 786;
const BEZEL = PHONE_W * 0.03;

/**
 * `highlight` pans the phone up at `from` and rings a band of the screen, given as fractions of the
 * 393×852 pt screen (top/bottom) — e.g. the "friends going" row on the event page.
 */
function PhoneScene({
  caption,
  accent,
  src,
  highlight,
}: {
  caption: string;
  accent?: string;
  src: string;
  highlight?: { from: number; top: number; bottom: number; pan: number };
}) {
  const frame = useCurrentFrame();
  const rise = useEnter(4, { damping: 18, stiffness: 90 });
  const pan = highlight
    ? interpolate(frame, [highlight.from, highlight.from + 22], [0, highlight.pan], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  // Always call the hook (rules of hooks); without a highlight it's simply unused.
  const ringIn = useEnter((highlight?.from ?? 0) + 18, { damping: 10, stiffness: 160 });
  const ring = highlight ? ringIn : 0;
  const pulse = 1 + Math.sin(frame / 5) * 0.012;
  return (
    <AbsoluteFill style={{ background: colors.canvas, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: PHONE_TOP,
          transform: `translate(-50%, ${interpolate(rise, [0, 1], [1400, 0]) - pan}px)`,
        }}
      >
        <Phone src={src} width={PHONE_W} />
        {highlight ? (
          <div
            style={{
              position: 'absolute',
              left: BEZEL + PHONE_W * 0.02,
              right: BEZEL + PHONE_W * 0.02,
              top: BEZEL + SCREEN_H * highlight.top - 14,
              height: SCREEN_H * (highlight.bottom - highlight.top) + 28,
              borderRadius: 44,
              border: `8px solid ${colors.hot}`,
              boxShadow: `0 0 0 14px ${colors.hot}33`,
              opacity: ring,
              transform: `scale(${interpolate(ring, [0, 1], [1.15, 1]) * pulse})`,
            }}
          />
        ) : null}
      </div>
      {/* Caption band sits above the phone so a panned phone never covers it. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 150,
          paddingLeft: PAD,
          paddingRight: PAD,
          paddingBottom: 60,
          background: `linear-gradient(180deg, ${colors.canvas} 82%, ${colors.canvas}00 100%)`,
        }}
      >
        <Words text={caption} size={96} />
        {accent ? <Words text={accent} size={96} color={colors.accent} delay={10} /> : null}
      </div>
    </AbsoluteFill>
  );
}

/** 5. The Going tap, with a burst. */
function Going() {
  const frame = useCurrentFrame();
  const tap = frame >= 22;
  const press = interpolate(frame, [16, 22, 30], [1, 0.9, 1.08], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const settle = interpolate(frame, [30, 40], [1.08, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = frame < 30 ? press : settle;
  const burst = interpolate(frame, [22, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const after = useEnter(56);
  return (
    <AbsoluteFill style={{ background: tap ? colors.accent : colors.canvas }}>
      <div style={{ position: 'absolute', top: 260, left: PAD, right: PAD }}>
        <Words text="tap Going." size={120} color={tap ? '#FFFFFF' : colors.ink} />
      </div>
      <Centered>
        {/* rings and sparkles */}
        {[0, 1].map((r) => (
          <div
            key={r}
            style={{
              position: 'absolute',
              width: 420,
              height: 420,
              borderRadius: 420,
              border: `6px solid ${colors.peach}`,
              opacity: (1 - burst) * (tap ? 1 : 0),
              transform: `scale(${0.6 + burst * (1.6 + r * 0.6)})`,
            }}
          />
        ))}
        {Array.from({ length: 16 }).map((_, k) => {
          const a = (k / 16) * Math.PI * 2;
          const d = burst * (260 + (k % 3) * 60);
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                width: 22,
                height: 22,
                borderRadius: 22,
                background: k % 2 ? colors.peach : '#FFFFFF',
                opacity: tap ? 1 - burst : 0,
                transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`,
              }}
            />
          );
        })}
        <div
          style={{
            transform: `scale(${scale})`,
            width: 420,
            height: 260,
            borderRadius: 64,
            background: tap ? '#FFFFFF' : colors.surface,
            boxShadow: '0 40px 80px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            fontFamily: font,
          }}
        >
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth="2" fill={tap ? colors.accentSoft : 'none'} />
            <path d="M7.5 12.5l3 3 6-6.5" stroke={colors.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 800, color: colors.accent }}>Going</div>
        </div>
      </Centered>
      <div style={{ position: 'absolute', bottom: 300, left: PAD, right: PAD, opacity: after }}>
        <Words text="you're in." size={150} color="#FFFFFF" delay={56} />
      </div>
    </AbsoluteFill>
  );
}

/** 8. Wordmark. */
function EndCard() {
  const mark = useEnter(6, { damping: 12, stiffness: 140 });
  const tag = useEnter(30);
  const foot = useEnter(60);
  return (
    <AbsoluteFill style={{ background: colors.canvas }}>
      <Centered>
        <div
          style={{
            fontFamily: font,
            fontSize: 320,
            fontWeight: 900,
            letterSpacing: -14,
            color: colors.accent,
            transform: `scale(${interpolate(mark, [0, 1], [0.6, 1])})`,
            opacity: mark,
          }}
        >
          yard<span style={{ color: colors.hot }}>.</span>
        </div>
        <div style={{ fontFamily: font, fontSize: 72, fontWeight: 800, color: colors.ink, opacity: tag, marginTop: 10 }}>
          find your people.
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 40,
            fontWeight: 600,
            color: colors.inkSecondary,
            opacity: foot,
            marginTop: 90,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          charlotte · coming soon on the App Store
        </div>
      </Centered>
    </AbsoluteFill>
  );
}

export function Trailer() {
  return (
    <Series>
      <Series.Sequence durationInFrames={SCENES.hook}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.montage}>
        <Montage />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.feed}>
        <PhoneScene caption="everything happening in charlotte." accent="one feed." src="feed.png" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.friends}>
        <PhoneScene
          caption="see which friends"
          accent="are going."
          src="event.png"
          highlight={{ from: 50, top: 625 / 852, bottom: 685 / 852, pan: 560 }}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.going}>
        <Going />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.chat}>
        <PhoneScene caption="the plan happens" accent="in the chat." src="chat.png" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.privacy}>
        <PhoneScene caption="Interested stays yours." accent="only you see it." src="profile.png" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.end}>
        <EndCard />
      </Series.Sequence>
    </Series>
  );
}

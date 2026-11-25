import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { PT, STATUS_BAR, WIDTH, colors, font } from './theme';

/** Spring from 0 to 1 starting at `delay`. */
export function useEnter(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 160, ...config } });
}

/** iOS status bar: 9:41, signal, wifi, battery. Drawn, not a screenshot. */
export function StatusBar({ tone = 'dark', background }: { tone?: 'dark' | 'light'; background?: string }) {
  const c = tone === 'dark' ? '#000' : '#FFF';
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: STATUS_BAR,
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${STATUS_BAR * 0.12}px ${PT * 34}px 0`,
        fontFamily: font,
        fontWeight: 600,
        fontSize: 17 * PT,
        color: c,
        zIndex: 5,
      }}
    >
      <span style={{ letterSpacing: -0.5 }}>9:41</span>
      <svg width={78 * PT * 0.95} height={13 * PT} viewBox="0 0 78 13" fill={c}>
        {/* signal */}
        <rect x="0" y="8" width="3" height="4" rx="0.8" />
        <rect x="4.5" y="6" width="3" height="6" rx="0.8" />
        <rect x="9" y="3.5" width="3" height="8.5" rx="0.8" />
        <rect x="13.5" y="1" width="3" height="11" rx="0.8" />
        {/* wifi */}
        <path d="M30 3.2a10 10 0 0 1 13 0l-1.4 1.6a7.8 7.8 0 0 0-10.2 0zM32.4 5.9a6.4 6.4 0 0 1 8.2 0l-1.4 1.6a4.2 4.2 0 0 0-5.4 0zM34.8 8.6a2.8 2.8 0 0 1 3.4 0L36.5 10.5z" />
        {/* battery */}
        <rect x="51" y="1" width="23" height="11" rx="3.2" fill="none" stroke={c} strokeOpacity="0.4" />
        <rect x="53" y="3" width="19" height="7" rx="1.8" />
        <rect x="75.2" y="4.2" width="1.6" height="4.6" rx="0.8" fillOpacity="0.45" />
      </svg>
    </div>
  );
}

/**
 * A full-bleed app screen, like a screen recording: the status bar stays put and the capture
 * scrolls under it. `scroll` is in output pixels.
 */
export function Screen({
  src,
  scroll = 0,
  statusTone = 'dark',
  statusBg,
  children,
}: {
  src: string;
  scroll?: number;
  statusTone?: 'dark' | 'light';
  statusBg: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: statusBg, overflow: 'hidden' }}>
      <Img
        src={staticFile(src)}
        style={{ position: 'absolute', top: STATUS_BAR - scroll, left: 0, width: WIDTH }}
      />
      {children ? (
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)` }}>{children}</div>
      ) : null}
      <StatusBar tone={statusTone} background={statusBg} />
    </div>
  );
}

/** Where a spot on a 393 pt capture lands on the full-bleed screen (before scrolling). */
export const at = (xPt: number, yPt: number) => ({ x: xPt * PT, y: STATUS_BAR + yPt * PT });

/** A finger tap: a soft dot that presses, then a ring that fades out. */
export function Tap({ x, y, at: when }: { x: number; y: number; at: number }) {
  const frame = useCurrentFrame();
  const f = frame - when;
  if (f < -6 || f > 22) return null;
  const dot = interpolate(f, [-6, 0, 6, 14], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ring = interpolate(f, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 55,
          top: y - 55,
          width: 110,
          height: 110,
          borderRadius: 110,
          background: 'rgba(255,255,255,0.75)',
          boxShadow: '0 0 0 3px rgba(0,0,0,0.12)',
          opacity: dot,
          transform: `scale(${interpolate(dot, [0, 1], [0.6, 0.9])})`,
          zIndex: 20,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 90,
          top: y - 90,
          width: 180,
          height: 180,
          borderRadius: 180,
          border: '5px solid rgba(255,255,255,0.9)',
          opacity: (1 - ring) * (f >= 0 ? 1 : 0),
          transform: `scale(${0.5 + ring * 0.8})`,
          zIndex: 20,
        }}
      />
    </>
  );
}

/** Social-video caption: a white box with heavy black text that pops in. */
export function Caption({ text, at: when, top, style }: { text: string; at: number; top: number; style?: CSSProperties }) {
  const s = useEnter(when, { damping: 13, stiffness: 220 });
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 30,
        opacity: Math.min(1, s * 1.5),
        transform: `scale(${interpolate(s, [0, 1], [0.7, 1])}) rotate(${interpolate(s, [0, 1], [-3, -1.2])}deg)`,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          padding: '20px 34px 24px',
          borderRadius: 26,
          background: '#FFFFFF',
          color: '#111',
          fontFamily: font,
          fontWeight: 800,
          fontSize: 62,
          lineHeight: 1.12,
          letterSpacing: -1.2,
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Sparkles + rings bursting from a point (the Going moment). */
export function Burst({ x, y, at: when }: { x: number; y: number; at: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame - when, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (frame < when || p >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 25 }}>
      {[0, 1].map((r) => (
        <div
          key={r}
          style={{
            position: 'absolute',
            left: -150,
            top: -150,
            width: 300,
            height: 300,
            borderRadius: 300,
            border: `7px solid ${r ? colors.peach : colors.accent}`,
            opacity: 1 - p,
            transform: `scale(${0.3 + p * (1.4 + r * 0.7)})`,
          }}
        />
      ))}
      {Array.from({ length: 18 }).map((_, k) => {
        const a = (k / 18) * Math.PI * 2 + 0.3;
        const d = p * (200 + (k % 3) * 70);
        const size = 14 + (k % 4) * 5;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: Math.cos(a) * d - size / 2,
              top: Math.sin(a) * d - size / 2,
              width: size,
              height: size,
              borderRadius: k % 3 === 0 ? 3 : size,
              background: [colors.peach, colors.accent, colors.hot, '#FFFFFF'][k % 4],
              opacity: 1 - p * p,
              transform: `rotate(${k * 40 + p * 180}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

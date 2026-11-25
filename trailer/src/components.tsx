import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { colors, font } from './theme';

/** Words that pop in one after another (kinetic type). */
export function Words({
  text,
  delay = 0,
  stagger = 4,
  size = 110,
  color = colors.ink,
  weight = 900,
  style,
}: {
  text: string;
  delay?: number;
  stagger?: number;
  size?: number;
  color?: string;
  weight?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: `0 ${size * 0.26}px`,
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.02,
        letterSpacing: -size * 0.035,
        color,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 14, stiffness: 180 } });
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [size * 0.6, 0])}px) scale(${interpolate(s, [0, 1], [0.85, 1])})`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

/** A phone with an app screen in it. Screens are 393×852 pt captures at 2×. */
export function Phone({ src, width = 700, style }: { src: string; width?: number; style?: CSSProperties }) {
  const height = (width * 1704) / 786;
  const bezel = width * 0.03;
  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        padding: bezel,
        borderRadius: width * 0.14,
        background: '#0B0F0C',
        boxShadow: '0 60px 120px rgba(22, 32, 26, 0.35), 0 0 0 2px rgba(255,255,255,0.06) inset',
        ...style,
      }}
    >
      <div style={{ width, height, borderRadius: width * 0.115, overflow: 'hidden', position: 'relative' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: width * 0.025,
            left: '50%',
            width: width * 0.3,
            height: width * 0.085,
            marginLeft: -width * 0.15,
            borderRadius: width,
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}

/** Spring from 0 to 1 starting at `delay`. */
export function useEnter(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 120, ...config } });
}

export function Centered({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

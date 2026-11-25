import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { StatusBar, useEnter } from './components';
import { PT, STATUS_BAR, font, imsg } from './theme';

export type Msg = {
  /** Frame the message lands (relative to the scene). Negative = already in the thread. */
  at: number;
  from: 'me' | 'them';
  text?: string;
  /** A yard link preview instead of text. */
  card?: boolean;
  /** Frames of "typing…" before a received message lands. */
  typing?: number;
};

function Bubble({ msg }: { msg: Msg }) {
  const mine = msg.from === 'me';
  if (msg.card) {
    return (
      <div style={{ width: 720, borderRadius: 46, overflow: 'hidden', background: imsg.received }}>
        <Img src={staticFile('nightlife-1.jpg')} style={{ width: '100%', height: 400, objectFit: 'cover', display: 'block' }} />
        <div style={{ padding: '22px 30px 26px', fontFamily: font }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: '#000', letterSpacing: -0.6 }}>Warehouse Party · Wed 9 PM</div>
          <div style={{ fontSize: 34, color: imsg.meta, marginTop: 6 }}>yard · Maya, Jordan + 3 friends going</div>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        maxWidth: 760,
        padding: '22px 34px 24px',
        borderRadius: 48,
        background: mine ? imsg.sent : imsg.received,
        color: mine ? '#FFF' : '#000',
        fontFamily: font,
        fontSize: 48,
        lineHeight: 1.22,
        letterSpacing: -0.4,
      }}
    >
      {msg.text}
    </div>
  );
}

function Typing() {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: 12, padding: '30px 34px', borderRadius: 48, background: imsg.received }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 20,
            height: 20,
            borderRadius: 20,
            background: '#8E8E93',
            opacity: 0.4 + 0.6 * Math.max(0, Math.sin((frame - i * 4) / 4)),
          }}
        />
      ))}
    </div>
  );
}

function Row({ msg }: { msg: Msg }) {
  const frame = useCurrentFrame();
  const typingFrom = msg.typing ? msg.at - msg.typing : msg.at;
  const land = useEnter(msg.at, { damping: 15, stiffness: 210 });
  const typingIn = useEnter(typingFrom, { damping: 18, stiffness: 220 });
  if (frame < typingFrom) return null;
  const mine = msg.from === 'me';
  const typing = frame < msg.at;
  const grow = typing ? typingIn : land;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        maxHeight: interpolate(grow, [0, 1], [0, msg.card ? 640 : 300]),
        marginTop: interpolate(grow, [0, 1], [0, 14]),
      }}
    >
      <div
        style={{
          transformOrigin: mine ? '100% 100%' : '0% 100%',
          transform: `scale(${interpolate(grow, [0, 1], [0.6, 1])})`,
          opacity: Math.min(1, grow * 2),
        }}
      >
        {typing ? <Typing /> : <Bubble msg={msg} />}
      </div>
    </div>
  );
}

/** A generic iOS-style message thread (drawn, not Apple's assets). */
export function Messages({ messages, contact = 'jordan' }: { messages: Msg[]; contact?: string }) {
  const frame = useCurrentFrame();
  const lastMine = [...messages].reverse().find((m) => m.from === 'me' && frame >= m.at);
  const lastLanded = [...messages].reverse().find((m) => frame >= m.at);
  return (
    <div style={{ position: 'absolute', inset: 0, background: imsg.bg, fontFamily: font }}>
      <StatusBar tone="dark" background="rgba(246,246,246,0.96)" />
      {/* header */}
      <div
        style={{
          position: 'absolute',
          top: STATUS_BAR,
          left: 0,
          right: 0,
          height: 70 * PT,
          background: 'rgba(246,246,246,0.96)',
          borderBottom: '1px solid #D8D8DC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4,
        }}
      >
        <div style={{ position: 'absolute', left: 30, top: 40, color: imsg.sent, fontSize: 50, fontWeight: 400 }}>‹</div>
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: 108,
            background: 'linear-gradient(180deg, #A5A9B3, #858A95)',
            color: '#FFF',
            fontSize: 50,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {contact[0].toUpperCase()}
        </div>
        <div style={{ fontSize: 30, color: '#000', marginTop: 8 }}>
          {contact} <span style={{ color: imsg.meta }}>›</span>
        </div>
      </div>
      {/* thread, anchored to the bottom */}
      <div
        style={{
          position: 'absolute',
          left: 34,
          right: 34,
          bottom: 210,
          top: STATUS_BAR + 70 * PT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <div style={{ textAlign: 'center', color: imsg.meta, fontSize: 30, margin: '0 0 18px' }}>
          <b>Fri</b> 6:12 PM
        </div>
        {messages.map((m, i) => (
          <Row key={i} msg={m} />
        ))}
        {lastMine && lastLanded === lastMine ? (
          <div style={{ textAlign: 'right', color: imsg.meta, fontSize: 28, marginTop: 8 }}>Delivered</div>
        ) : null}
      </div>
      {/* input bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 200,
          background: '#FFF',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 22,
          padding: '28px 34px',
        }}
      >
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 86,
            background: '#E9E9EB',
            color: '#8E8E93',
            fontSize: 60,
            lineHeight: '80px',
            textAlign: 'center',
          }}
        >
          +
        </div>
        <div
          style={{
            flex: 1,
            height: 86,
            borderRadius: 86,
            border: '2px solid #D8D8DC',
            color: '#B0B0B5',
            fontSize: 40,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 32,
          }}
        >
          Message
        </div>
      </div>
      {/* home indicator */}
      <div style={{ position: 'absolute', bottom: 22, left: '50%', width: 380, height: 14, marginLeft: -190, borderRadius: 14, background: '#000' }} />
    </div>
  );
}

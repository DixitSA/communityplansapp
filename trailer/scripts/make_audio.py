"""
Synthesizes the trailer's original music bed and sound effects (no samples, no licensing).

    python scripts/make_audio.py      # writes public/music.wav and public/sfx-*.wav

120 BPM, F minor, a soft intro under the texting scene (bars 1-4), the drop on "say less" (bar 5),
a filtered breakdown for the texting callback, a last bar, then a pad tail under the end card.
Timing matches src/theme.ts: 1 beat = 15 frames at 30 fps.
"""

import os
import wave

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
LENGTH_S = 32.5
rng = np.random.default_rng(7)

OUT = os.path.join(os.path.dirname(__file__), '..', 'public')


def t(n):
    return np.arange(int(n * SR)) / SR


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or an array (a sweep)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def env(n, attack=0.005, decay=0.3):
    tt = t(n)
    e = np.minimum(tt / max(attack, 1e-4), 1.0) * np.exp(-tt / decay)
    return e


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


# --- instruments -------------------------------------------------------------

def kick():
    tt = t(0.45)
    f = 45 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 7) * 0.9


def clap():
    n = rng.standard_normal(int(0.25 * SR))
    hp = n - lowpass(n, 900)
    e = np.zeros_like(hp)
    for k, off in enumerate([0, 0.011, 0.022]):
        place(e, env(0.2, 0.001, 0.05 if k < 2 else 0.12), off)
    return hp * e * 0.35


def hat(open_=False):
    n = rng.standard_normal(int((0.18 if open_ else 0.05) * SR))
    hp = n - lowpass(n, 7000)
    return hp * env(len(hp) / SR, 0.0005, 0.06 if open_ else 0.015) * 0.18


def bass808(midi, dur):
    tt = t(dur)
    f = note(midi)
    s = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)
    s = np.tanh(s * 1.6) * np.minimum(tt / 0.01, 1) * np.exp(-tt / 1.1)
    return s * 0.42


def pad(chord, dur):
    tt = t(dur)
    s = np.zeros_like(tt)
    for m in chord:
        for det in (-0.08, 0.08):
            f = note(m + det)
            s += 2 * (tt * f - np.floor(0.5 + tt * f))  # saw
    s = lowpass(s / (len(chord) * 2), 1400)
    e = np.minimum(tt / 0.35, 1) * np.minimum((dur - tt) / 0.4, 1)
    return s * np.clip(e, 0, 1) * 0.16


def bell(midi, dur=0.9):
    tt = t(dur)
    f = note(midi)
    s = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 6)
    return s * env(dur, 0.002, 0.35) * 0.12


def riser(dur):
    n = rng.standard_normal(int(dur * SR))
    cut = np.linspace(400, 9000, len(n))
    return lowpass(n, cut) * np.linspace(0, 1, len(n)) ** 2 * 0.25


# --- arrangement -------------------------------------------------------------

# Fm9, Dbmaj7, Abmaj7, Eb6: one chord per bar.
CHORDS = [[53, 56, 60, 63, 67], [49, 53, 56, 60], [44, 48, 51, 55], [51, 55, 58, 60]]
ROOTS = [29, 25, 32, 27]  # 808 roots (F1, Db1, Ab1, Eb1)
MELODY = [72, 75, 77, 75, 72, 70, 68, 70]  # bell line, eighths, bars 3+

music = np.zeros(int(LENGTH_S * SR))
bars = int(LENGTH_S / BAR) + 1

for b in range(bars):
    start = b * BAR
    if start >= LENGTH_S:
        break
    c = b % 4
    intro = b < 4                      # texting scene
    drop = 4 <= b < 11                 # app scenes
    breakdown = 11 <= b < 12           # texting callback
    outro = b == 12                    # last bar into the end card
    tail = b >= 13

    place(music, pad(CHORDS[c], BAR + 0.3), start)

    if b >= 2 and not tail:
        for k, m in enumerate(MELODY):
            if intro or k % 2 == 0:
                place(music, bell(m + (0 if c < 2 else -2)), start + k * BEAT / 2)

    if drop or outro:
        place(music, bass808(ROOTS[c], BAR * 0.95), start)
        for beat in range(4):
            if beat in (0,) or (beat == 2 and b % 2):
                place(music, kick(), start + beat * BEAT)
            if beat in (1, 3):
                place(music, clap(), start + beat * BEAT)
        # hats: eighths, with a 16th/32nd roll on the last beat of every other bar
        for k in range(8):
            place(music, hat(open_=(k == 7 and b % 2 == 0)), start + k * BEAT / 2)
        if b % 2 == 1:
            for k in range(6):
                place(music, hat() * 0.8, start + 3 * BEAT + k * BEAT / 6)
    elif intro and b >= 2:
        for k in range(8):
            place(music, hat() * 0.5, start + k * BEAT / 2)
    elif breakdown:
        place(music, bass808(ROOTS[c], BAR * 0.9) * 0.6, start)

# Riser into the drop on "say less" (bar 5), and a short one into the end card.
place(music, riser(BAR), 3 * BAR)
place(music, riser(BEAT * 2) * 0.7, 12 * BAR - BEAT * 2)

# Filter the breakdown bar so it sounds like it's in another room.
s, e = int(11 * BAR * SR), int(12 * BAR * SR)
music[s:e] = lowpass(music[s:e], 700) * 1.6

# Gentle master: fade in, fade out, soft clip.
tt = np.arange(len(music)) / SR
music *= np.clip(tt / 0.6, 0, 1) * np.clip((LENGTH_S - tt) / 2.5, 0, 1)
music = np.tanh(music * 1.3) * 0.85


# --- sound effects -----------------------------------------------------------

def blip(f1, f2, dur=0.12):
    tt = t(dur)
    f = np.linspace(f1, f2, len(tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(dur, 0.002, dur / 3) * 0.5


def whoosh():
    n = rng.standard_normal(int(0.28 * SR))
    return lowpass(n, np.linspace(6000, 900, len(n))) * env(0.28, 0.02, 0.08) * 0.6


def tap():
    n = rng.standard_normal(int(0.03 * SR))
    return (n - lowpass(n, 3000)) * env(0.03, 0.0005, 0.006) * 0.8


def sparkle():
    out = np.zeros(int(0.9 * SR))
    for k, m in enumerate([84, 88, 91, 96, 91]):
        place(out, bell(m, 0.6) * 3, k * 0.07)
    return out


SFX = {
    'sfx-receive': np.concatenate([blip(1250, 1250, 0.07), blip(1650, 1650, 0.1)]),
    'sfx-send': whoosh(),
    'sfx-tap': tap(),
    'sfx-sparkle': sparkle(),
}


def write(name, x, stereo=False):
    x = np.clip(x, -1, 1)
    data = (x * 32767).astype('<i2')
    if stereo:
        data = np.repeat(data[:, None], 2, axis=1)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write('music.wav', music)
    for name, x in SFX.items():
        write(f'{name}.wav', x)
    print('wrote music.wav and', ', '.join(SFX))

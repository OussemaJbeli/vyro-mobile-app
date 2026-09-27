// Generates the short countdown cues used by rest and interval timers (step 18).
// Run with `node scripts/sounds/generate-beeps.mjs`; output is committed.
import { writeFileSync } from 'node:fs';

function tone(file, freq, ms, rate = 22050) {
  const n = Math.round((rate * ms) / 1000);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    // 5 ms fade in/out to avoid clicks.
    const env = Math.min(1, i / (rate * 0.005), (n - i) / (rate * 0.005));
    const v = Math.sin((2 * Math.PI * freq * i) / rate) * env * 0.6;
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

tone('assets/sounds/tick.wav', 880, 120);
tone('assets/sounds/go.wav', 1320, 320);

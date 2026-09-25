import type { Mission } from "./missions";
import type { DuelRecording } from "./duel";
import type { Run } from "./experiment";
export const pitches = [
  { name: "C", octave: "C4", frequency: 261.625565 },
  { name: "D", octave: "D4", frequency: 293.664768 },
  { name: "E", octave: "E4", frequency: 329.627557 },
  { name: "G", octave: "G4", frequency: 391.995436 },
];
export const melodies = [
  { name: "Little steps", notes: [0, 1, 2, 3, 2, 1, 0, 2] },
  { name: "Back & forth", notes: [0, 3, 1, 2, 0, 3, 2, 1] },
  { name: "Golden hour", notes: [2, 2, 0, 1, 3, 2, 1, 0] },
];
export type NoteEvent = { atMs: number; note: number; step: number };
export const validNotes = (notes: unknown): notes is number[] =>
  Array.isArray(notes) &&
  notes.length === 8 &&
  notes.every((n) => Number.isInteger(n) && n >= 0 && n < 4);
export function previewEvents(notes: number[]): NoteEvent[] {
  if (!validNotes(notes)) return [];
  return notes.map((note, step) => ({ note, step, atMs: step * 650 }));
}
export function takeEvents(notes: number[], run: Run): NoteEvent[] {
  if (!validNotes(notes)) return [];
  return (run.clicks || [])
    .filter(
      (c) =>
        c.hit &&
        Number.isFinite(c.atMs) &&
        c.atMs >= run.firstTargetMs &&
        Number.isInteger(c.targetIndex) &&
        c.targetIndex >= 0 &&
        c.targetIndex < 8,
    )
    .map((c) => ({
      atMs: c.atMs - run.firstTargetMs,
      note: notes[c.targetIndex],
      step: c.targetIndex,
    }));
}
export function musicRecording(m: Mission, base: string): DuelRecording | null {
  const run = m.run,
    music = m.rules.music;
  if (
    !/^[a-f0-9]{20}$/.test(m.id) ||
    !/^https:\/\/[a-z0-9.-]+\.up\.railway\.app$/.test(base) ||
    m.rules.id !== "music-eight-v1" ||
    !music ||
    !validNotes(music.notes) ||
    music.instrument !== "soft-keys-v1" ||
    music.pitches?.join(",") !== "C4,D4,E4,G4"
  )
    return null;
  if (
    !run ||
    !["complete", "incomplete"].includes(m.state) ||
    !run.verified ||
    !/^[a-f0-9]{64}$/.test(run.proof) ||
    !Number.isFinite(run.firstTargetMs) ||
    run.firstTargetMs < 0 ||
    run.rulesHash !== m.rulesHash ||
    !Array.isArray(run.samples) ||
    run.samples.length < 2 ||
    !run.samples.every(
      (s) =>
        Number.isFinite(s.atMs) &&
        Array.isArray(s.cursor) &&
        s.cursor.length === 2 &&
        s.cursor.every(Number.isFinite),
    )
  )
    return null;
  if (
    !Array.isArray(run.clicks) ||
    !run.clicks.every(
      (c) =>
        typeof c.hit === "boolean" &&
        Number.isFinite(c.atMs) &&
        c.atMs >= run.firstTargetMs &&
        Number.isInteger(c.targetIndex) &&
        c.targetIndex >= 0 &&
        c.targetIndex < 8,
    )
  )
    return null;
  const events = takeEvents(music.notes, run);
  if (
    events.length !== run.hits ||
    !events.every(
      (e, i) => e.step === i && (i === 0 || e.atMs > events[i - 1].atMs),
    )
  )
    return null;
  const replay = run.replay,
    prefix = `/challenges/${m.id}`;
  if (
    !replay ||
    replay.metaUrl !== prefix + "/poses.json" ||
    replay.binaryUrl !== prefix + "/poses.bin" ||
    !Number.isFinite(replay.timeOriginMs) ||
    !/^[a-f0-9]{64}$/.test(replay.sha256)
  )
    return null;
  return {
    run: {
      ...run,
      replay: {
        ...replay,
        metaUrl: base + replay.metaUrl,
        binaryUrl: base + replay.binaryUrl,
      },
    },
    rules: m.rules,
    rulesHash: m.rulesHash,
  };
}
export function pendingEvents(events: NoteEvent[], offsetMs: number) {
  return events.filter((e) => e.atMs >= offsetMs);
}
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, v < 0 ? v * 32768 : v * 32767, true);
  });
  return buffer;
}

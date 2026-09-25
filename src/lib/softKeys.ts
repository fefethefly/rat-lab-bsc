import { pitches, pendingEvents, encodeWav, type NoteEvent } from "./music";
/** Original synthesized keys. No samples, remote media or autoplay. */
function voice(
  context: BaseAudioContext,
  output: AudioNode,
  note: number,
  when: number,
) {
  const nodes: OscillatorNode[] = [];
  for (const [multiple, level] of [
    [1, 0.19],
    [2, 0.06],
    [3, 0.022],
  ]) {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = pitches[note].frequency * multiple;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.35);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(when);
    oscillator.stop(when + 1.4);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    nodes.push(oscillator);
  }
  return nodes;
}
export class SoftKeys {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private voices: OscillatorNode[] = [];
  private disposed = false;
  async enable() {
    if (this.disposed)
      throw Error("Audio is closed. Reload this page to listen.");
    if (typeof AudioContext === "undefined")
      throw Error(
        "Audio is unavailable in this browser. Open this take in a browser with Web Audio support.",
      );
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.gain.value = 0.8;
      this.output.connect(this.context.destination);
    }
    if (this.context.state !== "running") await this.context.resume();
    if (this.disposed || this.context.state !== "running")
      throw Error("Audio could not start. Tap Play again.");
  }
  now() {
    return this.context?.currentTime || 0;
  }
  running() {
    return this.context?.state === "running";
  }
  mute(muted: boolean) {
    if (this.output && this.context)
      this.output.gain.setValueAtTime(
        muted ? 0 : 0.8,
        this.context.currentTime,
      );
  }
  schedule(events: NoteEvent[], offsetMs: number) {
    this.stop();
    const origin = this.now() + 0.06;
    if (!this.context || !this.output) return origin;
    for (const e of pendingEvents(events, offsetMs))
      this.voices.push(
        ...voice(
          this.context,
          this.output,
          e.note,
          origin + (e.atMs - offsetMs) / 1000,
        ),
      );
    return origin;
  }
  tap(note: number) {
    if (this.context && this.output && this.running())
      this.voices.push(
        ...voice(this.context, this.output, note, this.now() + 0.01),
      );
  }
  stop() {
    for (const node of this.voices) {
      try {
        node.stop();
      } catch {
        /* A voice may have finished already. */
      }
    }
    this.voices = [];
  }
  dispose() {
    this.disposed = true;
    this.stop();
    void this.context?.close();
    this.context = null;
    this.output = null;
  }
}
export async function musicWav(events: NoteEvent[], durationMs: number) {
  const rate = 22050,
    context = new OfflineAudioContext(
      1,
      Math.ceil((durationMs / 1000 + 1.5) * rate),
      rate,
    );
  const output = context.createGain();
  output.gain.value = 0.8;
  output.connect(context.destination);
  for (const event of events)
    voice(context, output, event.note, event.atMs / 1000);
  const buffer = await context.startRendering();
  return encodeWav(buffer.getChannelData(0), rate);
}

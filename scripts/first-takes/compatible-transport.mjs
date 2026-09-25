/** Playback only. Never changes the archived renderer or PCM bytes. */
export function createTransport(context, buffer, onChange = () => {}) {
  let source = null, offset = 0, started = 0, generation = 0, disposed = false;
  const position = () => Math.min(buffer.duration, offset + (source ? context.currentTime - started : 0));
  const state = () => ({ playing: !!source, position: position(), duration: buffer.duration });
  function stop() {
    if (!source) return;
    offset = position();
    const old = source;
    source = null;
    old.onended = null;
    old.stop();
    old.disconnect();
  }
  async function play() {
    if (disposed || source) return;
    const request = ++generation;
    await context.resume();
    if (disposed || request !== generation || source) return;
    if (context.state !== 'running') throw Error('Audio is suspended. Press Play again.');
    if (offset >= buffer.duration) offset = 0;
    const next = context.createBufferSource();
    next.buffer = buffer;
    next.connect(context.destination);
    next.onended = () => {
      if (source !== next) return;
      offset = buffer.duration;
      source = null;
      next.disconnect();
      onChange(state());
    };
    next.start(0, offset);
    source = next;
    started = context.currentTime;
    onChange(state());
  }
  function pause() {
    generation++;
    stop();
    onChange(state());
  }
  function seek(seconds) {
    if (!Number.isFinite(seconds)) throw Error('Invalid playback position.');
    pause();
    offset = Math.min(buffer.duration, Math.max(0, seconds));
    onChange(state());
  }
  context.onstatechange = () => {
    if (context.state !== 'running' && source) pause();
  };
  return {
    state, play, pause, seek,
    dispose() { disposed = true; pause(); context.onstatechange = null; return context.close(); },
  };
}

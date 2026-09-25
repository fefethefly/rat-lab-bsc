import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play } from "@phosphor-icons/react";
import RecordedRat from "./RecordedRat";
import { useDuelRecording, hitsAt } from "../lib/duel";
import { seconds } from "../lib/experiment";
export default function MissionReplay() {
  const host = useRef<HTMLElement>(null);
  const { recording } = useDuelRecording();
  const [visible, setVisible] = useState(false),
    [seen, setSeen] = useState(false),
    [at, setAt] = useState(0),
    [playing, setPlaying] = useState(
      () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: "80px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!recording || !visible || !playing) return;
    let prev = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      setAt(
        (t) =>
          (t + Math.min(now - prev, 100)) % (recording.run.durationMs + 1300),
      );
      prev = now;
    }, 40);
    return () => clearInterval(timer);
  }, [recording, visible, playing]);
  return (
    <section className="mission-replay" ref={host}>
      <div className="mission-replay-stage">
        <div className="mission-drawing-head">
          <span>R-01 / RECORDED BENCHMARK</span>
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={
              playing ? "Pause benchmark preview" : "Play benchmark preview"
            }
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
        {recording && seen ? (
          <RecordedRat
            recording={recording}
            atMs={
              recording.run.firstTargetMs +
              Math.min(at, recording.run.durationMs)
            }
          />
        ) : (
          <div className="mission-replay-placeholder">
            The subject’s recorded attempt
          </div>
        )}
        <div className="mission-replay-readout">
          <span>{recording ? hitsAt(recording.run, at) : "—"} / 8 TARGETS</span>
          <span>
            {recording ? seconds(Math.min(at, recording.run.durationMs)) : "—"}
          </span>
        </div>
      </div>
      <div className="mission-replay-copy">
        <span className="mission-kicker">MEET YOUR OPPONENT</span>
        <h2>
          Small moves.
          <br />A record you
          <br />
          can race.
        </h2>
        <p>
          A head turn becomes a cursor movement. A lever press becomes a hit.
          The recording keeps the motion and every split together.
        </p>
        <a className="mission-secondary" href="/challenge">
          Try the verified {recording ? seconds(recording.run.durationMs) : ""}{" "}
          benchmark <ArrowUpRight size={16} />
        </a>
        <span className="mission-replay-footnote">
          RAT LAB’S OWN SESSION · FIXED TRAINED POLICIES
        </span>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowCounterClockwise,
  DownloadSimple,
  Copy,
  Play,
  Pause,
  Check,
  Fingerprint,
} from "@phosphor-icons/react";
import AimBoard from "./AimBoard";
import RecordedRat from "./RecordedRat";
import { downloadJson, seconds, shortHash } from "../lib/experiment";
import {
  useDuelRecording,
  hitTimes,
  hitsAt,
  splitDelta,
  type DuelRecording,
} from "../lib/duel";
type Phase =
  | "ready"
  | "countdown"
  | "playing"
  | "settling"
  | "done"
  | "timeout";
type Score = {
  schemaVersion: 2;
  rulesHash: string;
  ratRunId: string;
  ratProof: string;
  ratDurationMs: number;
  durationMs: number;
  misses: number;
  at: string;
  input: string;
  splits: number[];
};
export default function Challenge() {
  const { recording, error, retry } = useDuelRecording();
  if (!recording)
    return (
      <div className="lab-loading">
        <h2>{error ? "Opponent unavailable" : "Preparing your opponent…"}</h2>
        <p>
          {error ||
            "Loading a verified run with matching body motion and target timestamps."}
        </p>
        {error && (
          <button className="lab-button" onClick={retry}>
            Retry recording
          </button>
        )}
      </div>
    );
  return <Duel key={recording.run.id} recording={recording} />;
}
function Duel({ recording }: { recording: DuelRecording }) {
  const { run, rules, rulesHash } = recording;
  const [phase, setPhase] = useState<Phase>("ready");
  const [index, setIndex] = useState(0),
    [misses, setMisses] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [raceMs, setRaceMs] = useState(0),
    [countdown, setCountdown] = useState(rules.initialDelayMs);
  const [cursor, setCursor] = useState<[number, number]>([0.5, 0.5]),
    [splits, setSplits] = useState<number[]>([]);
  const [score, setScore] = useState<Score | null>(null),
    [best, setBest] = useState<Score | null>(null),
    [notice, setNotice] = useState("");
  const [sceneReady, setSceneReady] = useState(false),
    [preview, setPreview] = useState(
      () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [previewMs, setPreviewMs] = useState(0);
  const clock = useRef(0),
    targetClock = useRef(0),
    timer = useRef(0),
    phaseRef = useRef<Phase>("ready"),
    indexRef = useRef(0),
    missRef = useRef(0),
    splitsRef = useRef<number[]>([]),
    input = useRef("pointer");
  const board = useRef<HTMLDivElement>(null);
  const change = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  useEffect(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("ratlab:aim-eight:duel-best") || "null",
      );
      if (
        v?.schemaVersion === 2 &&
        v.rulesHash === rulesHash &&
        Number.isFinite(v.durationMs) &&
        v.durationMs > 0
      )
        setBest(v);
    } catch {}
  }, [rulesHash]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (phase === "ready") {
      if (!preview) return;
      let last = performance.now();
      const id = setInterval(() => {
        const now = performance.now();
        setPreviewMs(
          (n) => (n + Math.min(now - last, 100)) % (run.durationMs + 1200),
        );
        last = now;
      }, 32);
      return () => clearInterval(id);
    }
    if (phase === "timeout") return;
    const id = setInterval(() => {
      const now = performance.now(),
        t = Math.max(0, now - clock.current);
      if (phaseRef.current === "countdown")
        setCountdown(Math.max(0, clock.current - now));
      else setRaceMs(Math.min(t, run.durationMs));
      if (["playing", "settling"].includes(phaseRef.current)) setElapsed(t);
      if (
        phaseRef.current === "playing" &&
        now - targetClock.current > rules.targetTimeoutMs
      ) {
        clearTimeout(timer.current);
        change("timeout");
        setNotice("Target timed out. Start another round.");
      }
      if (phaseRef.current === "done" && t >= run.durationMs) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [phase, preview, run.durationMs, rules.targetTimeoutMs]);
  useEffect(() => {
    const onHidden = () => {
      if (
        document.hidden &&
        ["countdown", "playing", "settling"].includes(phaseRef.current)
      ) {
        clearTimeout(timer.current);
        change("timeout");
        setNotice(
          "Round ended because the page was hidden. Restart for a timed comparison.",
        );
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);
  const start = () => {
    clearTimeout(timer.current);
    setScore(null);
    setNotice("");
    setElapsed(0);
    setRaceMs(0);
    setMisses(0);
    setIndex(0);
    setSplits([]);
    setCursor([0.5, 0.5]);
    missRef.current = 0;
    indexRef.current = 0;
    splitsRef.current = [];
    input.current = "pointer";
    setCountdown(rules.initialDelayMs);
    clock.current = performance.now() + rules.initialDelayMs;
    change("countdown");
    board.current
      ?.querySelector<SVGElement>('[role="application"]')
      ?.focus({ preventScroll: true });
    board.current
      ?.closest(".duel-arena")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
    timer.current = window.setTimeout(() => {
      clock.current = performance.now();
      targetClock.current = clock.current;
      change("playing");
    }, rules.initialDelayMs);
  };
  const press = (p: [number, number]) => {
    if (phaseRef.current !== "playing") return;
    setCursor(p);
    const target = rules.targets[indexRef.current];
    if (
      Math.abs(p[0] - target[0]) > target[2] ||
      Math.abs(p[1] - target[1]) > target[3]
    ) {
      setMisses(++missRef.current);
      return;
    }
    const t = Math.round(performance.now() - clock.current);
    splitsRef.current = [...splitsRef.current, t];
    setSplits(splitsRef.current);
    setIndex(++indexRef.current);
    setElapsed(t);
    if (indexRef.current === 8) {
      change("done");
      const result: Score = {
        schemaVersion: 2,
        rulesHash,
        ratRunId: run.id,
        ratProof: run.proof,
        ratDurationMs: run.durationMs,
        durationMs: t,
        misses: missRef.current,
        at: new Date().toISOString(),
        input: input.current,
        splits: [...splitsRef.current],
      };
      setScore(result);
      if (!best || t < best.durationMs) {
        setBest(result);
        try {
          localStorage.setItem(
            "ratlab:aim-eight:duel-best",
            JSON.stringify(result),
          );
        } catch {
          setNotice("Score is ready, but browser storage is unavailable.");
        }
      }
    } else {
      change("settling");
      timer.current = window.setTimeout(() => {
        targetClock.current = performance.now();
        change("playing");
      }, rules.betweenDelayMs);
    }
  };
  const reset = () => {
    clearTimeout(timer.current);
    change("ready");
    setIndex(0);
    setElapsed(0);
    setRaceMs(0);
    setMisses(0);
    setSplits([]);
    setScore(null);
    setNotice("");
  };
  const ratTimes = hitTimes(run),
    viewMs = phase === "ready" ? Math.min(previewMs, run.durationMs) : raceMs;
  const ratHits = phase === "countdown" ? 0 : hitsAt(run, viewMs);
  const poseTime =
    phase === "countdown"
      ? Math.max(0, run.firstTargetMs - countdown)
      : run.firstTargetMs + viewMs;
  const latestDelta = splitDelta(splits, ratTimes, splits.length - 1);
  const headline =
    phase === "ready"
      ? "Watch a run. Then race it."
      : phase === "countdown"
        ? "Two competitors. One countdown."
        : phase === "done"
          ? elapsed < run.durationMs
            ? "You beat this recording."
            : elapsed === run.durationMs
              ? "A dead heat."
              : "R-01 takes this round."
          : phase === "timeout"
            ? "Round interrupted."
            : index === ratHits
              ? "Neck and neck."
              : index > ratHits
                ? "You’re ahead."
                : "R-01 is ahead.";
  return (
    <div className="duel-experience">
      <div className="duel-banner">
        <div>
          <span className="lab-label">HUMAN × NEURAL POLICY</span>
          <h2 aria-live="polite">{headline}</h2>
        </div>
        <div className="duel-matchup">
          <span>
            YOU <b>{index}</b>
          </span>
          <i>:</i>
          <span>
            <b>{phase === "ready" ? "—" : ratHits}</b> R-01
          </span>
          <small>8 TARGETS · SAME SEQUENCE</small>
        </div>
      </div>
      <div className="duel-arena">
        <section
          className={
            "lab-panel duel-player " + (phase === "settling" ? "hit-flash" : "")
          }
        >
          <div className="panel-heading">
            <span className="lab-label">01 / YOU</span>
            <span className="state-tag">
              {phase === "ready"
                ? "READY"
                : phase === "done"
                  ? "FINISHED"
                  : phase === "timeout"
                    ? "ENDED"
                    : "LOCAL PRACTICE"}
            </span>
          </div>
          <div className="challenge-score">
            <div>
              <small>YOUR TIME</small>
              <strong>{seconds(elapsed)}</strong>
            </div>
            <div>
              <small>HITS</small>
              <strong>
                {index}
                <em>/8</em>
              </strong>
            </div>
            <div>
              <small>MISSES</small>
              <strong>{misses}</strong>
            </div>
          </div>
          <div className="challenge-board-wrap" ref={board}>
            <AimBoard
              target={phase === "playing" ? rules.targets[index] : null}
              cursor={cursor}
              index={index}
              interactive
              onPoint={press}
              onKey={(e) => {
                if (
                  ![
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    " ",
                  ].includes(e.key)
                )
                  return;
                e.preventDefault();
                input.current = "keyboard";
                if (e.key === " ") press(cursor);
                else
                  setCursor(([x, y]) => [
                    Math.max(
                      0,
                      Math.min(
                        1,
                        x +
                          (e.key === "ArrowRight"
                            ? 0.015
                            : e.key === "ArrowLeft"
                              ? -0.015
                              : 0),
                      ),
                    ),
                    Math.max(
                      0,
                      Math.min(
                        1,
                        y +
                          (e.key === "ArrowDown"
                            ? 0.015
                            : e.key === "ArrowUp"
                              ? -0.015
                              : 0),
                      ),
                    ),
                  ]);
              }}
            />
            {phase !== "playing" && (
              <div
                className={
                  "arena-overlay duel-overlay " +
                  (phase === "settling" ? "settle-overlay" : "")
                }
              >
                <span className="lab-label">
                  {phase === "settling"
                    ? `TARGET ${String(index).padStart(2, "0")} HIT`
                    : phase === "countdown"
                      ? "STARTING TOGETHER"
                      : phase === "done"
                        ? "YOUR ROUND IS COMPLETE"
                        : "AIM EIGHT / HEAD TO HEAD"}
                </span>
                <h2>
                  {phase === "ready" ? (
                    `Can you beat ${seconds(run.durationMs)}?`
                  ) : phase === "countdown" ? (
                    Math.max(1, Math.ceil(countdown / 1000))
                  ) : phase === "settling" ? (
                    <>
                      <Check size={30} />
                      Next target
                    </>
                  ) : phase === "done" ? (
                    seconds(elapsed)
                  ) : (
                    "Ready for another run?"
                  )}
                </h2>
                {["ready", "done", "timeout"].includes(phase) && (
                  <button
                    className="lab-button primary"
                    onClick={start}
                    disabled={!sceneReady}
                  >
                    {!sceneReady
                      ? "Preparing the replay…"
                      : phase === "ready"
                        ? "Race R-01"
                        : "Race again"}
                    <ArrowRight size={18} />
                  </button>
                )}
                {phase === "ready" && (
                  <p>Your opponent is a verified recorded run.</p>
                )}
              </div>
            )}
          </div>
          <div
            className="duel-lane-progress"
            aria-label={`Your progress: ${index} of 8`}
          >
            {rules.targets.map((_, i) => (
              <span
                key={i}
                className={
                  i < index
                    ? "done"
                    : i === index && phase === "playing"
                      ? "current"
                      : ""
                }
              >
                {i < index ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
            ))}
          </div>
          <div className="arena-foot">
            <span>Click the gold target · Arrow keys + Space</span>
            {phase !== "ready" && (
              <button onClick={reset}>
                <ArrowCounterClockwise size={15} />
                Reset
              </button>
            )}
          </div>
        </section>
        <section className="lab-panel duel-rat">
          <div className="panel-heading">
            <span className="lab-label">02 / R–01</span>
            {phase === "ready" && (
              <button
                className="mobile-preview-toggle"
                aria-label={preview ? "Pause rat preview" : "Play rat preview"}
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}
            <span className="state-tag">
              {phase === "ready" ? "REPLAY PREVIEW" : "RECORDED OPPONENT"}
            </span>
          </div>
          <div className="challenge-score">
            <div>
              <small>{phase === "ready" ? "BENCHMARK" : "RAT TIME"}</small>
              <strong>
                {seconds(
                  phase === "ready"
                    ? run.durationMs
                    : Math.min(viewMs, run.durationMs),
                )}
              </strong>
            </div>
            <div>
              <small>HITS</small>
              <strong>
                {ratHits}
                <em>/8</em>
              </strong>
            </div>
            <div>
              <small>MISSES</small>
              <strong>{run.misses}</strong>
            </div>
          </div>
          <RecordedRat
            recording={recording}
            atMs={poseTime}
            onReady={() => setSceneReady(true)}
          />
          <div
            className="duel-lane-progress rat-lane"
            aria-label={`Rat progress: ${ratHits} of 8`}
          >
            {rules.targets.map((_, i) => (
              <span
                key={i}
                className={
                  i < ratHits ? "done" : i === ratHits ? "current" : ""
                }
              >
                {i < ratHits ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
            ))}
          </div>
          <div className="arena-foot">
            <span>
              {ratHits === 8
                ? "8/8 · recorded run complete"
                : "Head → cursor · lever → hit"}
            </span>
            {phase === "ready" && (
              <button onClick={() => setPreview((v) => !v)}>
                {preview ? <Pause size={16} /> : <Play size={16} />}{" "}
                {preview ? "Pause preview" : "Play preview"}
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="duel-split-heading">
        <div>
          <span className="lab-label">TARGET BY TARGET</span>
          <h2>
            {latestDelta === null
              ? "Every hit tells the story."
              : `${seconds(Math.abs(latestDelta))} ${latestDelta < 0 ? "ahead" : "behind"} at target ${splits.length}.`}
          </h2>
        </div>
        <span>Difference at the same target · lower time wins</span>
      </div>
      <div
        className="duel-splits"
        role="list"
        aria-label="Per-target split times"
      >
        {ratTimes.map((t, i) => {
          const d = splitDelta(splits, ratTimes, i);
          return (
            <div
              role="listitem"
              key={i}
              className={d === null ? "" : d <= 0 ? "ahead" : "behind"}
            >
              <small>TARGET {String(i + 1).padStart(2, "0")}</small>
              <strong>
                {d === null
                  ? "—"
                  : `${d > 0 ? "+" : "−"}${seconds(Math.abs(d))}`}
              </strong>
              <span>
                YOU {splits[i] === undefined ? "—" : seconds(splits[i])}
              </span>
              <span>R-01 {seconds(t)}</span>
            </div>
          );
        })}
      </div>
      {score && (
        <section className="lab-panel score-result" aria-live="polite">
          <div>
            <span className="lab-label">YOUR RESULT</span>
            <h2>
              {seconds(score.durationMs)} · {score.misses} misses
            </h2>
            <p>
              {seconds(Math.abs(score.durationMs - run.durationMs))}{" "}
              {score.durationMs < run.durationMs ? "faster" : "slower"} than
              recorded R-01. All eight splits are included in your result.
            </p>
          </div>
          <div className="result-actions">
            <button
              className="lab-button"
              onClick={() => downloadJson(score, "ratlab-duel-result.json")}
            >
              <DownloadSimple size={17} />
              Save result
            </button>
            <button
              className="lab-button primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `I raced R-01: ${seconds(score.durationMs)}, ${score.misses} misses. Rat benchmark: ${seconds(run.durationMs)}. Local practice against a verified recording. https://rat-lab.fun/challenge`,
                  );
                  setNotice("Result text copied.");
                } catch {
                  setNotice("Copy is unavailable. Use Save result instead.");
                }
              }}
            >
              <Copy size={17} />
              Copy score
            </button>
          </div>
        </section>
      )}
      <div className="duel-notes">
        <div>
          <span className="lab-label">YOUR PERSONAL BEST</span>
          <strong>
            {best ? seconds(best.durationMs) : "Your first race starts here."}
          </strong>
          <p>Saved on this device. Practice scores are self-reported.</p>
          {best && (
            <button
              className="text-button"
              onClick={() => {
                setBest(null);
                try {
                  localStorage.removeItem("ratlab:aim-eight:duel-best");
                } catch {}
              }}
            >
              Clear personal best
            </button>
          )}
        </div>
        <div>
          <span className="lab-label">SAME TARGETS. DIFFERENT CONTROLS.</span>
          <p>
            The rat’s simulation clock is replayed against your browser clock.
            Target rectangles and settle intervals match. Pointer, keyboard and
            neural motor control differ; this is a playful comparison, not a
            scientific benchmark. Human clicks never allocate buyback funds.
          </p>
          <details className="duel-proof">
            <summary>
              <Fingerprint size={15} />
              Recorded opponent · {shortHash(run.proof)}
            </summary>
            <p>
              {run.id}
              <br />
              Replay-verified on its recording host. Body poses, clicks and
              score belong to this same run.
            </p>
            <button
              className="text-button"
              onClick={() =>
                downloadJson(recording, "ratlab-recorded-opponent.json")
              }
            >
              Download opponent record
            </button>
          </details>
        </div>
      </div>
      {notice && (
        <p className="lab-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

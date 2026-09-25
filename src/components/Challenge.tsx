import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowCounterClockwise,
  DownloadSimple,
  Copy,
  Check,
} from "@phosphor-icons/react";
import AimBoard from "./AimBoard";
import {
  downloadJson,
  seconds,
  type Experiment,
  type Run,
} from "../lib/experiment";
type Score = {
  schemaVersion: 1;
  rulesHash: string;
  ratRunId: string;
  ratProof: string;
  ratDurationMs: number;
  durationMs: number;
  misses: number;
  at: string;
  input: string;
};
export default function Challenge({ data }: { data: Experiment }) {
  const [phase, setPhase] = useState<
    "ready" | "countdown" | "playing" | "settling" | "done" | "timeout"
  >("ready");
  const [index, setIndex] = useState(0),
    [misses, setMisses] = useState(0),
    [elapsed, setElapsed] = useState(0);
  const [cursor, setCursor] = useState<[number, number]>([0.5, 0.5]);
  const [score, setScore] = useState<Score | null>(null),
    [best, setBest] = useState<Score | null>(null),
    [notice, setNotice] = useState("");
  const [baseline, setBaseline] = useState<Run | null>(data.latest);
  const clock = useRef(0),
    targetClock = useRef(0),
    timer = useRef(0),
    phaseRef = useRef(phase),
    missRef = useRef(0),
    indexRef = useRef(0),
    input = useRef("pointer");
  const frozenRules = useRef(data.rules),
    frozenHash = useRef(data.rulesHash);
  const change = (p: typeof phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ratlab:aim-eight:best") || "null",
      );
      if (
        saved?.schemaVersion === 1 &&
        saved.rulesHash === data.rulesHash &&
        Number.isFinite(saved.durationMs) &&
        saved.durationMs > 0
      )
        setBest(saved);
    } catch {
      /* Storage is optional. */
    }
  }, [data.rulesHash]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!["playing", "settling"].includes(phase)) return;
    const id = setInterval(() => {
      const now = performance.now();
      setElapsed(now - clock.current);
      if (
        phaseRef.current === "playing" &&
        now - targetClock.current > frozenRules.current.targetTimeoutMs
      ) {
        change("timeout");
        clearTimeout(timer.current);
      }
    }, 40);
    return () => clearInterval(id);
  }, [phase]);
  const start = () => {
    clearTimeout(timer.current);
    frozenRules.current = data.rules;
    frozenHash.current = data.rulesHash;
    setBaseline(data.latest);
    setScore(null);
    setNotice("");
    setElapsed(0);
    setMisses(0);
    missRef.current = 0;
    indexRef.current = 0;
    setIndex(0);
    setCursor([0.5, 0.5]);
    input.current = "pointer";
    change("countdown");
    timer.current = window.setTimeout(() => {
      clock.current = performance.now();
      targetClock.current = clock.current;
      change("playing");
    }, data.rules.initialDelayMs);
  };
  const press = (p: [number, number]) => {
    if (phaseRef.current !== "playing") return;
    setCursor(p);
    const target = frozenRules.current.targets[indexRef.current];
    if (
      Math.abs(p[0] - target[0]) > target[2] ||
      Math.abs(p[1] - target[1]) > target[3]
    ) {
      missRef.current++;
      setMisses(missRef.current);
      return;
    }
    indexRef.current++;
    setIndex(indexRef.current);
    if (indexRef.current === 8) {
      const time = Math.round(performance.now() - clock.current);
      setElapsed(time);
      change("done");
      const result: Score = {
        schemaVersion: 1,
        rulesHash: frozenHash.current,
        ratRunId: baseline?.id || "none",
        ratProof: baseline?.proof || "",
        ratDurationMs: baseline?.durationMs || 0,
        durationMs: time,
        misses: missRef.current,
        at: new Date().toISOString(),
        input: input.current,
      };
      setScore(result);
      if (
        !best ||
        best.rulesHash !== result.rulesHash ||
        result.durationMs < best.durationMs
      ) {
        setBest(result);
        try {
          localStorage.setItem("ratlab:aim-eight:best", JSON.stringify(result));
        } catch {
          setNotice("Result is ready. Browser storage is unavailable.");
        }
      }
    } else {
      change("settling");
      timer.current = window.setTimeout(() => {
        targetClock.current = performance.now();
        change("playing");
      }, frozenRules.current.betweenDelayMs);
    }
  };
  useEffect(() => {
    const pause = () => {
      if (
        document.hidden &&
        ["countdown", "playing", "settling"].includes(phaseRef.current)
      ) {
        clearTimeout(timer.current);
        change("timeout");
        setNotice(
          "Round ended because the page was hidden. Start again for a timed comparison.",
        );
      }
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  const target =
    phase === "playing" ? frozenRules.current.targets[index] : null;
  return (
    <div className="challenge-layout">
      <section className="lab-panel challenge-main">
        <div className="panel-heading">
          <span className="lab-label">01 / YOUR TURN</span>
          <span className="state-tag">
            {phase === "done"
              ? "ROUND COMPLETE"
              : phase === "timeout"
                ? "ROUND ENDED"
                : "LOCAL PRACTICE"}
          </span>
        </div>
        <div className="challenge-score">
          <div>
            <small>YOUR TIME</small>
            <strong>{seconds(elapsed)}</strong>
          </div>
          <div>
            <small>TARGETS</small>
            <strong>
              {index}
              <em>/ 8</em>
            </strong>
          </div>
          <div>
            <small>MISSES</small>
            <strong>{misses}</strong>
          </div>
        </div>
        <div className="challenge-board-wrap">
          <AimBoard
            target={target}
            cursor={cursor}
            index={index}
            interactive
            onPoint={press}
            onKey={(e) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  " ",
                ].includes(e.key)
              ) {
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
              }
            }}
          />
          {phase !== "playing" && (
            <div className="arena-overlay">
              <span className="lab-label">
                {phase === "settling"
                  ? "SAME SETTLE PERIOD AS R-01"
                  : phase === "countdown"
                    ? "GET READY"
                    : "AIM EIGHT"}
              </span>
              <h2>
                {phase === "ready"
                  ? "Eight targets. Your move."
                  : phase === "countdown"
                    ? "Find your focus."
                    : phase === "settling"
                      ? "Next target…"
                      : phase === "done"
                        ? "A run of your own."
                        : "Try another round."}
              </h2>
              {["ready", "done", "timeout"].includes(phase) && (
                <button className="lab-button primary" onClick={start}>
                  {phase === "ready" ? "Start challenge" : "Play again"}
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="arena-foot">
          <span>
            Click inside each gold rectangle. Arrow keys + Space also work.
          </span>
          {["playing", "settling", "countdown"].includes(phase) && (
            <button
              onClick={() => {
                clearTimeout(timer.current);
                change("ready");
                setIndex(0);
                setElapsed(0);
                setMisses(0);
              }}
            >
              <ArrowCounterClockwise size={15} /> Reset
            </button>
          )}
        </div>
      </section>
      <aside className="challenge-side">
        <div className="lab-panel rat-benchmark">
          <div className="panel-heading">
            <span className="lab-label">02 / THE SUBJECT</span>
            <span className="tiny-status">RECORDED</span>
          </div>
          <img src="/brand/rat-avatar.png" alt="RAT LAB mascot illustration" />
          <h2>Meet your benchmark.</h2>
          <p>
            R-01 uses its head to aim and its lever to click. You use a pointer
            or keyboard.
          </p>
          <div className="benchmark-number">
            {baseline?.complete ? seconds(baseline.durationMs) : "—"}
            <span>
              {baseline?.complete
                ? `${baseline.hits}/8 hits · ${baseline.misses} misses`
                : "Waiting for a completed neural run"}
            </span>
          </div>
          <p className="lab-small">
            Same target sequence and settle periods. The rat uses simulation
            time; your round uses browser time. Device and input differences
            matter.
          </p>
        </div>
        <div className="lab-panel personal-best">
          <span className="lab-label">YOUR PERSONAL BEST</span>
          <strong>
            {best ? seconds(best.durationMs) : "Make your first run."}
          </strong>
          <p className="lab-small">
            Saved in this browser. Practice scores are self-reported, not a
            verified global leaderboard.
          </p>
        </div>
      </aside>
      {score && (
        <section className="lab-panel score-result" aria-live="polite">
          <div>
            <span className="lab-label">YOUR FIELD NOTE</span>
            <h2>
              {seconds(score.durationMs)} · {score.misses} misses
            </h2>
            <p>
              {baseline?.complete
                ? `${score.durationMs < baseline.durationMs ? "Faster" : "Slower"} than this recorded rat run by ${seconds(Math.abs(score.durationMs - baseline.durationMs))}.`
                : "Your practice round is complete."}
            </p>
          </div>
          <div className="result-actions">
            <button
              className="lab-button"
              onClick={() =>
                downloadJson(score, "ratlab-aim-eight-result.json")
              }
            >
              <DownloadSimple size={17} />
              Save result
            </button>
            <button
              className="lab-button primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `I completed RAT LAB Aim Eight in ${seconds(score.durationMs)} with ${score.misses} misses. Local practice, same targets as R-01. https://rat-lab.fun/challenge`,
                  );
                  setNotice("Result text copied.");
                } catch {
                  setNotice("Copy is unavailable. Use Save result instead.");
                }
              }}
            >
              {notice === "Result text copied." ? (
                <Check size={17} />
              ) : (
                <Copy size={17} />
              )}
              Copy score
            </button>
          </div>
        </section>
      )}
      {notice && (
        <p className="lab-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

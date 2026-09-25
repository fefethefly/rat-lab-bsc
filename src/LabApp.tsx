import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Pause,
  ArrowCounterClockwise,
  DownloadSimple,
  CheckCircle,
  Fingerprint,
  Clock,
  GitBranch,
  WifiHigh,
  WifiSlash,
  List,
  X,
  Flask,
  Cube,
  Crosshair,
} from "@phosphor-icons/react";
import BrandMark from "./components/BrandMark";
import Viewer from "./components/Viewer";
import AimBoard from "./components/AimBoard";
import Challenge from "./components/Challenge";
import MusicStudio from "./components/MusicStudio";
import FirstTakes from "./components/FirstTakes";
import { MissionStudio, CommunityMission } from "./components/MissionStudio";
import RecordedRat from "./components/RecordedRat";
import SessionFlow from "./components/SessionFlow";
import { useDuelRecording, hitsAt } from "./lib/duel";
import {
  useExperiment,
  seconds,
  shortHash,
  downloadJson,
  type Experiment,
  type Run,
} from "./lib/experiment";
import "./public.css";
import "./lab.css";
const titles = {
  "first-takes": [
    "Small movements. Lasting notes.",
    "First Takes — four behavioral scores from a very small performer.",
  ],
  music: [
    "You write the notes. It finds its rhythm.",
    "Eight notes, four keys, one real attempt. Make a score for a very small performer.",
  ],
  create: [
    "A new problem. Your signature.",
    "Move the targets. Name the mission. Give the rat something of your own to attempt.",
  ],
  live: [
    "The experiment continues.",
    "Watch the head aim. Watch the lever press. Follow every result.",
  ],
  buyback: [
    "Every allocation, accounted for.",
    "A transparent rehearsal for BNB buybacks, tied to verified neural runs.",
  ],
  challenge: [
    "Eight targets. You vs R-01.",
    "Race a verified rat recording. Every head movement, lever press and split, side by side.",
  ],
};
const when = (date: string) =>
  new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
function RunDetails({ run }: { run: Run }) {
  return (
    <details className="proof-details">
      <summary>
        <Fingerprint size={16} />
        Inspect session proof
        <ArrowUpRight size={14} />
      </summary>
      <dl>
        <dt>Session</dt>
        <dd>{run.id}</dd>
        <dt>Brain fingerprint</dt>
        <dd>{run.brainCommit}</dd>
        <dt>Session proof</dt>
        <dd>{run.proof}</dd>
        <dt>Rules fingerprint</dt>
        <dd>{run.rulesHash}</dd>
      </dl>
      <p>
        Replay verification checks neural actions, physics frames and clicks on
        the recording host. These fingerprints identify artifacts; they are not
        an on-chain transaction.
      </p>
      <button
        className="lab-button"
        onClick={() => downloadJson(run, `${run.id}.json`)}
      >
        <DownloadSimple size={16} />
        Download public record
      </button>
    </details>
  );
}
function Live({
  data,
  online,
  relay,
}: {
  data: Experiment;
  online: boolean;
  relay: string;
}) {
  const live = online && data.phase === "running" && data.current !== null;
  const { recording } = useDuelRecording();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const run = !live && recording ? recording.run : data.latest;
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [at, setAt] = useState(0),
    [view, setView] = useState<"surface" | "subject">("subject");
  const clipEnd = run?.samples?.at(-1)?.atMs || 0;
  const start = run?.firstTargetMs || 0;
  useEffect(() => {
    setAt(start);
  }, [run?.id, start, live]);
  useEffect(() => {
    if (live || !playing || !run) return;
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      setAt((v) => (v + dt > clipEnd ? start : v + dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, playing, run?.id, clipEnd, start]);
  const samples = run?.samples || [];
  const selected =
    [...samples].reverse().find((s) => s.atMs <= at) || samples[0];
  const s = live
    ? data.current
    : selected && run
      ? {
          ...selected,
          hits: hitsAt(run, at - start),
          misses: (run.clicks || []).filter((c) => !c.hit && c.atMs <= at)
            .length,
        }
      : selected;
  const target = live
    ? data.current?.target
    : s && s.targetIndex >= 0
      ? data.rules.targets[s.targetIndex]
      : null;
  const trace = live
    ? []
    : samples
        .filter((p) => p.atMs <= at && p.atMs > at - 1800)
        .map((p) => p.cursor);
  const label = live
    ? "LIVE INFERENCE"
    : data.phase === "verifying" && online
      ? "VERIFYING NEW RUN"
      : "RECORDED RUN";
  return (
    <>
      {live && data.current?.challengeId && (
        <div className="mission-race-invite">
          <span>Community mission in progress</span>
          <a href={`/challenge?id=${data.current.challengeId}`}>
            Open this mission <ArrowUpRight size={16} />
          </a>
        </div>
      )}
      <div className="live-layout">
        <section className="lab-panel observation-panel">
          <div className="panel-heading">
            <span className={"state-tag " + (live ? "active" : "")}>
              <i />
              {label}
            </span>
            <div className="view-switch" aria-label="Experiment view">
              <button
                aria-pressed={view === "surface"}
                onClick={() => setView("surface")}
              >
                <Crosshair size={15} />
                Control surface
              </button>
              <button
                aria-pressed={view === "subject"}
                onClick={() => setView("subject")}
              >
                <Cube size={15} />
                Subject view
              </button>
            </div>
          </div>
          {view === "subject" ? (
            <div className="live-subject">
              {live && relay ? (
                <Viewer running observerRelay={relay} />
              ) : recording ? (
                <RecordedRat recording={recording} atMs={at} />
              ) : (
                <div className="subject-standby">
                  <Clock size={24} />
                  <h2>Preparing the recorded subject…</h2>
                  <button
                    className="lab-button"
                    onClick={() => setView("surface")}
                  >
                    View cursor replay
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="live-surface">
              <AimBoard
                target={target || null}
                cursor={s?.cursor || [0.5, 0.5]}
                index={s?.targetIndex || 0}
                trail={trace}
              />
              {!s && (
                <div className="arena-overlay">
                  <h2>Preparing the first experiment.</h2>
                  <p>A verified result will appear after the first run.</p>
                </div>
              )}
            </div>
          )}
          <div className="arena-foot">
            <div className="playback-actions">
              <button
                aria-label={playing ? "Pause replay" : "Play replay"}
                disabled={live || !run}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                aria-label="Restart replay"
                disabled={live || !run}
                onClick={() => {
                  setAt(start);
                  setPlaying(true);
                }}
              >
                <ArrowCounterClockwise size={17} />
              </button>
              <span>
                {live
                  ? seconds(data.current?.elapsedMs || 0)
                  : seconds(
                      Math.min(run?.durationMs || 0, Math.max(0, at - start)),
                    )}
                <em> / {run ? seconds(run.durationMs) : "—"}</em>
              </span>
            </div>
            <span className="lab-label">
              {live
                ? "NEURAL POLICY → CURSOR → LEVER"
                : view === "subject"
                  ? "VERIFIED BODY REPLAY · NOT LIVE"
                  : "RAT LAB RECORDING · NOT LIVE"}
            </span>
          </div>
          <div
            className="target-progress"
            aria-label={`${s?.hits || 0} of 8 targets hit`}
          >
            {data.rules.targets.map((_, i) => (
              <div
                key={i}
                className={
                  i < (s?.hits || 0)
                    ? "done"
                    : s?.targetIndex === i
                      ? "current"
                      : ""
                }
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {i < (s?.hits || 0) ? <CheckCircle size={17} /> : <i />}
              </div>
            ))}
          </div>
          <p className="panel-note">
            {live
              ? "A trained policy is running now. No model weights are being updated."
              : "Recorded Aim Eight session. Body motion, cursor and score share one verified run. The next live experiment connects automatically."}
          </p>
        </section>
        <aside className="lab-panel telemetry-panel">
          <div className="panel-heading">
            <span className="lab-label">SUBJECT / R–01</span>
            <span className="tiny-status">BNB LAB</span>
          </div>
          <div className="subject-mini">
            <img
              src="/brand/rat-avatar.png"
              alt="RAT LAB mascot illustration"
            />
            <div>
              <h2>
                Small subject.
                <br />
                Real observations.
              </h2>
              <span>Two trained policies · MuJoCo</span>
            </div>
          </div>
          <dl className="telemetry-list">
            <div>
              <dt>Task</dt>
              <dd>Aim Eight</dd>
            </div>
            <div>
              <dt>Current phase</dt>
              <dd>{online ? data.phase : "offline / replay"}</dd>
            </div>
            <div>
              <dt>Hits / misses</dt>
              <dd>
                {s?.hits || 0} / {s?.misses || 0}
              </dd>
            </div>
            <div>
              <dt>{live ? "Last run time" : "Displayed replay time"}</dt>
              <dd>{run ? seconds(run.durationMs) : "—"}</dd>
            </div>
            <div>
              <dt>Next experiment</dt>
              <dd>
                {online && data.nextRunAt
                  ? `in ${Math.max(0, Math.ceil((Date.parse(data.nextRunAt) - now) / 1000))}s`
                  : live
                    ? "Running now"
                    : "Pending"}
              </dd>
            </div>
            <div>
              <dt>Last service update</dt>
              <dd>{when(data.updatedAt)}</dd>
            </div>
          </dl>
          <div className="verification-note">
            <CheckCircle size={20} />
            <div>
              <strong>
                {run?.verified ? "Replay matched" : "Awaiting verification"}
              </strong>
              <p>
                {run?.verified
                  ? "This recorded session reproduced identical frames and clicks on its recording host."
                  : "Results appear after the verification step."}
              </p>
            </div>
          </div>
          <a className="lab-button primary full-width" href="/challenge">
            Try the same targets
            <ArrowRight size={17} />
          </a>
          {run && <RunDetails run={run} />}
        </aside>
      </div>
      <SessionFlow data={data} />
      <section className="run-history">
        <div className="lab-section-title">
          <div>
            <span className="lab-label">THE FIELD LOG</span>
            <h2>Every attempt belongs here.</h2>
          </div>
          <span className="lab-small">
            Latest {data.history.length} sessions · current service window
          </span>
        </div>
        <div className="history-table">
          <div className="history-header">
            <span>SESSION / LOCAL TIME</span>
            <span>HITS</span>
            <span>TIME</span>
            <span>REPLAY</span>
            <span>RECORD</span>
          </div>
          {data.history.length ? (
            data.history.slice(0, 8).map((r) => (
              <div className="history-row" key={r.id}>
                <span>
                  <b>{r.id}</b>
                  <small>
                    {when(r.endedAt)}
                    {r.failure ? ` · ${r.failure}` : ""}
                  </small>
                </span>
                <span>
                  {r.hits}
                  <em>/8</em>
                </span>
                <span>{seconds(r.durationMs)}</span>
                <span className={r.verified ? "verified-text" : ""}>
                  {r.verified ? "MATCH" : "UNVERIFIED"}
                </span>
                <button
                  aria-label={`Download record ${r.id}`}
                  onClick={() => downloadJson(r, `${r.id}.json`)}
                >
                  <DownloadSimple size={18} />
                </button>
              </div>
            ))
          ) : (
            <p className="empty-records">
              No completed sessions yet. The first run is being prepared.
            </p>
          )}
        </div>
        <p className="lab-small">
          Runs use fixed upstream trained policies. This is inference, not a
          claim that the model is learning or improving between runs. The
          service retains its latest 24 summaries.
        </p>
      </section>
    </>
  );
}
function Buyback({ data, online }: { data: Experiment; online: boolean }) {
  const b = data.buyback;
  const [hits, setHits] = useState(8);
  const [record, setRecord] = useState<string | null>(null);
  const [chain, setChain] = useState<{
    checkedAt: string;
    block: string;
    buyTaxBps: number;
    sellTaxBps: number;
    token: string;
  } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/experiment/chain.json", { signal: c.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (
          j &&
          Number.isInteger(j.buyTaxBps) &&
          Number.isInteger(j.sellTaxBps) &&
          /^0x[a-f\d]{40}$/i.test(j.token)
        )
          setChain(j);
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  return (
    <>
      <div className="buyback-notice">
        <Flask size={21} />
        <div>
          <strong>Simulation is running. Real purchases are disabled.</strong>
          <span>
            Verified neural hits feed a paper budget. No funds are reserved, and
            no swaps have been sent.
          </span>
        </div>
        <span className="state-tag">SIMULATION</span>
      </div>
      <SessionFlow data={data} />
      <div className="buyback-layout">
        <section className="lab-panel budget-panel">
          <div className="panel-heading">
            <span className="lab-label">01 / PAPER ALLOCATION</span>
            <span className="tiny-status">
              {online ? "CURRENT SERVICE WINDOW" : "SAVED SNAPSHOT"}
            </span>
          </div>
          <div className="budget-total">
            {b.allocatedBnb}
            <span>BNB</span>
          </div>
          <p>
            Illustrative budget generated from unique, replay-verified sessions.
          </p>
          <div className="budget-meter">
            <span
              style={{
                width:
                  Math.min(
                    100,
                    (Number(b.allocatedBnb) / Number(b.windowCapBnb)) * 100,
                  ) + "%",
              }}
            />
          </div>
          <div className="meter-label">
            <span>Allocated in simulation</span>
            <span>{b.windowCapBnb} BNB window cap</span>
          </div>
          <div className="budget-stats">
            <div>
              <small>PER VERIFIED HIT</small>
              <strong>
                {b.perHitBnb}
                <em> BNB</em>
              </strong>
            </div>
            <div>
              <small>CONFIRMED PURCHASES</small>
              <strong>
                0<em> transactions</em>
              </strong>
            </div>
          </div>
          <div className="allocation-flow">
            <span>Neural hit</span>
            <ArrowRight size={15} />
            <span>Replay check</span>
            <ArrowRight size={15} />
            <span>Paper allocation</span>
          </div>
          <p className="panel-note">
            Replays and duplicate session proofs never count twice. {b.scope}
          </p>
        </section>
        <aside className="lab-panel funding-panel">
          <div className="panel-heading">
            <span className="lab-label">02 / FUNDING & EXECUTION</span>
            <span className="state-tag">NOT ARMED</span>
          </div>
          <h2>
            Show the money.
            <br />
            Before spending it.
          </h2>
          <dl className="telemetry-list">
            <div>
              <dt>Buyback wallet</dt>
              <dd>Not assigned</dd>
            </div>
            <div>
              <dt>Funded budget</dt>
              <dd>Not configured</dd>
            </div>
            <div>
              <dt>BNB spent by this engine</dt>
              <dd>0 BNB</dd>
            </div>
            <div>
              <dt>RAT purchased / burned</dt>
              <dd>0 / 0</dd>
            </div>
            <div>
              <dt>Token buy / sell tax</dt>
              <dd>
                {chain
                  ? `${chain.buyTaxBps / 100}% / ${chain.sellTaxBps / 100}%`
                  : "Not checked"}
              </dd>
            </div>
          </dl>
          {chain && (
            <p className="lab-small">
              Tax rates read at block {chain.block} ·{" "}
              {new Date(chain.checkedAt).toLocaleString()}. This is a saved
              chain snapshot, not available buyback revenue.
            </p>
          )}
          <a
            className="lab-text-link"
            href="https://bscscan.com/token/0xC090F3c8825b1ca46ae85Cf5D809f191764B7777"
            target="_blank"
            rel="noreferrer"
          >
            Inspect the RAT contract
            <ArrowUpRight size={16} />
          </a>
        </aside>
      </div>
      <div className="buyback-bottom">
        <section>
          <div className="lab-section-title">
            <div>
              <span className="lab-label">THE ALLOCATION LEDGER</span>
              <h2>Trace every simulated batch.</h2>
            </div>
            <button
              className="lab-text-link"
              onClick={() => downloadJson(b, "ratlab-paper-allocations.json")}
            >
              Export JSON
              <DownloadSimple size={16} />
            </button>
          </div>
          <div className="allocation-table">
            {b.records.length ? (
              b.records.slice(0, 12).map((r) => (
                <article key={r.id}>
                  <button
                    onClick={() => setRecord(record === r.id ? null : r.id)}
                    aria-expanded={record === r.id}
                  >
                    <span>
                      <b>{r.eligibleHits} verified hits</b>
                      <small>
                        {when(r.at)} · {r.runId}
                      </small>
                    </span>
                    <span>
                      {r.amountBnb}
                      <em> BNB</em>
                    </span>
                    <span className="state-tag">SIMULATED</span>
                    <ArrowUpRight size={16} />
                  </button>
                  {record === r.id && (
                    <div className="allocation-details">
                      <span>Session proof</span>
                      <code>{r.proof}</code>
                      <p>
                        {r.hits - r.eligibleHits} hits excluded by the
                        service-window cap. No transaction hash exists because
                        no purchase was made.
                      </p>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-records">
                The first verified run will create a simulated allocation here.
              </div>
            )}
          </div>
        </section>
        <aside className="lab-panel calculator">
          <span className="lab-label">EXPLORE THE RULE</span>
          <h2>What would {hits} hits mean?</h2>
          <label htmlFor="hits-range">
            Hypothetical verified hits <strong>{hits}</strong>
          </label>
          <input
            id="hits-range"
            type="range"
            min="0"
            max="200"
            step="1"
            value={hits}
            onChange={(e) => setHits(Number(e.target.value))}
          />
          <div className="calculator-value">
            {(hits * Number(b.perHitBnb)).toFixed(6)}
            <small> BNB</small>
          </div>
          <p>
            Illustration before the window cap. Moving this slider changes no
            session, budget or transaction.
          </p>
          <a className="lab-text-link" href="/live">
            Watch the actual experiment
            <ArrowRight size={17} />
          </a>
        </aside>
      </div>
      <section className="execution-gates">
        <span className="lab-label">BEFORE REAL EXECUTION</span>
        <p>
          A dedicated funded wallet, a reviewed budget, a verified swap route
          and receipt reconciliation must be configured before real buybacks can
          start. Purchased and burned amounts will be recorded separately.
        </p>
      </section>
    </>
  );
}
export default function LabApp() {
  const page = (location.pathname.replace(/\/$/, "").slice(1) ||
    "live") as keyof typeof titles;
  const known = page in titles;
  const missionId =
    page === "challenge"
      ? new URLSearchParams(location.search).get("id")
      : null;
  const workspace =
    page === "challenge" ||
    page === "create" ||
    page === "music" ||
    page === "first-takes";
  const [menu, setMenu] = useState(false);
  const { data, online, error, retry } = useExperiment(!workspace && known);
  const [relay, setRelay] = useState("");
  useEffect(() => {
    if (page !== "live") return;
    fetch("/experiment/config.json")
      .then((r) => r.json())
      .then((j) => {
        if (
          typeof j.statusUrl === "string" &&
          /^https:\/\/[a-z0-9.-]+\.up\.railway\.app\/status$/.test(j.statusUrl)
        )
          setRelay(
            j.statusUrl
              .replace("https:", "wss:")
              .replace("/status", "/ws/live"),
          );
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    document.title = `RAT LAB · ${known ? (page === "live" ? "Live experiment" : page === "buyback" ? "Buyback ledger" : page === "create" ? "Mission studio" : page === "music" ? "Music studio" : page === "first-takes" ? "First Takes" : "Aim Eight challenge") : "Page not found"}`;
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute("href", `https://rat-lab.fun/${known ? page : ""}`);
  }, [page, known]);
  return (
    <div className={`public-site lab-site lab-page-${page}`}>
      <a className="site-skip" href="#lab-main">
        Skip to content
      </a>
      <header className="lab-nav">
        <a className="site-brand" href="/" aria-label="RAT LAB home">
          <BrandMark />
          <span>
            ratlab<span className="brand-period">.</span>
          </span>
          <span className="nav-lab-tag">THE LIVE LAB</span>
        </a>
        <nav className={menu ? "open" : ""} aria-label="Lab navigation">
          {[
            ["/", "Overview"],
            ["/live", "Observe"],
            ["/buyback", "Buybacks"],
            ["/challenge", "Race"],
            ["/music", "Music"],
            ["/first-takes", "First Takes"],
            ["/create", "Create a mission"],
          ].map(([url, label]) => (
            <a
              key={url}
              href={url}
              aria-current={url === `/${page}` ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          className="lab-source"
          href="https://github.com/fefethefly/rat-lab-bsc"
          target="_blank"
          rel="noreferrer"
        >
          <GitBranch size={17} />
          <span>Source</span>
          <ArrowUpRight size={14} />
        </a>
        <button
          className="lab-menu"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? <X size={23} /> : <List size={23} />}
        </button>
      </header>
      <main id="lab-main" className="lab-main">
        {known ? (
          <>
            <div className="lab-lead">
              <div>
                <span className="lab-label">
                  <i className="yellow-dot" />
                  FIELD STATION 002 /{" "}
                  {page === "live"
                    ? "OBSERVATION"
                    : page === "buyback"
                      ? "BNB BUYBACKS"
                      : page === "create"
                        ? "MISSION STUDIO"
                        : page === "first-takes"
                          ? "FIRST TAKES"
                          : page === "music"
                            ? "MUSIC STUDIO"
                            : "AIM EIGHT"}
                </span>
                <h1>
                  {missionId
                    ? "Someone set the test. Your move."
                    : titles[page][0]}
                </h1>
                <p>
                  {missionId
                    ? "One community design. One recorded attempt. A result you can come back to."
                    : titles[page][1]}
                </p>
              </div>
              <div className={"connection-state " + (online ? "online" : "")}>
                {workspace ? (
                  <CheckCircle size={17} />
                ) : online ? (
                  <WifiHigh size={17} />
                ) : (
                  <WifiSlash size={17} />
                )}
                <span>
                  {workspace
                    ? page === "first-takes"
                      ? "Recording archive"
                      : page === "music"
                        ? "Music studio"
                        : page === "create"
                          ? "Mission studio"
                          : missionId
                            ? "Community mission"
                            : "Recorded opponent"
                    : online
                      ? "Observer connected"
                      : "Saved experiment"}
                  <small>
                    {workspace
                      ? page === "first-takes"
                        ? "Behavioral studies · open listening"
                        : page === "music"
                          ? "Original scores · real hit timing"
                          : page === "create"
                            ? "Public beta · saved designs"
                            : missionId
                              ? "Saved design & attempt"
                              : "Paired motion & click timestamps"
                      : online
                        ? "Neural inference · not training"
                        : "Recorded data · not live"}
                  </small>
                </span>
              </div>
            </div>
            {error && !workspace && (
              <div className="connection-notice" role="status">
                <span>{error}</span>
                <button onClick={retry}>Retry connection</button>
              </div>
            )}
            {page === "first-takes" ? (
              <FirstTakes />
            ) : page === "music" ? (
              <MusicStudio />
            ) : page === "create" ? (
              <MissionStudio />
            ) : page === "challenge" ? (
              missionId ? (
                <CommunityMission id={missionId} />
              ) : (
                <>
                  <div className="mission-race-invite">
                    <span>Your own rules next?</span>
                    <a href="/create">
                      Design a mission <ArrowUpRight size={16} />
                    </a>
                  </div>
                  <Challenge />
                </>
              )
            ) : data ? (
              page === "live" ? (
                <Live data={data} online={online} relay={relay} />
              ) : (
                <Buyback data={data} online={online} />
              )
            ) : (
              <div className="lab-loading" role="status">
                <Flask size={32} />
                <h2>{error ? "Experiment unavailable" : "Opening the lab…"}</h2>
                <p>{error || "Loading the latest verified session."}</p>
                {error && (
                  <button className="lab-button" onClick={retry}>
                    Try again
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="lab-loading">
            <h1>This room does not exist.</h1>
            <a className="lab-button primary" href="/live">
              Back to the experiment
              <ArrowRight size={18} />
            </a>
          </div>
        )}
      </main>
      <footer className="lab-footer">
        <div>
          <BrandMark />
          <span>
            RAT LAB
            <span className="lab-small">
              Independent virtual rodent experiment on BNB Chain.
            </span>
          </span>
        </div>
        <p>
          Artificial networks, simulated body. Research model credited to{" "}
          <a
            href="https://github.com/LabratDevRH/labrat"
            target="_blank"
            rel="noreferrer"
          >
            Labrat
          </a>{" "}
          and DeepMind. No biological brain.
        </p>
        <a href="/#evidence">
          Launch evidence
          <ArrowUpRight size={15} />
        </a>
      </footer>
    </div>
  );
}

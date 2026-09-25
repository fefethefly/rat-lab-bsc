import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  DownloadSimple,
  Fingerprint,
  Flask,
  List,
  X,
  Plus,
  Minus,
  Crosshair,
  GitBranch,
  ShieldCheck,
} from "@phosphor-icons/react";
import Viewer from "./components/Viewer";
import BrandMark from "./components/BrandMark";
import MechanismDemo from "./components/MechanismDemo";
import { isRelease, type Release } from "./lib/release";
import "./public.css";
import "./lab.css";

const stages = [
  [
    "Define the subject",
    "Image · name · ticker",
    "01—03",
    "The operator chooses the artwork, name and ticker before the run. The rat hits each corresponding target on the virtual control surface.",
  ],
  [
    "Set the conditions",
    "Description · chain · economics",
    "04—06",
    "Preset metadata, BNB Chain and tax settings are bound to the launch plan. The rat advances the targets; it does not choose the financial parameters.",
  ],
  [
    "Review the intent",
    "Pinned launch manifest",
    "07",
    "The launch plan fixes the inputs and transaction. The rig checks the plan, simulation and approved budget before it can proceed.",
  ],
  [
    "Complete the sequence",
    "Final target · replay check",
    "08",
    "All eight targets and a matching neural replay are required. The local runner then checks the transaction and submits within the approved plan.",
  ],
];
const faqs = [
  [
    "Is this a real rat brain?",
    "No. R-01 is a virtual rodent body controlled by two artificial neural networks in MuJoCo. No animal or biological brain is involved. The body model comes from DeepMind’s open-source dm_control research.",
  ],
  [
    "What exactly does the rat decide?",
    "Its networks produce motor actions to aim the cursor and press the lever. People choose the token metadata and financial parameters. In RAT LAB, the eight targets belong to a virtual control surface, not the Flap website.",
  ],
  [
    "Is the observation room live?",
    "This public-source homepage displays an original mascot illustration. The hosted homepage displays a labeled upstream reference recording. The Observe page streams RAT LAB’s own Aim Eight sessions and clearly separates live inference from saved playback. The launch evidence is separate.",
  ],
  [
    "How can I verify a release?",
    "After receipt verification and deterministic replay succeed, the publisher generates a release record containing the contract, transaction, brain fingerprint and session proof. The evidence section links to that record and BscScan when available.",
  ],
];

export default function PublicApp() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "unpublished" | "error"
  >("loading");
  const [retry, setRetry] = useState(0);
  const [menu, setMenu] = useState(false);
  const [stage, setStage] = useState(0);
  const [proofTab, setProofTab] = useState<"receipt" | "brain" | "session">(
    "receipt",
  );
  const [copyState, setCopyState] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let active = true;
    setLoadState("loading");
    fetch("/release.json", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (
          r.status === 404 ||
          (r.ok && r.headers.get("content-type")?.includes("text/html"))
        ) {
          if (active) setLoadState("unpublished");
          return;
        }
        if (!r.ok) throw new Error("Release request failed");
        const data: unknown = await r.json();
        if (!isRelease(data)) throw new Error("Incomplete release record");
        if (active) {
          setRelease(data);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) setLoadState("error");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [retry]);
  useEffect(() => {
    if (!copyState) return;
    const t = setTimeout(() => setCopyState(""), 4000);
    return () => clearTimeout(t);
  }, [copyState]);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("Copied to clipboard.");
    } catch {
      setCopyState("Copy unavailable. Select the displayed value to copy it.");
    }
  };
  const status =
    loadState === "ready"
      ? "RELEASE RECORDED"
      : loadState === "loading"
        ? "CHECKING RELEASE"
        : loadState === "error"
          ? "RECORD UNAVAILABLE"
          : "AWAITING RELEASE RECORD";
  return (
    <div className="public-site" id="top">
      <a className="site-skip" href="#main">
        Skip to content
      </a>
      <header className="site-nav">
        <a className="site-brand" href="#top" aria-label="RAT LAB home">
          <BrandMark />
          <span>
            ratlab<span className="brand-period">.</span>
          </span>
          <span className="site-edition site-mono">
            FIELD STATION
            <br />
            NO. 002
          </span>
        </a>
        <nav
          className={menu ? "site-navlinks is-open" : "site-navlinks"}
          aria-label="Main navigation"
        >
          <a href="/live" onClick={() => setMenu(false)}>
            Observe
          </a>
          <a href="/buyback" onClick={() => setMenu(false)}>
            Buybacks
          </a>
          <a href="/challenge" onClick={() => setMenu(false)}>
            Challenge
          </a>
          <a href="#mechanism" onClick={() => setMenu(false)}>
            The mechanism
          </a>
          <a href="#evidence" onClick={() => setMenu(false)}>
            Evidence <span className="nav-counter">03</span>
          </a>
        </nav>
        <div className="site-nav-actions">
          <a
            className="site-social"
            href="https://x.com/gouyi420"
            target="_blank"
            rel="noreferrer"
          >
            Follow the experiment <ArrowUpRight size={16} />
          </a>
          <button
            className="site-menu"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={23} /> : <List size={23} />}
          </button>
        </div>
      </header>
      <main id="main" className="site-main">
        <section className="site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <div className="site-mono section-kicker">
              <span className="site-status-dot" /> AN INDEPENDENT NEURAL
              EXPERIMENT
            </div>
            <h1 id="hero-title">
              A small rat.
              <br />A bigger
              <br />
              <span>question.</span>
            </h1>
            <p className="hero-question">
              Can learned behavior leave an on-chain signature?
            </p>
            <p className="site-description">
              Two neural networks. One virtual body. Eight physical targets.
              Meet R-01, our subject in an experiment on BNB Chain.
            </p>
            <div className="site-hero-actions">
              <a className="site-button accent" href="/live">
                Enter the live lab <ArrowDown size={18} />
              </a>
              <a className="site-inline-link" href="#evidence">
                Inspect the evidence <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="hero-footnote site-mono">
              <span className="tiny-bracket">[ R–01 ]</span>
              <span>
                VIRTUAL BODY. TRAINED POLICIES.
                <br />
                EVERY CLAIM HAS A PLACE TO CHECK.
              </span>
            </div>
          </div>
          <div className="observation-room" id="observation">
            <div className="room-header">
              <div>
                <span className="site-mono">01 / OBSERVATION ROOM</span>
                <strong>Meet the subject.</strong>
              </div>
              <span className="room-replay site-mono">
                <span /> REFERENCE REPLAY
              </span>
            </div>
            <Viewer running={false} replayOnly />
            <div className="room-readout">
              <div>
                <span className="site-mono">SUBJECT</span>
                <strong>
                  R–01 <small>/ virtual rodent</small>
                </strong>
              </div>
              <div>
                <span className="site-mono">ENVIRONMENT</span>
                <strong>
                  MuJoCo <small>/ physics</small>
                </strong>
              </div>
              <span className="orbit-hint site-mono">
                DRAG TO
                <br />
                EXPLORE <ArrowUpRight size={17} />
              </span>
            </div>
            <p className="room-caption">
              An original mascot illustration in this public-source build;
              BSC release evidence is shown separately below.
            </p>
          </div>
        </section>
        <section className="home-live-link">
          <div>
            <strong>The experiment continues.</strong>
            <p>
              Watch our own neural runs, inspect simulated allocations, and try
              the same targets yourself.
            </p>
          </div>
          <a href="/live">
            Enter the live lab <ArrowUpRight size={18} />
          </a>
        </section>
        <section className="site-facts" aria-label="Experiment specifications">
          <div className="facts-intro">
            <Crosshair size={20} />
            <span className="site-mono">
              A BODY IN PHYSICS.
              <br />A PROCESS YOU CAN FOLLOW.
            </span>
          </div>
          {[
            ["02", "TRAINED NETWORKS"],
            ["38", "BODY ACTUATORS"],
            ["50", "CONTROL STEPS / SEC"],
            ["08", "BSC SEQUENCE TARGETS"],
          ].map(([n, l]) => (
            <div key={l} className="site-fact">
              <strong>{n}</strong>
              <span className="site-mono">{l}</span>
            </div>
          ))}
        </section>
        <section className="site-mechanism" id="mechanism">
          <MechanismDemo />
        </section>
        <section className="site-sequence" id="sequence">
          <div className="section-intro">
            <div>
              <span className="site-mono section-kicker">
                03 / THE BSC EXPERIMENT
              </span>
              <h2>
                Eight targets.
                <br />A traceable sequence.
              </h2>
            </div>
            <p className="site-description">
              From a preset intent to a checkable result. Each target is hit on
              RAT LAB’s virtual control surface.
            </p>
          </div>
          <div className="sequence-layout">
            <div
              className="site-stages"
              role="tablist"
              aria-label="Launch sequence stages"
              aria-orientation="vertical"
            >
              {stages.map(([name, sub, number], i) => (
                <button
                  key={name}
                  role="tab"
                  id={"stage-tab-" + i}
                  aria-controls="stage-detail"
                  aria-selected={stage === i}
                  tabIndex={stage === i ? 0 : -1}
                  onClick={() => setStage(i)}
                  onKeyDown={(e) => {
                    const next =
                      e.key === "ArrowDown"
                        ? (i + 1) % 4
                        : e.key === "ArrowUp"
                          ? (i + 3) % 4
                          : e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? 3
                              : null;
                    if (next !== null) {
                      e.preventDefault();
                      setStage(next);
                      document.getElementById("stage-tab-" + next)?.focus();
                    }
                  }}
                >
                  <span className="stage-numbers site-mono">{number}</span>
                  <span>
                    <strong>{name}</strong>
                    <small>{sub}</small>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
              ))}
            </div>
            <div
              className="stage-detail"
              id="stage-detail"
              role="tabpanel"
              aria-labelledby={"stage-tab-" + stage}
              tabIndex={0}
            >
              <div className="site-mono stage-detail-top">
                <span>EXPERIMENT PROTOCOL</span>
                <Flask size={20} />
              </div>
              <div className="stage-illustration" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <span
                    className={
                      (stage === 0 && i < 3) ||
                      (stage === 1 && i >= 3 && i < 6) ||
                      (stage === 2 && i === 6) ||
                      (stage === 3 && i === 7)
                        ? "is-active"
                        : ""
                    }
                    key={i}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                ))}
              </div>
              <span className="site-mono section-kicker">
                TARGETS {stages[stage][2]}
              </span>
              <h3>{stages[stage][0]}</h3>
              <p>{stages[stage][3]}</p>
              <div className="stage-note site-mono">
                <ShieldCheck size={16} /> HUMAN-SET PARAMETERS · NEURAL MOTOR
                ACTIONS
              </div>
            </div>
          </div>
        </section>
        <section className="site-evidence" id="evidence">
          <div className="evidence-intro">
            <span className="site-mono section-kicker">
              04 / THE EVIDENCE DESK
            </span>
            <h2>
              Curiosity is good.
              <br />
              Verification is better.
            </h2>
            <p>
              Follow the transaction. Identify the brain. Inspect the session.
              Three different records, each with a specific job.
            </p>
            <div className="release-state site-mono" role="status">
              <span
                className={"site-status-dot " + (release ? "recorded" : "")}
              />
              {status}
            </div>
            <a
              className="site-inline-link"
              href="https://github.com/LabratDevRH/labrat"
              target="_blank"
              rel="noreferrer"
            >
              Explore the upstream research <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="evidence-file">
            <div className="file-top">
              <span className="site-mono">RAT LAB / RELEASE DOSSIER</span>
              <Fingerprint size={23} />
            </div>
            <div
              className="proof-tabs"
              role="tablist"
              aria-label="Evidence records"
            >
              {(["receipt", "brain", "session"] as const).map((p, i) => (
                <button
                  key={p}
                  id={"proof-tab-" + p}
                  role="tab"
                  aria-controls="proof-content"
                  aria-selected={proofTab === p}
                  tabIndex={proofTab === p ? 0 : -1}
                  onClick={() => setProofTab(p)}
                  onKeyDown={(e) => {
                    const keys = ["receipt", "brain", "session"] as const;
                    const next =
                      e.key === "ArrowRight"
                        ? (i + 1) % 3
                        : e.key === "ArrowLeft"
                          ? (i + 2) % 3
                          : e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? 2
                              : null;
                    if (next !== null) {
                      e.preventDefault();
                      setProofTab(keys[next]);
                      document
                        .getElementById("proof-tab-" + keys[next])
                        ?.focus();
                    }
                  }}
                >
                  {String(i + 1).padStart(2, "0")} / {p}
                </button>
              ))}
            </div>
            <div
              id="proof-content"
              role="tabpanel"
              aria-labelledby={"proof-tab-" + proofTab}
              tabIndex={0}
              className="proof-content"
            >
              {loadState === "loading" ? (
                <div className="release-skeleton" role="status">
                  <span>Loading the release record…</span>
                  <i />
                  <i />
                  <i />
                </div>
              ) : release ? (
                <>
                  <span className="site-mono proof-label">
                    {proofTab === "receipt"
                      ? "BNB SMART CHAIN / FLAP"
                      : proofTab === "brain"
                        ? "BRAIN FINGERPRINT / SHA-256"
                        : "SESSION PROOF / SHA-256"}
                  </span>
                  <h3>
                    {proofTab === "receipt"
                      ? `${release.name} · $${release.symbol}`
                      : proofTab === "brain"
                        ? "The exact brain."
                        : "The recorded process."}
                  </h3>
                  <p>
                    {proofTab === "receipt"
                      ? `Block ${release.block} · Buy tax ${release.buyTaxBps / 100}% / sell tax ${release.sellTaxBps / 100}%`
                      : proofTab === "brain"
                        ? "A fingerprint of the networks, physics scene and inference code used for the session."
                        : "All 8 targets completed. The publisher checked the deterministic replay before creating this release record."}
                  </p>
                  <div className="hash-field">
                    <code>
                      {proofTab === "receipt"
                        ? release.token
                        : proofTab === "brain"
                          ? release.brainCommit
                          : release.proof}
                    </code>
                    <button
                      aria-label={"Copy " + proofTab}
                      onClick={() =>
                        copy(
                          proofTab === "receipt"
                            ? release.token
                            : proofTab === "brain"
                              ? release.brainCommit
                              : release.proof,
                        )
                      }
                    >
                      {copyState.startsWith("Copied") ? (
                        <Check size={18} />
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>
                  </div>
                  {proofTab === "receipt" && (
                    <div className="release-links">
                      <a
                        href={"https://bscscan.com/tx/" + release.hash}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Inspect transaction <ArrowUpRight size={15} />
                      </a>
                      <a
                        href={"https://flap.sh/bnb/" + release.token}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on Flap <ArrowUpRight size={15} />
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="evidence-empty">
                  <div className="empty-symbol">
                    <Fingerprint size={36} weight="light" />
                  </div>
                  <span className="site-mono proof-label">
                    {loadState === "error"
                      ? "RECORD COULD NOT BE LOADED"
                      : "NO PUBLISHED RECORD YET"}
                  </span>
                  <h3>
                    {proofTab === "receipt"
                      ? "The record comes first."
                      : proofTab === "brain"
                        ? "An identifiable brain."
                        : "A replayable process."}
                  </h3>
                  <p>
                    {loadState === "error"
                      ? "We could not retrieve a complete release record. Retry to check the current publication status."
                      : proofTab === "receipt"
                        ? "A contract address and transaction will appear here after the BSC receipt and neural replay have been checked."
                        : proofTab === "brain"
                          ? "The published record will identify the exact networks, physics scene and inference code with a SHA-256 fingerprint."
                          : "The session record will connect the eight target hits to a replay-checked neural proof. The illustration above is separate."}
                  </p>
                  <button
                    className="site-inline-link"
                    onClick={() => setRetry((r) => r + 1)}
                  >
                    Check again <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="file-bottom site-mono">
              <span>
                {release
                  ? "PUBLISHED RECORD · INSPECT INDEPENDENTLY"
                  : "PUBLICATION STATUS / PENDING"}
              </span>
              {release && (
                <a href="/release.json" download>
                  JSON <DownloadSimple size={14} />
                </a>
              )}
            </div>
          </div>
        </section>
        <section className="site-notes">
          <div>
            <span className="site-mono section-kicker">05 / FIELD NOTES</span>
            <h2>
              A little context.
              <br />A clearer experiment.
            </h2>
            <p className="site-description">
              The interesting part is knowing what you’re actually watching.
            </p>
          </div>
          <div className="site-faqs">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus className="faq-plus" size={18} />
                  <Minus className="faq-minus" size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="site-invitation">
          <div className="invitation-mark">
            <BrandMark />
          </div>
          <div>
            <span className="site-mono">THE LAB NOTEBOOK IS STILL OPEN.</span>
            <h2>
              Stay curious.
              <br />
              Follow the next experiment.
            </h2>
          </div>
          <a
            className="site-button dark"
            href="https://x.com/gouyi420"
            target="_blank"
            rel="noreferrer"
          >
            Find us on X <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <a className="site-brand" href="#top">
            <BrandMark />
            <span>ratlab.</span>
          </a>
          <p>
            An independent experiment in learned behavior.
            <br />
            Built on research. Documented in public.
          </p>
          <div>
            <a href="/brand/rat-lab-launch-kit.zip" download>
              Brand assets <DownloadSimple size={15} />
            </a>
            <a
              href="https://github.com/fefethefly/rat-lab-bsc"
              target="_blank"
              rel="noreferrer"
            >
              Open source <GitBranch size={15} />
            </a>
            <a
              href="https://github.com/LabratDevRH/labrat"
              target="_blank"
              rel="noreferrer"
            >
              Upstream research <ArrowUpRight size={15} />
            </a>
            {import.meta.env.VITE_PUBLIC_SITE !== "1" && (
              <a href="/console">
                Operator console <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>
        <div className="footer-colophon">
          <span className="site-mono">© 2026 RAT LAB · FIELD STATION 002</span>
          <p>
            Virtual rodent: DeepMind / dm_control · Physics: MuJoCo · Rendering:
            Three.js. Independent of DeepMind, BNB Chain and Flap.
          </p>
          <a className="site-mono" href="#top">
            BACK TO TOP ↑
          </a>
        </div>
      </footer>
      {copyState && (
        <div className="site-toast" role="status">
          {copyState}
        </div>
      )}
    </div>
  );
}

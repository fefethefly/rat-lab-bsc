import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Copy,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import MissionMap from "./MissionMap";
import {
  observerBase,
  readMission,
  templates,
  type Mission,
} from "../lib/missions";
import { isDuelRecording, type DuelRecording } from "../lib/duel";
import { seconds, downloadJson, type Target } from "../lib/experiment";
import { Duel } from "./Challenge";
import "../missions.css";

export function MissionStudio() {
  const preset =
    templates.find(
      (t) => t.id === new URLSearchParams(location.search).get("template"),
    ) || templates[0];
  const [title, setTitle] = useState(preset.name),
    [targets, setTargets] = useState<Target[]>(() =>
      structuredClone(preset.targets),
    );
  const [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const key = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("fork");
    if (!id) return;
    setLoading(true);
    const controller = new AbortController();
    readMission(id, controller.signal)
      .then(({ mission }) => {
        setTitle(mission.title.slice(0, 40) + " / remix");
        setTargets(mission.rules.targets);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const change = (i: number, x: number, y: number) =>
    setTargets((old) => old.map((t, j) => (i === j ? [x, y, t[2], t[3]] : t)));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || loading) return;
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify({ title: title.trim(), targets });
    try {
      if (!key.current) {
        try {
          key.current = JSON.parse(
            sessionStorage.getItem("ratlab:mission-request") || "null",
          );
        } catch {
          /* Storage is optional. */
        }
      }
      if (key.current?.fingerprint !== fingerprint)
        key.current = { fingerprint, id: crypto.randomUUID() };
      try {
        sessionStorage.setItem(
          "ratlab:mission-request",
          JSON.stringify(key.current),
        );
      } catch {
        /* In-memory retry remains idempotent. */
      }
      const base = await observerBase();
      const r = await fetch(base + "/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          targets,
          requestId: key.current.id,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json();
      if (!r.ok)
        throw Error(
          typeof data.detail === "string"
            ? data.detail
            : "The experiment could not be submitted.",
        );
      if (!/^[a-f0-9]{20}$/.test(data.id))
        throw Error("The service returned an invalid mission link.");
      location.assign("/challenge?id=" + data.id);
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "No confirmation received. Retry the same design safely; it will not be queued twice.",
      );
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mission-editor">
      <fieldset disabled={busy || loading}>
        <legend className="sr-only">Design an eight-target mission</legend>
        <div className="mission-editor-top">
          <label htmlFor="mission-title">
            <span className="mission-kicker">NAME YOUR MISSION</span>
            <input
              id="mission-title"
              required
              minLength={3}
              maxLength={48}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
            />
          </label>
          <span className="mission-stamp">
            SERIES 01
            <br />
            <b>EIGHT TARGETS</b>
            <br />
            COMMUNITY BETA
          </span>
        </div>
        <div className="mission-editor-grid">
          <div className="mission-canvas">
            <div className="mission-drawing-head">
              <span>YOUR ROUTE / DRAG A NUMBERED TARGET</span>
              <span>{String(selected + 1).padStart(2, "0")} SELECTED</span>
            </div>
            <MissionMap
              targets={targets}
              selected={selected}
              onSelect={setSelected}
              onMove={busy || loading ? undefined : change}
            />
            <p className="mission-map-note">
              Target centers are enlarged for editing. Use the controls to set
              position and target size precisely.
            </p>
          </div>
          <aside className="mission-controls">
            <span className="mission-kicker">EDIT THE SEQUENCE</span>
            <div className="mission-target-tabs">
              {targets.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  aria-label={`Edit target ${i + 1}`}
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              ))}
            </div>
            <h2>
              Target {String(selected + 1).padStart(2, "0")}
              <span>/ 08</span>
            </h2>
            <label htmlFor="target-x">
              Horizontal position{" "}
              <output>{targets[selected][0].toFixed(3)}</output>
            </label>
            <input
              id="target-x"
              type="range"
              min=".42"
              max=".58"
              step=".005"
              value={targets[selected][0]}
              onChange={(e) =>
                change(selected, Number(e.target.value), targets[selected][1])
              }
            />
            <label htmlFor="target-y">
              Vertical position{" "}
              <output>{targets[selected][1].toFixed(3)}</output>
            </label>
            <input
              id="target-y"
              type="range"
              min=".35"
              max=".64"
              step=".005"
              value={targets[selected][1]}
              onChange={(e) =>
                change(selected, targets[selected][0], Number(e.target.value))
              }
            />
            <label htmlFor="target-size">Target size</label>
            <select
              id="target-size"
              value={`${targets[selected][2]},${targets[selected][3]}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split(",").map(Number);
                setTargets((old) =>
                  old.map((t, i) => (i === selected ? [t[0], t[1], w, h] : t)),
                );
              }}
            >
              <option value="0.14,0.035">Precise · 28% × 7%</option>
              <option value="0.16,0.045">Standard · 32% × 9%</option>
              <option value="0.2,0.055">Wide · 40% × 11%</option>
              {!["0.14,0.035", "0.16,0.045", "0.2,0.055"].includes(
                `${targets[selected][2]},${targets[selected][3]}`,
              ) && (
                <option
                  value={`${targets[selected][2]},${targets[selected][3]}`}
                >
                  Custom saved size
                </option>
              )}
            </select>
            <div className="mission-rule-note">
              <b>One shared set of rules.</b>
              <p>
                Eight targets in order. 0.96s between hits. 12s per target. 60s
                total including the countdown. Human scores are local practice,
                not a device-neutral benchmark.
              </p>
            </div>
            <button
              type="button"
              className="mission-reset"
              onClick={() => {
                setTitle(preset.name);
                setTargets(structuredClone(preset.targets));
                setSelected(0);
              }}
            >
              <ArrowCounterClockwise size={16} /> Reset to template
            </button>
          </aside>
        </div>
        <div className="mission-submit">
          <div>
            <strong>Send it to the rat.</strong>
            <p>
              Your title and design become public to anyone with the link. No
              wallet needed.
              <br />
              Beta: 24 runs a day; 3 per network per hour. Completed links
              survive service restarts.
            </p>
          </div>
          <button className="mission-primary" type="submit">
            {busy
              ? "Submitting…"
              : loading
                ? "Loading design…"
                : "Run this experiment"}
            <ArrowRight size={18} />
          </button>
        </div>
      </fieldset>
      {error && (
        <div role="alert" className="mission-error">
          {error}
        </div>
      )}
    </form>
  );
}

export function CommunityMission({ id }: { id: string }) {
  const [mission, setMission] = useState<Mission | null>(null),
    [base, setBase] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let disposed = false,
      timer = 0;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const result = await readMission(id, controller.signal);
        if (disposed) return;
        setMission(result.mission);
        setBase(result.base);
        setError("");
        if (["queued", "running"].includes(result.mission.state))
          timer = window.setTimeout(poll, 3000);
      } catch (e) {
        if (!disposed) {
          setError(
            e instanceof Error ? e.message : "The mission is unavailable.",
          );
          timer = window.setTimeout(poll, 12000);
        }
      }
    };
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, retry]);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `https://rat-lab.fun/challenge?id=${id}`,
      );
      setNotice("Mission link copied.");
    } catch {
      setNotice("Copy the mission link from your address bar.");
    }
  };
  if (!mission)
    return (
      <div className="lab-loading">
        <h2>{error || "Opening the mission…"}</h2>
        {error && (
          <button className="lab-button" onClick={() => setRetry((n) => n + 1)}>
            Retry mission
          </button>
        )}
        <a href="/create" className="mission-secondary">
          Create a new mission <ArrowUpRight size={16} />
        </a>
      </div>
    );
  const candidate = {
    run: mission.run,
    rules: mission.rules,
    rulesHash: mission.rulesHash,
  };
  let recording: DuelRecording | null = null;
  if (
    mission.state === "complete" &&
    isDuelRecording(candidate, `/challenges/${id}`)
  ) {
    recording = structuredClone(candidate);
    recording.run.replay.metaUrl = base + recording.run.replay.metaUrl;
    recording.run.replay.binaryUrl = base + recording.run.replay.binaryUrl;
  }
  return (
    <div className="community-mission">
      <section className="mission-ticket">
        <div>
          <span className="mission-kicker">
            COMMUNITY MISSION / {id.slice(0, 8).toUpperCase()}
          </span>
          <h2>{mission.title}</h2>
          <span className="mission-ticket-status">
            {mission.state.toUpperCase()} ·{" "}
            {new Date(mission.createdAt * 1000).toLocaleDateString()}
          </span>
        </div>
        <div className="mission-ticket-actions">
          <button className="lab-button" onClick={share}>
            <Copy size={16} /> Copy challenge link
          </button>
          <a className="lab-button" href={`/create?fork=${id}`}>
            Remix this mission <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
      <p role="status" className="mission-notice">
        {notice ||
          "Saved design. One recorded attempt. Everyone races the same result."}
      </p>
      {error && (
        <p role="alert" className="mission-error">
          {error} The last loaded mission is shown.
        </p>
      )}
      {recording ? (
        <Duel key={id} recording={recording} />
      ) : (
        <div className="mission-waiting">
          <MissionMap targets={mission.rules.targets} />
          <div>
            <span className="mission-kicker">THE EXPERIMENT JOURNAL</span>
            <h3>
              {mission.state === "queued"
                ? "Your route is on the desk."
                : mission.state === "running"
                  ? "The rat is working on it."
                  : mission.state === "incomplete"
                    ? "A limit worth finding."
                    : "The attempt is unavailable."}
            </h3>
            <p>
              {mission.state === "queued"
                ? `${mission.ahead} mission${mission.ahead === 1 ? "" : "s"} ahead. A scheduled observation may also be finishing. This page updates automatically; you can come back using this link.`
                : mission.state === "running"
                  ? "The fixed policies are attempting your targets, then the server checks the recording. Running a new task does not train the model."
                  : mission.error ||
                    "The rat did not produce a complete, verified eight-hit run. The design and available result are saved. Remix the positions or widen a target and try again."}
            </p>
            {mission.run && (
              <>
                <div className="mission-result">
                  <b>
                    {mission.run.hits}/8 <small>targets</small>
                  </b>
                  <span>
                    {mission.run.verified
                      ? "Replay verified"
                      : "Replay not verified"}
                    <br />
                    {mission.run.failure ||
                      "Complete paired result unavailable"}
                  </span>
                </div>
                <button
                  className="lab-button"
                  onClick={() => downloadJson(mission, `ratlab-${id}.json`)}
                >
                  Download attempt record
                </button>
              </>
            )}
            {mission.state === "running" && (
              <a className="mission-secondary" href="/live">
                Watch live inference <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        </div>
      )}
      <details className="proof-details">
        <summary>Mission rules & provenance</summary>
        <p>
          Same trained upstream policies, your target layout. No weights change
          during this attempt. Your mission does not add to the buyback
          simulation.
        </p>
        <dl>
          <dt>Rules fingerprint</dt>
          <dd>{mission.rulesHash}</dd>
          <dt>Rat result</dt>
          <dd>
            {mission.run
              ? `${mission.run.hits}/8 · ${mission.run.complete ? seconds(mission.run.durationMs) : "incomplete"}`
              : "Pending"}
          </dd>
        </dl>
        <button
          className="lab-button"
          onClick={() => downloadJson(mission, `mission-${id}.json`)}
        >
          Download mission JSON
        </button>
      </details>
    </div>
  );
}

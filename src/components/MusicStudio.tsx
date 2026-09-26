import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Play,
  Pause,
  ArrowCounterClockwise,
  SpeakerHigh,
  SpeakerSlash,
  Copy,
  DownloadSimple,
  MusicNotes,
} from "@phosphor-icons/react";
import {
  melodies,
  pitches,
  previewEvents,
  takeEvents,
  musicRecording,
  validNotes,
  phraseComparison,
  type NoteEvent,
} from "../lib/music";
import { SoftKeys, musicWav } from "../lib/softKeys";
import { observerBase, readMission, type Mission } from "../lib/missions";
import { seconds, downloadJson } from "../lib/experiment";
import RecordedRat from "./RecordedRat";
import PianoStage from "./PianoStage";
import "../music.css";

function NoteStrip({
  notes,
  active = -1,
  selected = -1,
  completed = 0,
  onSelect,
}: {
  notes: number[];
  active?: number;
  selected?: number;
  completed?: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <div className="music-score" aria-label="Eight-note composition">
      {notes.map((note, i) => (
        <button
          type="button"
          disabled={!onSelect}
          key={i}
          aria-label={`Note ${i + 1}: ${pitches[note].name}`}
          aria-pressed={onSelect ? selected === i : undefined}
          onClick={() => onSelect?.(i)}
          className={`${active === i ? "sounding " : ""}${i < completed ? "played " : ""}${selected === i ? "selected" : ""}`}
        >
          <span>{String(i + 1).padStart(2, "0")}</span>
          <strong>{pitches[note].name}</strong>
          <i style={{ height: `${22 + note * 13}%` }} />
          <small>{active === i ? "SOUND" : i < completed ? "HIT" : "·"}</small>
        </button>
      ))}
    </div>
  );
}
function useTransport(events: NoteEvent[], duration: number) {
  const engine = useRef<SoftKeys | null>(null),
    frame = useRef(0),
    position = useRef(0),
    origin = useRef(0),
    generation = useRef(0);
  const [at, setAt] = useState(0),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState("");
  const pause = () => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    engine.current?.stop();
    setPlaying(false);
  };
  useEffect(() => {
    engine.current = new SoftKeys();
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      generation.current++;
      cancelAnimationFrame(frame.current);
      document.removeEventListener("visibilitychange", hidden);
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  const play = async () => {
    pause();
    setError("");
    const token = generation.current;
    const audio = engine.current;
    try {
      if (!audio) throw Error("Audio is not ready.");
      await audio.enable();
      if (token !== generation.current || document.hidden) return;
      const offset = position.current >= duration ? 0 : position.current;
      position.current = offset;
      setAt(offset);
      audio.mute(muted);
      origin.current = audio.schedule(events, offset);
      setPlaying(true);
      const tick = () => {
        if (token !== generation.current) return;
        if (!audio.running() || document.hidden) {
          pause();
          return;
        }
        const current = Math.max(
          offset,
          offset + (audio.now() - origin.current) * 1000,
        );
        position.current = Math.min(current, duration);
        setAt(position.current);
        if (current >= duration) {
          pause();
          return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      if (token === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Audio is unavailable in this browser.",
        );
    }
  };
  const seek = (value: number) => {
    pause();
    position.current = Math.min(duration, Math.max(0, value));
    setAt(position.current);
  };
  const tap = async (note: number) => {
    pause();
    const token = generation.current;
    try {
      await engine.current?.enable();
      if (token === generation.current && !document.hidden) {
        engine.current?.mute(muted);
        engine.current?.tap(note);
      }
    } catch {
      setError("Sound could not start. Try another browser or reload.");
    }
  };
  const toggleMute = () =>
    setMuted((m) => {
      engine.current?.mute(!m);
      return !m;
    });
  const active =
    [...events].reverse().find((e) => e.atMs <= at && at - e.atMs < 500)
      ?.step ?? -1;
  return {
    at,
    playing,
    muted,
    error,
    active,
    pause,
    play,
    seek,
    tap,
    toggleMute,
  };
}
function MusicComposer() {
  const [notes, setNotes] = useState(melodies[0].notes),
    [title, setTitle] = useState(melodies[0].name),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [advance, setAdvance] = useState(true);
  const [undo, setUndo] = useState<{ notes: number[]; selected: number }[]>([]);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const transport = useTransport(previewEvents(notes), 6050);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("remix");
    if (!id) return;
    const c = new AbortController();
    setLoading(true);
    readMission(id, c.signal)
      .then(({ mission }) => {
        const n = mission.rules.music?.notes;
        if (!validNotes(n)) throw Error("This mission has no musical score.");
        setNotes(n);
        setTitle(mission.title.slice(0, 40) + " / remix");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, []);
  const choose = (note: number) => {
    transport.seek(0);
    setUndo(history => [...history.slice(-31), { notes: [...notes], selected }]);
    setNotes((n) => n.map((v, i) => (i === selected ? note : v)));
    if (advance) setSelected(i => Math.min(7, i + 1));
    void transport.tap(note);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || loading) return;
    transport.pause();
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({ title: title.trim(), notes });
      if (!request.current) {
        try {
          request.current = JSON.parse(
            sessionStorage.getItem("ratlab:music-request") || "null",
          );
        } catch {
          /* Browser storage is optional. */
        }
      }
      if (request.current?.fingerprint !== fingerprint)
        request.current = { fingerprint, id: crypto.randomUUID() };
      try {
        sessionStorage.setItem(
          "ratlab:music-request",
          JSON.stringify(request.current),
        );
      } catch {
        /* In-memory retry still works. */
      }
      const base = await observerBase(),
        r = await fetch(base + "/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "music",
            title: title.trim(),
            notes,
            requestId: request.current.id,
          }),
          signal: AbortSignal.timeout(20000),
        });
      const d = await r.json();
      if (!r.ok)
        throw Error(
          typeof d.detail === "string"
            ? d.detail
            : "The take could not be queued.",
        );
      if (!/^[a-f0-9]{20}$/.test(d.id))
        throw Error("The service returned an invalid take link.");
      location.assign("/music?id=" + d.id);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "No confirmation received. Retry this score safely; it will not be queued twice.",
      );
    }
  };
  return (
    <form onSubmit={submit} className="music-studio" onKeyDown={event => {
      if (busy || loading || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.matches("input,textarea,select") || target.isContentEditable) return;
      const pitch = ["a", "s", "d", "f"].indexOf(event.key.toLowerCase());
      if (pitch !== -1) { event.preventDefault(); choose(pitch); }
    }}>
      <p className="music-featured">
        <a href="/first-takes" className="lab-button">
          First Takes: hear movement become music <ArrowUpRight size={17} />
        </a>
      </p>
      <fieldset disabled={busy || loading}>
        <legend className="sr-only">Compose eight notes for the rat</legend>
        <div className="music-session-heading">
          <div>
            <span className="music-label">SIDE A / YOUR COMPOSITION</span>
            <label className="sr-only" htmlFor="music-title">
              Composition title
            </label>
            <input
              id="music-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={48}
            />
          </div>
          <span className="music-stamp">
            04 KEYS
            <br />
            <b>08 NOTES</b>
            <br />
            YOUR SCORE
          </span>
        </div>
        <div className="music-console">
          <div className="music-console-top">
            <span>
              <i /> COMPOSER: YOU
            </span>
            <span>PERFORMER: R-01</span>
          </div>
          <div className="music-staff" aria-hidden="true">
            <svg viewBox="0 0 900 140">
              <path d="M0 30h900M0 50h900M0 70h900M0 90h900M0 110h900" />
              {notes.map((note, i) => (
                <g
                  key={i}
                  className={
                    transport.playing && transport.active === i ? "lit" : ""
                  }
                  transform={`translate(${62 + i * 111},${105 - note * 23})`}
                >
                  <ellipse rx="11" ry="7" transform="rotate(-20)" />
                  <path d="M10 0v-47" />
                </g>
              ))}
            </svg>
          </div>
          <NoteStrip
            notes={notes}
            active={transport.playing ? transport.active : -1}
            selected={selected}
            onSelect={(i) => {
              transport.seek(0);
              setSelected(i);
            }}
          />
          <div className="music-editor-lower">
            <div className="music-key-instructions">
              <span className="music-label">
                WRITE NOTE {String(selected + 1).padStart(2, "0")}
              </span>
              <h2>
                Pick a key.
                <br />
                Make it yours.
              </h2>
              <p>
                Play a key to write the selected note. Use A, S, D, F when the
                score desk has focus. Select any numbered note to change it.
              </p>
              <label className="music-advance"><input type="checkbox" checked={advance} onChange={e => setAdvance(e.target.checked)} /> Move to the next note</label>
              <button type="button" className="music-undo" disabled={!undo.length} onClick={() => {
                const previous = undo.at(-1); if (!previous) return;
                transport.seek(0); setNotes(previous.notes); setSelected(previous.selected); setUndo(h => h.slice(0,-1));
              }}><ArrowCounterClockwise size={14} /> Undo last key</button>
            </div>
            <div className="music-keys" aria-label="Choose a pitch">
              {pitches.map((pitch, i) => (
                <button
                  type="button"
                  key={pitch.name}
                  className={notes[selected] === i ? "chosen" : ""}
                  aria-pressed={notes[selected] === i}
                  aria-label={`Set note ${selected + 1} to ${pitch.name}`}
                  onClick={() => choose(i)}
                >
                  <i />
                  <span>
                    {pitch.name}
                    <small>{pitch.octave} · {["A", "S", "D", "F"][i]}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="music-transport">
            <button
              type="button"
              className="lab-button"
              onClick={() =>
                transport.playing ? transport.pause() : void transport.play()
              }
            >
              {transport.playing ? <Pause size={17} /> : <Play size={17} />}{" "}
              {transport.playing ? "Pause score" : "Listen to your score"}
            </button>
            <span>
              SCORE PREVIEW · EVEN SPACING
              <br />
              The rat’s timing will be its own.
            </span>
            <button
              type="button"
              className="music-mute"
              onClick={transport.toggleMute}
              aria-label={transport.muted ? "Unmute audio" : "Mute audio"}
            >
              {transport.muted ? (
                <SpeakerSlash size={19} />
              ) : (
                <SpeakerHigh size={19} />
              )}
            </button>
          </div>
        </div>
        <div className="music-starting-points">
          <span className="music-label">STARTING PHRASES</span>
          {melodies.map((m) => (
            <button
              type="button"
              key={m.name}
              onClick={() => {
                transport.seek(0);
                setTitle(m.name);
                setNotes([...m.notes]);
                setSelected(0);
                setUndo([]);
              }}
            >
              {m.name}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <div className="music-submit">
          <div>
            <span className="music-label">SIDE B / THE RAT’S RESPONSE</span>
            <h2>Let it find the notes.</h2>
            <p>
              The rat aims at one target for each note and presses its lever. A
              successful hit makes a sound. Pauses and misses stay in the
              recording.
            </p>
            <small>
              Your title and score will be public by link. Shared beta limit: 24
              experiments per day, 3 per network per hour. No wallet needed.
            </small>
          </div>
          <button type="submit" className="mission-primary">
            {loading
              ? "Loading score…"
              : busy
                ? "Queuing your take…"
                : "Send score to R-01"}
            <ArrowRight size={19} />
          </button>
        </div>
      </fieldset>
      <p className="music-featured">
        <a className="lab-button" href="/music?id=a9cfcf042e75987cebb8">
          Hear the first recorded take <ArrowUpRight size={17} />
        </a>
        <span>Little steps · 8/8 hits · verified recording</span>
      </p>
      {(error || transport.error) && (
        <p className="mission-error" role="alert">
          {error || transport.error}
        </p>
      )}
      <div className="music-method">
        <MusicNotes size={24} />
        <p>
          Original synthesized keys. Fixed trained policies. Notes are mapped to
          target hits, not physical piano keys or a model learning music. The
          first series follows the rat’s natural pace.
        </p>
      </div>
    </form>
  );
}
function MusicTake({ id, featured = false }: { id: string; featured?: boolean }) {
  const [mission, setMission] = useState<Mission | null>(null),
    [base, setBase] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let gone = false,
      timer = 0;
    const c = new AbortController();
    const poll = async () => {
      try {
        const result = featured
          ? await fetch("/experiment/music-featured.json", { signal: AbortSignal.any([c.signal, AbortSignal.timeout(12000)]) }).then(async r => {
              if (!r.ok) throw Error("The featured recording could not be loaded.");
              const saved = await r.json();
              if (saved.mission?.id !== id || typeof saved.mission?.title !== "string" || !musicRecording(saved.mission, saved.base))
                throw Error("The featured archive is invalid.");
              return saved as { mission: Mission; base: string };
            })
          : await readMission(id, c.signal);
        if (gone) return;
        if (!validNotes(result.mission.rules.music?.notes))
          throw Error("This link is not a musical experiment.");
        setMission(result.mission);
        setBase(result.base);
        setError("");
        if (["queued", "running"].includes(result.mission.state))
          timer = window.setTimeout(poll, 3000);
      } catch (e) {
        if (!gone)
          setError(
            e instanceof Error ? e.message : "This take could not be loaded.",
          );
      }
    };
    void poll();
    return () => {
      gone = true;
      c.abort();
      clearTimeout(timer);
    };
  }, [id, retry, featured]);
  if (!mission)
    return (
      <div className="lab-loading">
        <MusicNotes size={35} />
        <h2>{error ? "Take unavailable" : "Opening the session…"}</h2>
        <p>{error || "Loading the saved score and its real attempt."}</p>
        {error && (
          <button className="lab-button" onClick={() => setRetry((n) => n + 1)}>
            Retry take
          </button>
        )}
        <a className="mission-secondary" href="/music?compose=1">
          Write a new score <ArrowUpRight size={16} />
        </a>
      </div>
    );
  return (
    <>
      <MusicPerformance
        key={mission.run?.id || mission.id}
        mission={mission}
        base={base}
      />
      {error && (
        <p role="alert" className="mission-error">
          {error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Retry status</button>
        </p>
      )}
    </>
  );
}
function MusicPerformance({
  mission,
  base,
}: {
  mission: Mission;
  base: string;
}) {
  const notes = mission.rules.music!.notes,
    recording = musicRecording(mission, base),
    run = recording?.run;
  const events = run ? takeEvents(notes, run) : [];
  const responseDuration = run
    ? Math.max(
        run.durationMs,
        (run.samples?.at(-1)?.atMs || 0) - run.firstTargetMs,
      ) + 1500
    : 1000;
  const [mode, setMode] = useState<"response" | "score">("response");
  const duration = mode === "response" ? responseDuration : 6050;
  const transport = useTransport(mode === "response" ? events : previewEvents(notes), duration);
  const comparison = run ? phraseComparison(notes, run) : [];
  const selectMode = (next: "response" | "score") => { transport.seek(0); setMode(next); };
  const [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        "https://rat-lab.fun/music?id=" + mission.id,
      );
      setNotice("Take link copied.");
    } catch {
      setNotice("Copy the address from your browser to share this take.");
    }
  };
  const save = async () => {
    if (!run || saving) return;
    setSaving(true);
    try {
      const wav = await musicWav(events, responseDuration),
        url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ratlab-take-${mission.id}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Audio exported with the recorded hit timing.");
    } catch {
      setNotice(
        "Audio export is unavailable in this browser. The take link and JSON record are still available.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="music-studio music-take">
      <div className="music-session-heading">
        <div>
          <span className="music-label">
            SIDE B / RECORDED RESPONSE · {mission.id.slice(0, 8).toUpperCase()}
          </span>
          <h2>{mission.title}</h2>
          <p>{run ? <>Recorded on {new Date(mission.createdAt * 1000).toLocaleDateString()} · actual hit timing · not live.</> : "Your saved score and the status of its attempt."}</p>
        </div>
        <span className="music-stamp">
          {mission.state.toUpperCase()}
          <br />
          <b>{mission.run ? `${mission.run.hits} / 8 HITS` : "QUEUED SCORE"}</b>
          <br />
          {new Date(mission.createdAt * 1000).toLocaleDateString()}
        </span>
      </div>
      {recording && run ? (
        <>
          <div className="music-audition" role="group" aria-label="Choose what to hear">
            <button aria-pressed={mode === "response"} onClick={() => selectMode("response")}><span>01</span><b>The rat’s response</b><small>Actual hit timing</small></button>
            <button aria-pressed={mode === "score"} onClick={() => selectMode("score")}><span>02</span><b>Original score</b><small>Even 650ms spacing</small></button>
            <p>Same notes. Hear what changes.<br />Switching stops and resets playback.</p>
          </div>
          <div className="music-theatre">
            <div>
              <div className="music-take-controls">
                <div className="music-transport">
                  <button className="mission-primary" onClick={() => transport.playing ? transport.pause() : void transport.play()}>
                    {transport.playing ? <Pause size={19} /> : <Play size={19} />}
                    {transport.playing ? "Pause playback" : mode === "response" ? "Hear the rat play" : "Hear the original score"}
                  </button>
                  <button className="lab-button" aria-label="Restart recording" onClick={() => transport.seek(0)}><ArrowCounterClockwise size={18} /></button>
                  <button className="lab-button" aria-label={transport.muted ? "Unmute audio" : "Mute audio"} onClick={transport.toggleMute}>{transport.muted ? <SpeakerSlash size={19} /> : <SpeakerHigh size={19} />}</button>
                </div>
                <label className="sr-only" htmlFor="take-position">Recording position</label>
                <input id="take-position" type="range" min="0" max={duration} step="20" value={transport.at} onChange={e => transport.seek(Number(e.target.value))} />
                <div className="music-position-label"><span>{seconds(transport.at)}</span><span>{seconds(duration)}</span></div>
              </div>
              <PianoStage events={mode === "response" ? events : previewEvents(notes)} at={transport.at}
                duration={duration} playing={transport.playing} mode={mode} onSeek={transport.seek} />
            </div>
            <aside className="music-source-panel">
              <div className="music-source-title"><span className="music-label">THE PERFORMER / RECORDED</span><b>R-01</b></div>
              {mode === "response" ? <RecordedRat recording={recording} atMs={run.firstTargetMs + transport.at} />
                : <div className="music-score-explainer"><MusicNotes size={42} /><h3>Before the performance.</h3><p>This is your score at even intervals. Switch to the rat’s response to watch its recorded movement.</p></div>}
              <div className="music-source-facts">
                <div><span>Notes reached</span><b>{run.hits} / 8</b></div>
                <div><span>Misses in attempt</span><b>{run.misses}</b></div>
                <div><span>Replay check</span><b>Verified on host</b></div>
              </div>
              <p>The head aims. A lever press hits the target. Each successful hit sounds its assigned note. These are synthesized keys, not a physical piano.</p>
              {!run.complete && <p className="music-incomplete">{run.failure || "The full score was not completed."} Unreached notes stay silent.</p>}
            </aside>
          </div>
          <section className="music-phrase-compare" aria-label="Original score and recorded timing comparison">
            <div><span className="music-label">SAME SCORE / DIFFERENT PACE</span><h3>Listen to the spaces.</h3><p>The score preview is evenly spaced. The response keeps every pause from this attempt.</p></div>
            <div className="music-comparison-scroll"><table>
              <caption className="sr-only">Note timestamps, in seconds from the start of each playback</caption>
              <thead><tr><th scope="col">Note</th>{comparison.map(e=><th scope="col" key={e.step}>{e.step+1} · {pitches[e.note].name}</th>)}</tr></thead>
              <tbody><tr><th scope="row">Your score</th>{comparison.map(e=><td key={e.step}>{(e.atMs/1000).toFixed(2)}s</td>)}</tr>
              <tr><th scope="row">R-01’s hit</th>{comparison.map(e=><td key={e.step}>{e.recordedAtMs===null ? "—" : (e.recordedAtMs/1000).toFixed(2)+"s"}</td>)}</tr></tbody>
            </table></div>
          </section>

        </>
      ) : (
        <div className="music-waiting">
          <MusicNotes size={55} />
          <h3>
            {mission.state === "queued"
              ? "Your score is on the stand."
              : mission.state === "running"
                ? "R-01 is finding the notes."
                : "This attempt needs another take."}
          </h3>
          <p>
            {mission.state === "queued"
              ? `${mission.ahead} community experiment${mission.ahead === 1 ? "" : "s"} ahead. A scheduled observation may also be finishing. You can return using this saved link.`
              : mission.state === "running"
                ? "The rat is attempting your score. This page will update after the attempt and its replay check."
                : mission.error ||
                  "No verified recording is available. The original score is saved; remix it to try again."}
          </p>
          <NoteStrip notes={notes} />
          {mission.state === "running" && (
            <a href="/live" className="mission-secondary">
              Watch live inference <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      )}
      <div className="music-share">
        <button className="lab-button" onClick={share}>
          <Copy size={17} /> Copy take link
        </button>
        <a className="mission-primary" href={`/music?remix=${mission.id}`}>
          Remix this score <ArrowUpRight size={17} />
        </a>
        {run && (
          <button
            className="lab-button"
            disabled={saving}
            onClick={() => void save()}
          >
            <DownloadSimple size={17} />
            {saving ? "Rendering audio…" : "Download recorded WAV"}
          </button>
        )}
        <a className="mission-secondary" href="/music?compose=1">
          Write another score <ArrowUpRight size={16} />
        </a>
      </div>
      <p className="music-notice" role="status">
        {transport.error ||
          notice ||
          "Share the attempt, including its real timing. Your original score stays unchanged."}
      </p>
      <details className="proof-details">
        <summary>Score, timing & provenance</summary>
        <p>
          Fixed policies control head aiming and a lever. Each successful target
          hit triggers its assigned synthesized note. This is neither physical
          piano playing nor live music training. Community music does not
          allocate buyback funds.
        </p>
        <dl>
          <dt>Rules fingerprint</dt>
          <dd>{mission.rulesHash}</dd>
          <dt>Session proof</dt>
          <dd>{mission.run?.proof || "Pending"}</dd>
        </dl>
        <button
          className="lab-button"
          onClick={() =>
            downloadJson(mission, `ratlab-score-${mission.id}.json`)
          }
        >
          Download score and attempt JSON
        </button>
      </details>
    </div>
  );
}
export default function MusicStudio() {
  const params = new URLSearchParams(location.search), id = params.get("id");
  const composing = params.has("compose") || params.has("remix");
  return <>
    <nav className="music-room-nav" aria-label="Music room">
      <a href="/music" aria-current={!composing && !id ? "page" : undefined}><span>01</span> Listen to R-01</a>
      <a href="/music?compose=1" aria-current={composing ? "page" : undefined}><span>02</span> Write your phrase</a>
      <a href="/first-takes"><span>03</span> Explore First Takes <ArrowUpRight size={15} /></a>
    </nav>
    {id ? <MusicTake id={id} /> : composing ? <MusicComposer /> : <>
      <p className="music-featured-caption">FEATURED SESSION · OPERATOR-CREATED EXAMPLE · OPEN LISTENING</p>
      <MusicTake id="a9cfcf042e75987cebb8" featured />
      <section className="music-next-phrase"><div><span className="music-label">YOUR TURN ON THE SCORE DESK</span><h2>Give it your next eight notes.</h2><p>Try a familiar opening, write your own phrase, and keep the rat’s response.</p></div><a href="/music?compose=1" className="mission-primary">Write a phrase <ArrowRight size={18} /></a></section>
    </>}
  </>;
}

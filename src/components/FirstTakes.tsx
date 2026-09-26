import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Pause,
  DownloadSimple,
  Fingerprint,
  CheckCircle,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import {
  deriveEvents,
  packEvents,
  renderWav,
  sha256,
  validateEvents,
  type BehaviorEvent,
} from "../lib/firstTakesCore.js";
import "../first-takes.css";
import TakeMotion from "./TakeMotion";
type Track = {
  id: string;
  title: string;
  events: BehaviorEvent[];
  seed: number;
  runId: string;
  sourceSha256: string;
  scoreSha256: string;
  wavSha256: string;
  zipSha256: string;
  playerSha256: string;
  durationMs: number;
  sourceDurationMs: number;
  hits: number;
  misses: number;
  hostVerified: boolean;
  complete: boolean;
  brainCommit: string;
  proof: string;
  rendererVersion: string;
  mappingVersion: string;
};
type Source = {
  run: {
    samples: { atMs: number; cursor: [number, number] }[];
    firstTargetMs: number;
  };
};
type Deployment = {
  network: string;
  chainId: number;
  status: string;
  address?: string;
  transactionHash?: string;
  tokens?: { id: string; tokenId: number; transactionHash: string }[];
  note: string;
};
const noteName = (n: number) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][n % 12] +
  (Math.floor(n / 12) - 1);
const time = (n: number) => (n / 1000).toFixed(2) + "s";
const short = (s: string) => s.slice(0, 10) + "…" + s.slice(-6);
export default function FirstTakes() {
  const [tracks, setTracks] = useState<Track[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const requested = new URLSearchParams(location.search).get("take");
  const [selected, setSelected] = useState(
    requested && /^take-0[1-4]$/.test(requested) ? requested : "take-01",
  );
  useEffect(() => {
    const c = new AbortController();
    fetch("/first-takes/index.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error("The collection could not be loaded.");
        return r.json();
      })
      .then((d) => {
        if (
          d.schemaVersion !== 1 ||
          !Array.isArray(d.tracks) ||
          d.tracks.length !== 4
        )
          throw Error("The collection index is invalid.");
        for (const t of d.tracks) {
          if (
            !/^take-0[1-4]$/.test(t.id) ||
            typeof t.title !== "string" ||
            !Number.isFinite(t.durationMs) ||
            t.durationMs <= 0 ||
            ![t.sourceSha256, t.scoreSha256, t.wavSha256, t.zipSha256].every(
              (h) => /^[a-f0-9]{64}$/.test(h),
            )
          )
            throw Error("Invalid work metadata.");
          validateEvents(t.events);
        }
        if (new Set(d.tracks.map((t: Track) => t.id)).size !== 4)
          throw Error("Duplicate works.");
        setTracks(d.tracks);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [retry]);
  const track = tracks.find((t) => t.id === selected);
  const choose = (id: string) => {
    setSelected(id);
    history.replaceState(null, "", "/first-takes?take=" + id);
  };
  return (
    <div className="takes-page">
      <div className="takes-intro">
        <p>
          Four recorded attempts become four short scores. Hear the movement,
          inspect the notes, and take the complete player with you.
        </p>
        <a href="/music?compose=1">
          Write your own score <ArrowUpRight size={17} />
        </a>
      </div>
      {error ? (
        <div className="takes-error" role="alert">
          {error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : !track ? (
        <div className="takes-loading" role="status">
          Opening the recording cabinet…
        </div>
      ) : (
        <>
          <div className="takes-cabinet">
            <aside
              className="takes-sleeves"
              aria-label="Choose a recorded work"
            >
              <div className="takes-shelf-label">
                STUDY 01 <span>04 RECORDINGS</span>
              </div>
              {tracks.map((t, i) => (
                <button
                  key={t.id}
                  className={selected === t.id ? "selected" : ""}
                  aria-pressed={selected === t.id}
                  onClick={() => choose(t.id)}
                >
                  <span className="takes-number">0{i + 1}</span>
                  <img src={`/first-takes/${t.id}/cover.svg`} alt="" />
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.events.length} notes · {time(t.durationMs)}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
              <p>
                Fixed policies. Four planned routes.
                <br />
                Every attempt in this batch is kept.
              </p>
            </aside>
            <TakePlayer key={track.id} track={track} />
          </div>
          <section className="takes-principles">
            <span className="music-label">WHAT YOU ARE HEARING</span>
            <h2>
              A score written
              <br />
              by a trail of movement.
            </h2>
            <div>
              <p>
                The virtual rat attempts a targeting task. A fixed rule turns
                vertical position into pitch, horizontal position into velocity,
                and movement speed into note length.
              </p>
              <p>
                These are behavioral studies, with human-designed routes and
                mapping rules. The model has not been trained to compose music.
                Timing comes from sampled motion; silence and repeated notes
                remain.
              </p>
              <a
                href="https://github.com/fefethefly/rat-lab-bsc/blob/main/docs/FIRST_TAKES.md"
                target="_blank"
                rel="noreferrer"
              >
                Read the full method <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
          <TestnetArchive track={track} />
        </>
      )}
    </div>
  );
}
function TakePlayer({ track }: { track: Track }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState(""),
    [source, setSource] = useState<Source | null>(null),
    [status, setStatus] = useState("Checking the source and rebuilding audio…"),
    [failure, setFailure] = useState(false),
    [playing, setPlaying] = useState(false),
    [at, setAt] = useState(0),
    [chosen, setChosen] = useState(0),
    [retry, setRetry] = useState(0),
    [copy, setCopy] = useState("");
  useEffect(() => {
    let alive = true,
      objectUrl = "";
    const media = audio.current;
    const c = new AbortController();
    setFailure(false);
    setUrl("");
    setStatus("Checking the source and rebuilding audio…");
    (async () => {
      const r = await fetch(`/first-takes/${track.id}/source.json`, {
        signal: c.signal,
      });
      if (!r.ok) throw Error("Source archive unavailable.");
      const raw = await r.text();
      if ((await sha256(new TextEncoder().encode(raw))) !== track.sourceSha256)
        throw Error("Source fingerprint mismatch.");
      const s = JSON.parse(raw),
        events = deriveEvents(s);
      if (
        JSON.stringify(events) !== JSON.stringify(track.events) ||
        (await sha256(packEvents(events))) !== track.scoreSha256
      )
        throw Error("Trajectory-to-score verification failed.");
      const wav = renderWav(events);
      if ((await sha256(wav)) !== track.wavSha256)
        throw Error("Rebuilt audio fingerprint mismatch.");
      if (!alive) return;
      objectUrl = URL.createObjectURL(
        new Blob([new Uint8Array(wav)], { type: "audio/wav" }),
      );
      setSource(s);
      setUrl(objectUrl);
      setStatus("Source → score → audio: all fingerprints match.");
    })().catch((e) => {
      if (alive && !c.signal.aborted) {
        setFailure(true);
        setStatus(e.message);
      }
    });
    return () => {
      alive = false;
      c.abort();
      media?.pause();
      media?.removeAttribute("src");
      media?.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [track, retry]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) audio.current?.pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  const toggle = async () => {
    if (!audio.current) return;
    if (playing) audio.current.pause();
    else
      try {
        await audio.current.play();
      } catch {
        setStatus("Playback could not start. Press Play again.");
      }
  };
  const seek = (ms: number) => {
    if (audio.current) {
      audio.current.currentTime = ms / 1000;
      setAt(ms);
    }
  };
  const active =
      at === 0 && !playing
        ? -1
        : track.events.reduce((last, e, i) => (e[0] <= at ? i : last), -1),
    e = track.events[chosen],
    sample = source?.run.samples[e[4]];
  const max = Math.max(...track.events.map((e) => e[0] + e[2]));
  return (
    <article className="take-player" aria-label={track.title}>
      <div className="take-heading">
        <span className="music-label">
          {track.id.toUpperCase()} / BEHAVIORAL SCORE
        </span>
        <span className="take-state">RESEARCH PREVIEW</span>
      </div>
      <h2>{track.title}</h2>
      <div className={"take-score-art " + (playing ? "is-playing" : "")}>
        <div className="take-art-label">
          <span>TRAJECTORY → NOTES</span>
          <strong>
            {String(Math.max(0, active + 1)).padStart(2, "0")}
            <small> / {track.events.length}</small>
          </strong>
        </div>
        <svg
          viewBox="0 0 900 320"
          role="img"
          aria-label={`Generated score: ${track.events.length} notes. The lit notes follow playback.`}
        >
          <defs>
            <pattern
              id={"grid-" + track.id}
              width="75"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M75 0H0V40"
                fill="none"
                stroke="currentColor"
                strokeWidth=".5"
              />
            </pattern>
          </defs>
          <rect width="900" height="320" fill={`url(#grid-${track.id})`} />
          <polyline
            points={track.events
              .map((e) => `${25 + (e[0] / max) * 850},${265 - (e[1] - 48) * 8}`)
              .join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {track.events.map((e, i) => (
            <g key={i} className={i <= active ? "sounded" : ""}>
              <line
                x1={25 + (e[0] / max) * 850}
                x2={25 + ((e[0] + e[2]) / max) * 850}
                y1={265 - (e[1] - 48) * 8}
                y2={265 - (e[1] - 48) * 8}
              />
              <circle
                cx={25 + (e[0] / max) * 850}
                cy={265 - (e[1] - 48) * 8}
                r={3 + e[3] / 22}
              />
            </g>
          ))}
          <line
            className="take-playhead"
            x1={25 + (Math.min(at, max) / max) * 850}
            x2={25 + (Math.min(at, max) / max) * 850}
            y1="15"
            y2="300"
          />
        </svg>
        <div className="take-art-foot">
          <span>NO PREWRITTEN NOTE SEQUENCE</span>
          <span>SEED {track.seed}</span>
        </div>
      </div>
      <audio
        ref={audio}
        src={url || undefined}
        preload="auto"
        onTimeUpdate={() => setAt((audio.current?.currentTime || 0) * 1000)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (url)
            setStatus("Audio could not be loaded. Try rebuilding the player.");
        }}
      />
      <div className="take-controls">
        <button
          className="take-play"
          disabled={!url}
          onClick={() => void toggle()}
        >
          {playing ? <Pause size={19} /> : <Play size={19} />}{" "}
          {playing ? "Pause recording" : "Play this take"}
        </button>
        <button
          className="take-restart"
          disabled={!url}
          aria-label="Restart this take"
          onClick={() => {
            audio.current?.pause();
            seek(0);
          }}
        >
          <ArrowCounterClockwise size={21} />
        </button>
        <span>
          {time(at)} <small>/ {time(track.durationMs)}</small>
        </span>
      </div>
      <label className="sr-only" htmlFor="take-position">
        Take playback position
      </label>
      <input
        id="take-position"
        className="take-position"
        type="range"
        min="0"
        max={track.durationMs}
        step="20"
        value={Math.min(at, track.durationMs)}
        disabled={!url}
        onChange={(ev) => seek(Number(ev.target.value))}
      />
      <p
        className={"take-verification " + (failure ? "failed" : "")}
        role="status"
      >
        {url ? <CheckCircle size={15} /> : <Fingerprint size={15} />} {status}{" "}
        {failure && (
          <button onClick={() => setRetry((n) => n + 1)}>Rebuild again</button>
        )}
      </p>
      {source && <TakeMotion samples={source.run.samples} firstTargetMs={source.run.firstTargetMs}
        events={track.events} at={at} durationMs={track.sourceDurationMs} />}
      <div className="take-downloads">
        <a href={`/first-takes/${track.id}.zip`} download>
          <DownloadSimple size={18} /> Keep the original archive <span>ZIP</span>
        </a>
        <a href={`/first-takes/${track.id}/audio.wav`} download>
          WAV <ArrowUpRight size={15} />
        </a>
        <a
          href={`/first-takes/listen-v2/${track.id}.html`}
          target="_blank"
          rel="noreferrer"
        >
          Open listening room <ArrowUpRight size={15} />
        </a>
        <a href={`/first-takes/listen-v2/${track.id}.html`} download={`${track.id}-listening-room.html`}>
          Save offline player <DownloadSimple size={15} />
        </a>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                "https://rat-lab.fun/first-takes?take=" + track.id,
              );
              setCopy("Link copied");
            } catch {
              setCopy(
                "Share this URL: https://rat-lab.fun/first-takes?take=" +
                  track.id,
              );
            }
          }}
        >
          Share this take
        </button>
      </div>
      {copy && (
        <p className="take-share-status" role="status">
          {copy}
        </p>
      )}
      <details className="take-trace">
        <summary>
          Follow a note back to the movement <ArrowUpRight size={16} />
        </summary>
        <p>
          Select a note to inspect the exact source sample. Listening does not
          require a wallet.
        </p>
        <div className="take-note-list">
          {track.events.map((e, i) => (
            <button
              key={i}
              aria-pressed={i === chosen}
              onClick={() => setChosen(i)}
            >
              <small>{String(i + 1).padStart(2, "0")}</small>
              {noteName(e[1])}
            </button>
          ))}
        </div>
        <div className="take-note-detail">
          <strong>{noteName(e[1])}</strong>
          <dl>
            <dt>At / duration</dt>
            <dd>
              {time(e[0])} / {e[2]}ms
            </dd>
            <dt>Velocity</dt>
            <dd>{e[3]} / 127</dd>
            <dt>Source sample</dt>
            <dd>
              #{e[4]} · {sample ? time(sample.atMs) : "loading"}
            </dd>
            <dt>Cursor X / Y</dt>
            <dd>
              {sample
                ? sample.cursor.map((v) => v.toFixed(5)).join(" / ")
                : "loading"}
            </dd>
          </dl>
        </div>
        <p>
          Vertical position selects a pentatonic pitch. Notes are at least 200ms
          apart; a held pitch can repeat after 650ms. Routes and this mapping
          are designed by humans.
        </p>
      </details>
      <details className="take-trace">
        <summary>
          Source, fingerprints & reconstruction <Fingerprint size={16} />
        </summary>
        <dl className="take-hashes">
          <dt>Source SHA-256</dt>
          <dd>{track.sourceSha256}</dd>
          <dt>Audio SHA-256</dt>
          <dd>{track.wavSha256}</dd>
          <dt>Download ZIP SHA-256</dt>
          <dd>{track.zipSha256}</dd>
          <dt>Model fingerprint</dt>
          <dd>{track.brainCommit}</dd>
          <dt>Host result</dt>
          <dd>
            {track.hits}/8 hits · {track.misses} misses ·{" "}
            {track.complete ? "complete" : "incomplete"} ·{" "}
            {time(track.sourceDurationMs)}
          </dd>
        </dl>
        <p>
          The host replay check and matching fingerprints support inspection;
          they are not an on-chain proof of neural execution. Download the pack,
          run node verify.mjs to check the full source-to-audio mapping. The
          separate listening room adds compatible playback controls; the original
          ZIP and on-chain player remain unchanged. No model weights or 3D assets are included.
        </p>
        <a
          href={`/first-takes/${track.id}/manifest.json`}
          target="_blank"
          rel="noreferrer"
        >
          Open work manifest <ArrowUpRight size={15} />
        </a>
      </details>
    </article>
  );
}
function TestnetArchive({ track }: { track: Track }) {
  const [deployment, setDeployment] = useState<Deployment | null>(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setFailed(false);
    fetch("/first-takes/testnet/deployment.json", {
      cache: "no-store",
      signal: c.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error("unavailable");
        return r.json();
      })
      .then((d) => {
        if (
          d.chainId !== 97 ||
          !["awaiting-funds", "deployed"].includes(d.status) ||
          typeof d.note !== "string"
        )
          throw Error("invalid");
        if (
          d.status === "deployed" &&
          (!/^0x[a-fA-F0-9]{40}$/.test(d.address) ||
            !/^0x[a-fA-F0-9]{64}$/.test(d.transactionHash) ||
            !Array.isArray(d.tokens) ||
            !d.tokens.every(
              (t: { tokenId: number; transactionHash: string }) =>
                Number.isInteger(t.tokenId) &&
                t.tokenId > 0 &&
                /^0x[a-fA-F0-9]{64}$/.test(t.transactionHash),
            ))
        )
          throw Error("invalid receipt");
        setDeployment(d);
      })
      .catch(() => {
        if (!c.signal.aborted) setFailed(true);
      });
    return () => c.abort();
  }, [retry]);
  const token = deployment?.tokens?.find((t) => t.id === track.id);
  return (
    <section className="takes-chain" aria-labelledby="takes-chain-title">
      <div>
        <span className="music-label">THE NEXT EXPERIMENT / PERSISTENCE</span>
        <h2 id="takes-chain-title">
          Keep the score.
          <br />
          Beyond this website.
        </h2>
        <p>
          The reconstruction pack works today. The test-only contract stores the
          score, player and cover together, with a fixed 16-token ceiling and
          duplicate-source protection.
        </p>
        <p>
          Public listening stays open. These four candidates are not a
          production NFT sale. There is no live auction, price promise or
          transfer of copyright.
        </p>
      </div>
      <div className="takes-chain-card">
        <span>BSC TESTNET / CHAIN 97</span>
        <h3>
          {failed
            ? "Status unavailable"
            : deployment?.status === "deployed"
              ? "Test archive published"
              : deployment
                ? "Prepared for testnet"
                : "Checking archive status…"}
        </h3>
        <p>
          {failed
            ? "The deployment record could not be read."
            : deployment?.note}
        </p>
        {failed && (
          <button onClick={() => setRetry((n) => n + 1)}>
            Retry archive status
          </button>
        )}
        {deployment?.status === "deployed" && (
          <>
            <a
              href={"https://testnet.bscscan.com/address/" + deployment.address}
              target="_blank"
              rel="noreferrer"
            >
              Contract {short(deployment.address!)} <ArrowUpRight size={16} />
            </a>
            {token && (
              <a
                href={"https://testnet.bscscan.com/tx/" + token.transactionHash}
                target="_blank"
                rel="noreferrer"
              >
                This work · test token #{token.tokenId}{" "}
                <ArrowUpRight size={16} />
              </a>
            )}
            {token && (
              <ChainCopy
                key={track.id}
                track={track}
                address={deployment.address!}
                tokenId={token.tokenId}
              />
            )}
          </>
        )}
        <a
          href="https://github.com/fefethefly/rat-lab-bsc/tree/main/contracts/first-takes"
          target="_blank"
          rel="noreferrer"
        >
          Inspect the prototype contract <ArrowUpRight size={16} />
        </a>
        <small>
          Music reconstruction is separate from proving neural execution. Model
          licensing and an independent contract review are required before any
          paid release.
        </small>
      </div>
    </section>
  );
}

function ChainCopy({
  track,
  address,
  tokenId,
}: {
  track: Track;
  address: string;
  tokenId: number;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [url, setUrl] = useState("");
  const generation = useRef(0),
    owned = useRef("");
  useEffect(
    () => () => {
      generation.current++;
      if (owned.current) URL.revokeObjectURL(owned.current);
    },
    [],
  );
  const verify = async () => {
    const token = ++generation.current;
    setBusy(true);
    setMessage("Reading the player and score directly from BSC testnet…");
    try {
      const { recoverTake } = await import("../lib/firstTakesChain");
      const blob = await recoverTake(address, tokenId, track);
      if (token !== generation.current) return;
      if (owned.current) URL.revokeObjectURL(owned.current);
      owned.current = URL.createObjectURL(blob);
      setUrl(owned.current);
      setMessage(
        "Chain copy verified: player, score and rebuilt WAV all match.",
      );
    } catch {
      if (token === generation.current)
        setMessage(
          "Could not verify the chain copy. The public RPC may be unavailable; try again.",
        );
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };
  return (
    <div className="takes-chain-check">
      <button disabled={busy} onClick={() => void verify()}>
        {busy ? "Checking chain data…" : "Verify the on-chain copy"}
      </button>
      {message && <p role="status">{message}</p>}
      {url && (
        <a href={url} download={track.id + "-from-chain.html"}>
          Download original player from chain <DownloadSimple size={16} />
        </a>
      )}
    </div>
  );
}

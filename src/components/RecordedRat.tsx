import { useEffect, useRef, useState } from "react";
import { ArrowsOut, Cube } from "@phosphor-icons/react";
import AimBoard from "./AimBoard";
import type { DuelRecording } from "../lib/duel";
import { mountRecorded, supports3D } from "../lib/recordedRenderer";
type Handle = { dispose(): void; seek(n: number): void };
export default function RecordedRat({
  recording,
  atMs,
  onReady,
}: {
  recording: DuelRecording;
  atMs: number;
  onReady?: (fallback: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    outer = useRef<HTMLDivElement>(null),
    handle = useRef<Handle | null>(null);
  const time = useRef(atMs),
    readyCallback = useRef(onReady);
  time.current = atMs;
  readyCallback.current = onReady;
  const [state, setState] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let disposed = false,
      mounted: Handle | null = null,
      settled = false;
    setState("loading");
    const finish = (fallback: boolean) => {
      if (disposed || settled) return;
      settled = true;
      setState(fallback ? "fallback" : "ready");
      readyCallback.current?.(fallback);
    };
    const deadline = window.setTimeout(() => {
      finish(true);
    }, 15000);
    if (host.current)
      mountRecorded(host.current, {
        base: "/lab/",
        ariaLabel:
          "Verified eight-target recording: the rat turns its head to aim and presses a lever. Playback is synchronized to the displayed playback clock.",
        relay: false,
        paused: true,
        hud: false,
        loader: false,
        quality: 1,
        replayJson: recording.run.replay.metaUrl,
        replayBin: recording.run.replay.binaryUrl,
        replayFastForward: 1,
        onStatus: (s: { source?: string; loading?: boolean }) => {
          if (s.source === "replay") finish(false);
          else if (s.source === "none" && !s.loading) finish(true);
        },
      })
        .then((h) => {
          mounted = h;
          if (disposed) {
            h?.dispose();
            return;
          }
          handle.current = h;
          if (!h) finish(true);
          else
            h.seek(
              Math.max(
                0,
                (time.current - recording.run.replay.timeOriginMs) / 1000,
              ),
            );
        })
        .catch(() => finish(true));
    return () => {
      disposed = true;
      clearTimeout(deadline);
      mounted?.dispose();
      handle.current = null;
    };
  }, [recording.run.id, attempt]);
  useEffect(() => {
    handle.current?.seek(
      Math.max(0, (atMs - recording.run.replay.timeOriginMs) / 1000),
    );
  }, [atMs, recording.run.replay.timeOriginMs, state]);
  const sample = [...(recording.run.samples || [])]
    .reverse()
    .find((s) => s.atMs <= atMs);
  return (
    <div className={"recorded-rat " + state} ref={outer}>
      <div className="recorded-rat-scene" ref={host} />
      {state === "loading" && (
        <div className="rat-scene-message" role="status">
          <Cube size={30} />
          <span>Preparing R-01’s recorded run…</span>
        </div>
      )}
      {state === "fallback" && (
        <div className="rat-scene-fallback">
          <AimBoard
            target={
              sample && sample.targetIndex >= 0
                ? recording.rules.targets[sample.targetIndex] || null
                : null
            }
            cursor={sample?.cursor || [0.5, 0.5]}
            index={sample?.targetIndex || 0}
          />
          <div className="fallback-note">
            {supports3D
              ? "3D unavailable · showing the same recorded cursor"
              : "Recorded cursor · public-source build"}{" "}
            {supports3D && (
              <button onClick={() => retry((n) => n + 1)}>Retry 3D</button>
            )}
          </div>
        </div>
      )}
      <div className="rat-camera-label">
        <i />
        R-01 / VERIFIED RECORDING
      </div>
      {state === "ready" && (
        <div className="rat-camera-tools">
          <span>DRAG TO ORBIT</span>
          <button
            aria-label="Expand recorded rat"
            onClick={() => outer.current?.requestFullscreen().catch(() => {})}
          >
            <ArrowsOut size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { Experiment, Run } from "./experiment";
export type DuelRecording = {
  run: Run & {
    replay: {
      metaUrl: string;
      binaryUrl: string;
      timeOriginMs: number;
      sha256: string;
    };
  };
  rules: Experiment["rules"];
  rulesHash: string;
};
export function isDuelRecording(
  value: unknown,
  prefix = "/experiment/duel",
): value is DuelRecording {
  const d = value as DuelRecording;
  const r = d?.run;
  return (
    (prefix === "/experiment/duel" ||
      /^\/challenges\/[a-f0-9]{20}$/.test(prefix)) &&
    !!r &&
    r.complete &&
    r.verified &&
    r.hits === 8 &&
    Number.isFinite(r.durationMs) &&
    r.durationMs > 0 &&
    /^[a-f0-9]{64}$/.test(r.proof) &&
    r.rulesHash === d.rulesHash &&
    d.rules?.targets?.length === 8 &&
    d.rules.targets.every(
      (t) =>
        t.length === 4 &&
        t.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
    ) &&
    d.rules.betweenDelayMs >= 0 &&
    d.rules.initialDelayMs >= 0 &&
    d.rules.targetTimeoutMs > 0 &&
    Array.isArray(r.samples) &&
    r.samples.length > 1 &&
    r.samples.every(
      (s) =>
        Number.isFinite(s.atMs) &&
        s.cursor.length === 2 &&
        s.cursor.every(Number.isFinite),
    ) &&
    Array.isArray(r.clicks) &&
    r.clicks.filter((c) => c.hit).length === 8 &&
    r.clicks
      .filter((c) => c.hit)
      .every(
        (c, i, a) =>
          c.targetIndex === i &&
          Number.isFinite(c.atMs) &&
          (i === 0 || c.atMs > a[i - 1].atMs),
      ) &&
    r.clicks.filter((c) => c.hit).at(-1)!.atMs - r.firstTargetMs ===
      r.durationMs &&
    r.replay?.metaUrl === `${prefix}/poses.json` &&
    r.replay.binaryUrl === `${prefix}/poses.bin` &&
    Number.isFinite(r.replay.timeOriginMs) &&
    /^[a-f0-9]{64}$/.test(r.replay.sha256)
  );
}
export const hitTimes = (run: Run) =>
  (run.clicks || [])
    .filter((c) => c.hit)
    .map((c) => c.atMs - run.firstTargetMs);
export const hitsAt = (run: Run, elapsedMs: number) =>
  hitTimes(run).filter((t) => t <= elapsedMs).length;
export const splitDelta = (human: number[], rat: number[], i: number) =>
  Number.isFinite(human[i]) && Number.isFinite(rat[i])
    ? human[i] - rat[i]
    : null;
export function useDuelRecording() {
  const [recording, setRecording] = useState<DuelRecording | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/experiment/duel/run.json", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (!isDuelRecording(d)) throw Error();
        if (!controller.signal.aborted) setRecording(d);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "The paired rat recording is unavailable. Retry to load a verified opponent.",
          );
      });
    return () => controller.abort();
  }, [attempt]);
  return { recording, error, retry: () => retry((n) => n + 1) };
}

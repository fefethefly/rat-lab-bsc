import { useEffect, useState } from "react";
export type Target = [number, number, number, number];
export type Sample = {
  atMs: number;
  cursor: [number, number];
  targetIndex: number;
  hits: number;
  misses: number;
};
export type Run = {
  id: string;
  startedAt: string;
  endedAt: string;
  seed: number;
  hits: number;
  misses: number;
  complete: boolean;
  durationMs: number;
  firstTargetMs: number;
  proof: string;
  brainCommit: string;
  rulesHash: string;
  verified: boolean;
  failure: string | null;
  samples?: Sample[];
  clicks?: {
    atMs: number;
    x: number;
    y: number;
    hit: boolean;
    targetIndex: number;
  }[];
};
export type Experiment = {
  schemaVersion: 1;
  updatedAt: string;
  serviceStartedAt: string;
  phase: "running" | "verifying" | "standby" | "error";
  current:
    | ({
        id: string;
        challengeId?: string | null;
        elapsedMs: number;
        target: Target | null;
      } & Sample)
    | null;
  latest: Run | null;
  history: Run[];
  nextRunAt: string | null;
  error: string | null;
  rules: {
    id: string;
    targets: Target[];
    initialDelayMs: number;
    betweenDelayMs: number;
    targetTimeoutMs: number;
    sessionTimeoutMs?: number;
    music?: {
      notes: number[];
      pitches: string[];
      instrument: string;
      previewStepMs: number;
    };
    note: string;
  };
  rulesHash: string;
  buyback: {
    mode: "SIMULATION";
    executionEnabled: false;
    wallet: null;
    perHitBnb: string;
    windowCapBnb: string;
    allocatedBnb: string;
    confirmedBnb: string;
    confirmedBuys: number;
    scope: string;
    note: string;
    records: {
      id: string;
      runId: string;
      at: string;
      hits: number;
      eligibleHits: number;
      amountBnb: string;
      proof: string;
      state: "simulated";
      txHash: null;
    }[];
  };
};
const hash = (v: unknown) => typeof v === "string" && /^[a-f\d]{64}$/i.test(v);
export function isExperiment(value: unknown): value is Experiment {
  if (!value || typeof value !== "object") return false;
  const x = value as Experiment;
  const sample = (s: Sample) =>
    Number.isFinite(s?.atMs) &&
    Array.isArray(s.cursor) &&
    s.cursor.length === 2 &&
    s.cursor.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
    Number.isInteger(s.targetIndex) &&
    s.targetIndex >= -1 &&
    s.targetIndex <= 8 &&
    Number.isInteger(s.hits) &&
    Number.isInteger(s.misses);
  const run = (r: Run) =>
    typeof r?.id === "string" &&
    hash(r.proof) &&
    hash(r.brainCommit) &&
    Number.isFinite(r.durationMs) &&
    Number.isInteger(r.hits) &&
    r.hits >= 0 &&
    r.hits <= 8 &&
    Number.isInteger(r.misses) &&
    r.misses >= 0 &&
    typeof r.verified === "boolean" &&
    hash(r.rulesHash) &&
    (r.samples === undefined ||
      (Array.isArray(r.samples) && r.samples.every(sample)));
  return (
    x.schemaVersion === 1 &&
    Number.isFinite(Date.parse(x.updatedAt)) &&
    hash(x.rulesHash) &&
    ["running", "verifying", "standby", "error"].includes(x.phase) &&
    Array.isArray(x.rules?.targets) &&
    x.rules.targets.length === 8 &&
    x.rules.targets.every(
      (t) =>
        Array.isArray(t) &&
        t.length === 4 &&
        t.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
    ) &&
    Number.isFinite(x.rules.betweenDelayMs) &&
    Number.isFinite(x.rules.targetTimeoutMs) &&
    (x.latest === null || run(x.latest)) &&
    Array.isArray(x.history) &&
    x.history.every(run) &&
    (x.current === null ||
      (Array.isArray(x.current?.cursor) &&
        x.current.cursor.length === 2 &&
        x.current.cursor.every(Number.isFinite) &&
        Number.isFinite(x.current.elapsedMs))) &&
    typeof x.buyback?.allocatedBnb === "string" &&
    /^\d+(\.\d+)?$/.test(x.buyback.allocatedBnb) &&
    Number(x.buyback.windowCapBnb) > 0 &&
    x.buyback?.mode === "SIMULATION" &&
    x.buyback.executionEnabled === false &&
    x.buyback.wallet === null &&
    Array.isArray(x.buyback.records) &&
    x.buyback.records.every(
      (r) =>
        r.state === "simulated" &&
        r.txHash === null &&
        hash(r.proof) &&
        /^\d+(\.\d+)?$/.test(r.amountBnb),
    )
  );
}
export function useExperiment(enabled = true) {
  const [data, setData] = useState<Experiment | null>(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false,
      timer = 0;
    const controller = new AbortController();
    async function read(url: string) {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) throw new Error("Unavailable");
      return response.json();
    }
    async function start() {
      let config: { statusUrl?: string } = {};
      try {
        const baseline = await read("/experiment/baseline.json");
        if (!isExperiment(baseline)) throw new Error("Invalid recording");
        if (!disposed) setData(baseline);
      } catch {
        if (!disposed) setError("The saved experiment could not be loaded.");
      }
      try {
        config = await read("/experiment/config.json");
      } catch {
        /* Static source builds can play the saved run. */
      }
      if (disposed) return;
      const url = config.statusUrl;
      if (
        !url ||
        !/^https:\/\/[a-z0-9.-]+\.up\.railway\.app\/status$/.test(url)
      ) {
        setError(
          "Cloud observer is not configured. Showing the saved experiment.",
        );
        return;
      }
      const poll = async () => {
        try {
          const next = await read(url);
          if (
            !isExperiment(next) ||
            Date.now() - Date.parse(next.updatedAt) > 20000
          )
            throw new Error("Stale data");
          if (!disposed) {
            setData((previous) => ({
              ...next,
              latest: next.latest || previous?.latest || null,
            }));
            setOnline(true);
            setError(next.error || "");
          }
        } catch {
          if (!disposed) {
            setOnline(false);
            setError(
              "Live connection unavailable. Showing the last saved result.",
            );
          }
        } finally {
          if (!disposed) timer = window.setTimeout(poll, 3000);
        }
      };
      void poll();
    }
    void start();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [retry, enabled]);
  return { data, online, error, retry: () => setRetry((n) => n + 1) };
}
export const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
export const shortHash = (hash: string) =>
  hash.slice(0, 8) + "…" + hash.slice(-6);
export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

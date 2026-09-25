import type { Target, Experiment, Run } from "./experiment";
export const templates: {
  id: string;
  name: string;
  note: string;
  targets: Target[];
}[] = [
  {
    id: "switchback",
    name: "Switchback",
    note: "Left. Right. Change direction.",
    targets: [
      [0.46, 0.36, 0.16, 0.045],
      [0.54, 0.43, 0.16, 0.045],
      [0.46, 0.5, 0.16, 0.045],
      [0.54, 0.57, 0.16, 0.045],
      [0.46, 0.45, 0.16, 0.045],
      [0.54, 0.52, 0.16, 0.045],
      [0.46, 0.59, 0.16, 0.045],
      [0.54, 0.63, 0.16, 0.045],
    ],
  },
  {
    id: "staircase",
    name: "Staircase",
    note: "Eight steps across the field.",
    targets: Array.from(
      { length: 8 },
      (_, i) =>
        [
          Number((0.42 + i * 0.02).toFixed(2)),
          Number((0.35 + i * 0.04).toFixed(2)),
          0.16,
          0.045,
        ] as Target,
    ),
  },
  {
    id: "return",
    name: "Return trip",
    note: "Go out. Trace your way back.",
    targets: [
      [0.44, 0.36, 0.16, 0.045],
      [0.48, 0.43, 0.16, 0.045],
      [0.52, 0.5, 0.16, 0.045],
      [0.56, 0.58, 0.16, 0.045],
      [0.55, 0.63, 0.16, 0.045],
      [0.51, 0.55, 0.16, 0.045],
      [0.47, 0.47, 0.16, 0.045],
      [0.43, 0.39, 0.16, 0.045],
    ],
  },
];
export type Mission = {
  id: string;
  title: string;
  createdAt: number;
  state:
    | "queued"
    | "running"
    | "complete"
    | "incomplete"
    | "error"
    | "interrupted";
  ahead: number;
  error: string | null;
  rules: Experiment["rules"];
  rulesHash: string;
  run:
    | (Run & {
        replay?: {
          metaUrl: string;
          binaryUrl: string;
          timeOriginMs: number;
          sha256: string;
        };
      })
    | null;
};
let basePromise: Promise<string> | null = null;
export function observerBase() {
  if (!basePromise)
    basePromise = fetch("/experiment/config.json", {
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => {
        if (!r.ok) throw Error("The mission service is unavailable.");
        return r.json();
      })
      .then((j) => {
        if (
          typeof j.statusUrl !== "string" ||
          !/^https:\/\/[a-z0-9.-]+\.up\.railway\.app\/status$/.test(j.statusUrl)
        )
          throw Error("The mission service is not configured.");
        return j.statusUrl.slice(0, -7) as string;
      })
      .catch((e) => {
        basePromise = null;
        throw e;
      });
  return basePromise;
}
export async function readMission(id: string, signal?: AbortSignal) {
  if (!/^[a-f0-9]{20}$/.test(id)) throw Error("This mission link is invalid.");
  const base = await observerBase();
  const r = await fetch(`${base}/challenges/${id}`, {
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
  if (!r.ok)
    throw Error(
      r.status === 404
        ? "This mission does not exist."
        : "The mission could not be loaded.",
    );
  const m = (await r.json()) as Mission;
  if (
    m.id !== id ||
    typeof m.title !== "string" ||
    !Array.isArray(m.rules?.targets) ||
    m.rules.targets.length !== 8 ||
    !m.rules.targets.every(
      (t) => Array.isArray(t) && t.length === 4 && t.every(Number.isFinite),
    ) ||
    ![
      "queued",
      "running",
      "complete",
      "incomplete",
      "error",
      "interrupted",
    ].includes(m.state)
  )
    throw Error("The mission record is invalid.");
  return { mission: m, base };
}

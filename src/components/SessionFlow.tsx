import type { Experiment } from "../lib/experiment";
export default function SessionFlow({ data }: { data: Experiment }) {
  const run = data.latest;
  const row = data.buyback.records.find((r) => r.proof === run?.proof);
  return (
    <section
      className="session-flow"
      aria-label="Latest experiment to paper allocation"
    >
      <div className="session-flow-heading">
        <span>LATEST COMPLETED SESSION / {run?.id || "WAITING"}</span>
        <a href="/buyback">Inspect the simulation ledger ↗</a>
      </div>
      <ol>
        <li>
          <small>01 / NEURAL RUN</small>
          <strong>{run ? `${run.hits} targets hit` : "Awaiting a run"}</strong>
          <p>
            {run
              ? `${run.misses} misses · ${(run.durationMs / 1000).toFixed(2)}s`
              : "Fixed policies control the rat."}
          </p>
        </li>
        <li>
          <small>02 / REPLAY CHECK</small>
          <strong>
            {run?.verified ? "Frames & clicks matched" : "Not yet verified"}
          </strong>
          <p>
            {run?.verified
              ? "Verified on the recording host."
              : "Unverified runs earn no paper allocation."}
          </p>
        </li>
        <li className="flow-paper">
          <small>03 / PAPER ALLOCATION</small>
          <strong>{row ? `${row.amountBnb} BNB` : "No allocation"}</strong>
          <p>
            {row
              ? `${row.eligibleHits} eligible hits · proof counted once`
              : "Only unique verified proofs qualify."}
          </p>
        </li>
        <li>
          <small>04 / TRANSACTION</small>
          <strong>Not executed</strong>
          <p>Simulation only. No funded wallet or swap.</p>
        </li>
      </ol>
    </section>
  );
}

import { useState } from "react";
import {
  ArrowRight,
  Crosshair,
  Cursor,
  HandTap,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";

const phases = [
  {
    label: "Aim",
    name: "The head is the mouse.",
    description:
      "The steering policy reads the target and cursor positions. Four neck actuators turn the head to move the cursor.",
    tag: "STEERING POLICY",
    inputs: "21 inputs",
    outputs: "4 neck actuators + press",
    Icon: Crosshair,
  },
  {
    label: "Press",
    name: "The paw makes the click.",
    description:
      "On target, control passes to the lever policy. It coordinates the body to press the lever while staying upright.",
    tag: "LEVER POLICY",
    inputs: "200 inputs",
    outputs: "38 body actuators",
    Icon: HandTap,
  },
  {
    label: "Recover",
    name: "Balance. Then begin again.",
    description:
      "After the press, the body recovers before steering resumes. In the BSC experiment, a clean hit advances the preset sequence.",
    tag: "CONTROL HANDOFF",
    inputs: "Lever policy",
    outputs: "Steering resumes",
    Icon: ArrowCounterClockwise,
  },
];

export default function MechanismDemo() {
  const [phase, setPhase] = useState(0);
  const selected = phases[phase];
  return (
    <div className="mechanism-demo">
      <div className="mechanism-stage">
        <div className="diagram-label">
          <span className="site-mono">POLICY ROUTING</span>
          <span className="site-mono">ILLUSTRATION / NOT TELEMETRY</span>
        </div>
        <svg
          viewBox="0 0 540 250"
          role="img"
          aria-label={`${selected.tag}: ${selected.inputs} to ${selected.outputs}`}
        >
          <defs>
            <pattern
              id="network-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".6" fill="currentColor" opacity=".16" />
            </pattern>
          </defs>
          <rect width="540" height="250" fill="url(#network-grid)" />
          {[0, 1, 2, 3].flatMap((layer) =>
            [0, 1, 2, 3, 4].flatMap((a) =>
              [0, 1, 2, 3, 4].map((b) => (
                <line
                  key={`${layer}-${a}-${b}`}
                  x1={65 + layer * 102}
                  y1={48 + a * 38}
                  x2={167 + layer * 102}
                  y2={48 + b * 38}
                  stroke={a === b ? "var(--site-accent)" : "currentColor"}
                  strokeOpacity={a === b ? 0.4 : 0.09}
                  strokeWidth={a === b ? 1.4 : 0.7}
                />
              )),
            ),
          )}
          {[0, 1, 2, 3, 4].flatMap((layer) =>
            [0, 1, 2, 3, 4].map((n) => (
              <circle
                key={`${layer}-${n}`}
                cx={65 + layer * 102}
                cy={48 + n * 38}
                r={layer === 0 || layer === 4 ? 6 : 4}
                fill={
                  (layer + phase) % 3 === 0
                    ? "var(--site-accent)"
                    : "var(--site-paper)"
                }
                stroke={
                  (layer + phase) % 3 === 0 ? "var(--site-accent)" : "#8e66a5"
                }
                strokeWidth="1.5"
              />
            )),
          )}
          <path
            key={phase}
            className="signal-path"
            d={
              phase === 1
                ? "M65 48 L167 124 L269 200 L371 86 L473 124"
                : phase === 2
                  ? "M65 162 L167 86 L269 124 L371 48 L473 86"
                  : "M65 124 L167 86 L269 162 L371 124 L473 124"
            }
            stroke="var(--site-accent)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
        <div className="diagram-io">
          <span>{selected.inputs}</span>
          <ArrowRight size={18} />
          <span>{selected.outputs}</span>
        </div>
        <div className={"cursor-demo phase-" + phase} aria-hidden="true">
          <span className="site-mono">VIRTUAL CONTROL SURFACE</span>
          <div className="demo-target">
            <Crosshair size={26} />
          </div>
          <Cursor className="demo-cursor" size={24} weight="fill" />
          <small>
            {phase === 0
              ? "Locate the target"
              : phase === 1
                ? "Lever press → click"
                : "Return control → aim"}
          </small>
        </div>
      </div>
      <div className="mechanism-explainer">
        <div className="site-mono section-kicker">02 / THE MECHANISM</div>
        <h2>
          Two networks.
          <br />
          One little decision.
        </h2>
        <p className="site-description">
          Learned motor control, made visible. Explore how the two policies take
          turns.
        </p>
        <div
          className="mechanism-tabs"
          role="tablist"
          aria-label="Explore the control cycle"
        >
          {phases.map(({ label, Icon }, i) => (
            <button
              key={label}
              id={"phase-tab-" + i}
              role="tab"
              aria-selected={phase === i}
              aria-controls="phase-description"
              tabIndex={phase === i ? 0 : -1}
              onClick={() => setPhase(i)}
              onKeyDown={(e) => {
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
                  setPhase(next);
                  document.getElementById("phase-tab-" + next)?.focus();
                }
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
        <div
          id="phase-description"
          role="tabpanel"
          aria-labelledby={"phase-tab-" + phase}
          tabIndex={0}
          className="phase-description"
        >
          <span className="site-mono">
            0{phase + 1} / {selected.tag}
          </span>
          <h3>{selected.name}</h3>
          <p>{selected.description}</p>
        </div>
      </div>
    </div>
  );
}

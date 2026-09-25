import { useRef } from "react";
import type { Target } from "../lib/experiment";
const px = (x: number) => 80 + ((x - 0.42) / 0.16) * 640;
const py = (y: number) => 65 + ((y - 0.35) / 0.29) * 390;
const limit = (n: number, a: number, b: number) =>
  Math.round(Math.min(b, Math.max(a, n)) * 1000) / 1000;
export default function MissionMap({
  targets,
  selected = 0,
  onSelect,
  onMove,
  compact = false,
}: {
  targets: Target[];
  selected?: number;
  onSelect?: (i: number) => void;
  onMove?: (i: number, x: number, y: number) => void;
  compact?: boolean;
}) {
  const drag = useRef<number | null>(null);
  return (
    <svg
      className={"mission-map" + (compact ? " compact" : "")}
      viewBox="0 0 800 530"
      role="img"
      aria-label="Eight numbered target centers connected in challenge order"
    >
      <defs>
        <pattern
          id={compact ? "mission-grid-mini" : "mission-grid"}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M40 0H0V40"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".09"
          />
        </pattern>
      </defs>
      <rect
        width="800"
        height="530"
        fill={`url(#${compact ? "mission-grid-mini" : "mission-grid"})`}
      />
      <path
        d="M40 30h20m-20 0v20m720-20h-20m20 0v20M40 490h20m-20 0v-20m720 20h-20m20 0v-20"
        stroke="#88769e"
        fill="none"
      />
      <path
        d="M400 30v470M40 265h720"
        stroke="#79618e"
        strokeOpacity=".22"
        strokeDasharray="3 8"
      />
      <polyline
        points={targets.map((t) => `${px(t[0])},${py(t[1])}`).join(" ")}
        fill="none"
        stroke="#a884cd"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {targets.map((t, i) => (
        <g
          key={i}
          className={"mission-node" + (i === selected ? " selected" : "")}
          transform={`translate(${px(t[0])},${py(t[1])})`}
          style={onMove ? { cursor: "grab", touchAction: "none" } : undefined}
          onPointerDown={
            onMove
              ? (e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  drag.current = i;
                  onSelect?.(i);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
              : undefined
          }
          onPointerMove={
            onMove
              ? (e) => {
                  if (drag.current !== i) return;
                  const svg = e.currentTarget.ownerSVGElement!;
                  const ctm = svg.getScreenCTM();
                  if (!ctm) return;
                  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                    ctm.inverse(),
                  );
                  onMove(
                    i,
                    limit(0.42 + ((p.x - 80) / 640) * 0.16, 0.42, 0.58),
                    limit(0.35 + ((p.y - 65) / 390) * 0.29, 0.35, 0.64),
                  );
                }
              : undefined
          }
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {i === selected && (
            <>
              <circle
                className="mission-orbit"
                r="32"
                fill="none"
                stroke="#f0b90b"
                strokeOpacity=".4"
                strokeDasharray="3 5"
              />
              <path d="M-47 0h9m76 0h9M0-47v9m0 76v9" stroke="#f0b90b" />
            </>
          )}
          <circle
            r="21"
            fill={i === selected ? "#f0b90b" : "#160e22"}
            stroke={i === selected ? "#f0b90b" : "#86629f"}
            strokeWidth="1.5"
          />
          <text
            textAnchor="middle"
            y="5"
            fill={i === selected ? "#160e22" : "#eee4fa"}
            fontSize="13"
            fontFamily="JetBrains Mono,monospace"
          >
            {String(i + 1).padStart(2, "0")}
          </text>
        </g>
      ))}
      <text x="55" y="518" fill="#b4a1c7" fontSize="10" fontFamily="monospace">
        TARGET CENTERS / SEQUENCE MAP
      </text>
      <text
        x="745"
        y="518"
        textAnchor="end"
        fill="#b4a1c7"
        fontSize="10"
        fontFamily="monospace"
      >
        X .42–.58 · Y .35–.64
      </text>
    </svg>
  );
}

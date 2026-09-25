import type { Target } from "../lib/experiment";
export default function AimBoard({
  target,
  cursor,
  index = 0,
  trail = [],
  onPoint,
  onKey,
  interactive = false,
}: {
  target: Target | null;
  cursor: [number, number];
  index?: number;
  trail?: [number, number][];
  onPoint?: (point: [number, number]) => void;
  onKey?: (event: React.KeyboardEvent<SVGSVGElement>) => void;
  interactive?: boolean;
}) {
  return (
    <svg
      className={"aim-board" + (interactive ? " interactive" : "")}
      viewBox="0 0 1000 650"
      preserveAspectRatio="none"
      role={interactive ? "application" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? "Aim challenge. Click inside the gold target. Or use arrow keys to move and Space to press."
          : "Recorded neural cursor and target on the virtual control surface"
      }
      onKeyDown={onKey}
      onPointerDown={
        interactive
          ? (e) => {
              if (e.button !== 0) return;
              e.currentTarget.focus();
              const r = e.currentTarget.getBoundingClientRect();
              onPoint?.([
                (e.clientX - r.left) / r.width,
                (e.clientY - r.top) / r.height,
              ]);
            }
          : undefined
      }
    >
      <defs>
        <pattern
          id={interactive ? "challenge-grid" : "observe-grid"}
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 50 0 L 0 0 0 50"
            fill="none"
            stroke="#bba4d0"
            strokeOpacity=".065"
          />
        </pattern>
      </defs>
      <rect
        width="1000"
        height="650"
        fill={`url(#${interactive ? "challenge-grid" : "observe-grid"})`}
      />
      <path
        d="M0 325h1000M500 0v650"
        stroke="#bba4d0"
        strokeOpacity=".11"
        strokeDasharray="4 8"
      />
      <text x="28" y="35" fill="#887c99" fontSize="12" fontFamily="monospace">
        RAT LAB / VIRTUAL CONTROL SURFACE
      </text>
      <text x="28" y="626" fill="#887c99" fontSize="12" fontFamily="monospace">
        X → HEAD AIM Y → HEAD PITCH
      </text>
      {trail.length > 1 && (
        <polyline
          points={trail.map(([x, y]) => `${x * 1000},${y * 650}`).join(" ")}
          fill="none"
          stroke="#b289db"
          strokeWidth="2"
          strokeOpacity=".7"
        />
      )}
      {target && (
        <g>
          <rect
            x={(target[0] - target[2]) * 1000}
            y={(target[1] - target[3]) * 650}
            width={target[2] * 2000}
            height={target[3] * 1300}
            rx="4"
            fill="#f0b90b18"
            stroke="#f0b90b"
            strokeWidth="2"
          />
          <text
            x={target[0] * 1000}
            y={target[1] * 650 + 5}
            textAnchor="middle"
            fontSize="13"
            fill="#f0b90b"
            fontFamily="monospace"
          >
            TARGET {String(index + 1).padStart(2, "0")}
          </text>
        </g>
      )}
      <g
        transform={`translate(${cursor[0] * 1000},${cursor[1] * 650})`}
        pointerEvents="none"
      >
        <circle r="16" fill="#c7a9ff12" stroke="#dac9f5" strokeWidth="1.5" />
        <circle r="3" fill="#f9f5ff" />
        <path d="M-24 0h7m34 0h7M0-24v7m0 34v7" stroke="#dac9f5" />
      </g>
    </svg>
  );
}

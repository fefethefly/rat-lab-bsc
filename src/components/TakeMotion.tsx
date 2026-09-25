import { scale, type BehaviorEvent } from '../lib/firstTakesCore.js';
type Sample = { atMs: number; cursor: [number, number] };
const names = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'];
export default function TakeMotion({ samples, firstTargetMs, events, at, durationMs }: {
  samples: Sample[]; firstTargetMs: number; events: BehaviorEvent[]; at: number; durationMs: number;
}) {
  const path = samples.filter(s => s.atMs >= firstTargetMs && s.atMs <= firstTargetMs + durationMs);
  const current = path.reduce((last, s) => s.atMs <= firstTargetMs + at ? s : last, path[0]);
  const sounded = events.filter(e => e[0] <= at && at < e[0] + e[2]);
  const event = events.reduce<BehaviorEvent | undefined>((last, e) => e[0] <= at ? e : last, undefined);
  if (!current) return null;
  const minX = Math.min(...path.map(s => s.cursor[0])) - .02;
  const minY = Math.min(...path.map(s => s.cursor[1])) - .02;
  const width = Math.max(...path.map(s => s.cursor[0])) - minX + .02;
  const height = Math.max(...path.map(s => s.cursor[1])) - minY + .02;
  const x = (v: number) => 12 + (v - minX) / width * 236;
  const y = (v: number) => 10 + (v - minY) / height * 160;
  return <section className="take-motion" aria-label="Movement and musical notes synchronized with playback">
    <div className="take-motion-head"><span className="music-label">MOVEMENT / SOUND</span><span>Recorded cursor · { (at / 1000).toFixed(2) }s</span></div>
    <div className="take-motion-body">
      <svg viewBox="0 0 260 180" role="img" aria-label="Magnified recorded cursor path. The yellow marker follows the source samples.">
        {[.2, .4, .6, .8].map(y => <line key={y} x1="12" x2="248" y1={10 + y * 160} y2={10 + y * 160} stroke="#493750" strokeWidth=".6" />)}
        <polyline points={path.map(s => `${x(s.cursor[0])},${y(s.cursor[1])}`).join(' ')} fill="none" stroke="#79628d" strokeWidth="1.5" />
        <circle cx={x(current.cursor[0])} cy={y(current.cursor[1])} r="11" fill="#efc54b" opacity=".16" />
        <circle cx={x(current.cursor[0])} cy={y(current.cursor[1])} r="4" fill="#efc54b" />
      </svg>
      <div className="take-motion-reading">
        <p>Hear where it moves.</p>
        <div className="take-keys" aria-label="Pitch scale, with sounding notes highlighted">
          {scale.map((midi, i) => <span key={midi} className={sounded.some(e => e[1] === midi) ? 'sounding' : ''}>{names[i]}</span>)}
        </div>
        <div className="take-motion-data"><span>X {current.cursor[0].toFixed(3)} / Y {current.cursor[1].toFixed(3)}</span><span>{event ? `Note sample #${event[4]}` : 'Before the first note'}</span></div>
        <small>Height selects pitch. Horizontal position shapes velocity. Magnified cursor replay from the recording, not a live piano performance.</small>
      </div>
    </div>
  </section>;
}

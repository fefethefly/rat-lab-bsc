import { pitches, type NoteEvent } from '../lib/music';
export default function PianoStage({ events, at, duration, playing, mode, onSeek }: {
  events: NoteEvent[]; at: number; duration: number; playing: boolean;
  mode: 'response' | 'score'; onSeek: (at: number) => void;
}) {
  const active = playing ? [...events].reverse().find(e => e.atMs <= at && at - e.atMs < 500) : undefined;
  const heard = events.filter(e => e.atMs <= at).length;
  return <section className="piano-stage" aria-label={mode === 'response' ? 'Recorded piano performance' : 'Evenly spaced score preview'}>
    <div className="piano-stage-top"><span>{mode === 'response' ? 'R-01 / RECORDED RESPONSE' : 'YOUR SCORE / EVEN SPACING'}</span><span>{playing ? 'SOUND ON' : 'PRESS PLAY TO LISTEN'}</span></div>
    <div className="piano-paper">
      <div className="piano-paper-label"><span>{mode === 'response' ? 'The space between the notes is its own.' : 'The same notes, before the rat plays.'}</span><b>{String(heard).padStart(2,'0')}<small> / {events.length}</small></b></div>
      <svg viewBox="0 0 800 200" role="img" aria-label="Pitch and timing of the notes. The gold line follows playback.">
        {pitches.map((p,i)=><g key={p.name}><text x="5" y={162-i*42}>{p.octave}</text><line x1="40" x2="780" y1={157-i*42} y2={157-i*42} className="piano-rule" /></g>)}
        {events.map(e=><g key={e.step} className={e.atMs <= at ? 'played' : ''}>
          <line x1={45+e.atMs/duration*725} x2={45+Math.min(e.atMs+450,duration)/duration*725} y1={157-e.note*42} y2={157-e.note*42} className="piano-note-tail" />
          <circle cx={45+e.atMs/duration*725} cy={157-e.note*42} r={active?.step===e.step?10:6} className="piano-note-dot" />
        </g>)}
        <line x1={45+at/duration*725} x2={45+at/duration*725} y1="14" y2="178" className="piano-needle" />
        <text x="40" y="198">0s</text><text x="727" y="198">{(duration/1000).toFixed(1)}s</text>
      </svg>
      <div className="piano-cues" aria-label="Jump to a note">
        {events.map(e=><button key={e.step} type="button" onClick={()=>onSeek(e.atMs)} aria-label={`Jump to note ${e.step+1}, ${pitches[e.note].octave}, ${(e.atMs/1000).toFixed(2)} seconds`} className={active?.step===e.step?'active':''}><span>{String(e.step+1).padStart(2,'0')}</span>{pitches[e.note].name}<small>{(e.atMs/1000).toFixed(2)}s</small></button>)}
      </div>
    </div>
    <div className="piano-keybed" aria-label="Four mapped pitches, highlighted on note onset">
      {pitches.map((p,i)=><div key={p.name} className={'piano-ivory '+(active?.note===i?'pressed':'')}><i/><b>{p.name}<small>4</small></b><span>{active?.note===i?'●':'—'}</span></div>)}
    </div>
    <div className="piano-stage-foot"><span>ORIGINAL SYNTHESIZED KEYS</span><span>{mode==='response'?'SUCCESSFUL HITS MAKE SOUND':'PREVIEW · NO MODEL PLAYBACK'}</span></div>
  </section>;
}

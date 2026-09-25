/** RAT LAB original behavioral mapping and integer PCM renderer. MIT. No network dependencies. */
export const mappingVersion = 'trajectory-keys-v1';
export const rendererVersion = 'integer-keys-v1';
export const scale = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74];
const frequencies = [130813,146832,164814,195998,220000,261626,293665,329628,391995,440000,523251,587330];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function deriveEvents(source) {
  const run = source?.run;
  if (!run?.verified || !Array.isArray(run.samples) || !run.samples.length || !Number.isFinite(run.firstTargetMs) || !Number.isFinite(run.durationMs)) throw Error('A host-verified recording is required.');
  const events = []; let previous = null;
  for (let i = 0; i < run.samples.length; i++) {
    const s = run.samples[i];
    if (!Number.isInteger(s.atMs) || !Array.isArray(s.cursor) || s.cursor.length !== 2 || !s.cursor.every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw Error('Malformed source sample.');
    if (i && s.atMs <= run.samples[i-1].atMs) throw Error('Samples must be ordered.');
    if (s.atMs < run.firstTargetMs || s.atMs > run.firstTargetMs + run.durationMs || s.atMs > run.firstTargetMs + 30000) continue;
    const at = s.atMs - run.firstTargetMs;
    const pitch = scale[clamp(Math.floor((.8-s.cursor[1])/.6*scale.length),0,scale.length-1)];
    const speed = previous ? Math.hypot(s.cursor[0]-previous.cursor[0],s.cursor[1]-previous.cursor[1])*1000/(s.atMs-previous.atMs) : 0;
    const last = events.at(-1);
    if (!last || (at-last[0] >= 200 && (pitch !== last[1] || at-last[0] >= 650))) {
      events.push([at,pitch,clamp(220+Math.floor(speed*1200),220,750),clamp(35+Math.floor(s.cursor[0]*80),35,115),i]);
    }
    previous=s;
    if (events.length===64) break;
  }
  if (!events.length) throw Error('No usable trajectory samples.');
  return events;
}
export function validateEvents(events) {
  if (!Array.isArray(events) || events.length<1 || events.length>64) throw Error('Invalid event count.');
  events.forEach((e,i)=>{
    if (!Array.isArray(e)||e.length!==5||!e.every(Number.isInteger)||e[0]<0||e[0]>30000||!scale.includes(e[1])||e[2]<220||e[2]>750||e[3]<35||e[3]>115||e[4]<0||e[4]>1000||(i&&e[0]<=events[i-1][0])) throw Error('Invalid music event.');
  });
  return events;
}
export function packEvents(events) {
  validateEvents(events);
  const b = new Uint8Array(events.length*10), v=new DataView(b.buffer);
  events.forEach((e,i)=>{const p=i*10;v.setUint32(p,e[0]);v.setUint8(p+4,e[1]);v.setUint16(p+5,e[2]);v.setUint8(p+7,e[3]);v.setUint16(p+8,e[4]);});
  return b;
}
export function unpackEvents(bytes) {
  if (!(bytes instanceof Uint8Array)||bytes.length%10) throw Error('Invalid packed score.');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), out=[];
  for(let p=0;p<bytes.length;p+=10) out.push([v.getUint32(p),v.getUint8(p+4),v.getUint16(p+5),v.getUint8(p+7),v.getUint16(p+8)]);
  return validateEvents(out);
}
export function renderWav(events) {
  validateEvents(events);
  const rate=22050, length=Math.ceil((Math.max(...events.map(e=>e[0]+e[2]))+200)*rate/1000), mix=new Int32Array(length);
  for(const [at,pitch,duration,velocity] of events) {
    const start=Math.floor(at*rate/1000), count=Math.floor(duration*rate/1000), attack=220;
    const step=Math.round(frequencies[scale.indexOf(pitch)]*65536/(rate*1000));
    let phase=0,filtered=0;
    for(let n=0;n<count;n++) {
      const tri=phase<32768?phase*2-32768:98303-phase*2;
      const env=n<attack?Math.floor(n*32768/attack):Math.floor((count-n)*32768/(count-attack));
      filtered=Math.trunc((filtered*3+tri)/4);
      mix[start+n]+=Math.trunc(Math.trunc(filtered*env/32768)*velocity/400);
      phase=(phase+step)&65535;
    }
  }
  const out=new Uint8Array(44+length*2),v=new DataView(out.buffer);
  for(const [p,s] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]) for(let i=0;i<s.length;i++)out[p+i]=s.charCodeAt(i);
  v.setUint32(4,out.length-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,length*2,true);
  for(let n=0;n<length;n++)v.setInt16(44+n*2,clamp(mix[n],-32768,32767),true);
  return out;
}
export async function sha256(bytes) {
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
export function coverSvg(events, title='RAT LAB / FIRST TAKES') {
  validateEvents(events);
  const safe=title.replace(/[<>&"']/g,'');
  const total=Math.max(...events.map(e=>e[0]+e[2])), points=events.map(e=>`${80+e[0]/total*840},${460-(e[1]-48)*10}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650"><rect width="1000" height="650" fill="#100c19"/><g stroke="#30243e">${[180,240,300,360,420,480].map(y=>`<path d="M60 ${y}h880"/>`).join('')}</g><text x="60" y="80" fill="#efc54b" font-family="monospace" font-size="20">${safe}</text><polyline fill="none" stroke="#efc54b" stroke-width="3" points="${points}"/>${events.map(e=>`<circle cx="${80+e[0]/total*840}" cy="${460-(e[1]-48)*10}" r="${3+e[3]/22}" fill="#efc54b"/>`).join('')}<text x="60" y="585" fill="#bcaecb" font-family="monospace" font-size="15">BEHAVIOR → SCORE / ${events.length} NOTES / ${mappingVersion}</text></svg>`;
}

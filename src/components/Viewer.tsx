import {useState} from 'react';
import {Expand} from 'lucide-react';

/** Original public-source fallback. The separate upstream 3D viewer is not redistributed here. */
export default function Viewer({running}: {running: boolean; replayOnly?: boolean}) {
  const [expanded,setExpanded]=useState(false);
  return <div className="view-frame" style={{minHeight:360,position:'relative',overflow:'hidden',background:'radial-gradient(circle at 75% 50%,#271040,#080313 65%)'}}>
    <div className="scene" style={{display:'grid',placeItems:'center',minHeight:360}}>
      <img src="/brand/rat-avatar.png" alt="Purple RAT LAB mascot beside a golden lever" style={{display:'block',height:300,maxWidth:'80%',objectFit:'contain'}}/>
    </div>
    <div className="scene-top"><span><i className="dot amber"/>STATIC MASCOT ILLUSTRATION</span><span className="mono">RAT LAB / SUBJECT R-01</span></div>
    <div className="scene-corner tl"/><div className="scene-corner tr"/><div className="scene-corner bl"/><div className="scene-corner br"/>
    <div className="subject-label"><span className="crosshair">+</span><div>SUBJECT R-01<small>VIRTUAL RODENT / RESEARCH</small></div></div>
    <div className="scene-bottom"><span>{running?'Neural session status appears in the operator log':'Illustration only · no recorded or live session shown'}</span><div><button title="Fullscreen" aria-label="Fullscreen" onClick={async e=>{const frame=e.currentTarget.closest('.view-frame') as HTMLElement|null;if(!frame)return;if(expanded){await document.exitFullscreen();setExpanded(false)}else{await frame.requestFullscreen();setExpanded(true)}}}><Expand size={15}/></button></div></div>
  </div>;
}

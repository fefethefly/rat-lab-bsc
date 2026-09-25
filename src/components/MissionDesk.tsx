import { useState } from "react";
import { ArrowUpRight, ArrowRight } from "@phosphor-icons/react";
import MissionMap from "./MissionMap";
import MissionReplay from "./MissionReplay";
import { templates } from "../lib/missions";
import "../missions.css";
import "../music.css";
export default function MissionDesk() {
  const [chosen, setChosen] = useState(0);
  const template = templates[chosen];
  return (
    <section className="mission-hero" aria-labelledby="hero-title">
      <div className="mission-eyebrow">
        <span>
          <i /> RAT LAB / OPEN EXPERIMENTS
        </span>
        <span>YOU DESIGN. WE RUN. EVERYONE CAN RACE.</span>
      </div>
      <div className="mission-headline">
        <h1 id="hero-title">
          You set the test.
          <br />
          The rat <em>makes its move.</em>
        </h1>
        <p>
          A little curiosity. Eight targets. <br />
          Design a challenge for a virtual rat. <br />
          Then see if you can beat it.
        </p>
      </div>
      <section className="music-home-invite">
        <div className="music-home-keys" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div>
          <span className="music-label">NEW EXPERIMENT / MUSIC STUDIO</span>
          <h2>Write a little melody.</h2>
          <p>Eight notes from you. A real recorded response from the rat.</p>
        </div>
        <a href="/music">
          Enter the music room <ArrowUpRight size={18} />
        </a>
      </section>
      <div className="mission-workbench">
        <aside className="mission-brief">
          <span className="mission-kicker">YOUR NEXT EXPERIMENT</span>
          <h2>
            What will
            <br />
            you ask it
            <br />
            to do?
          </h2>
          <p>
            Start with a route. Move the targets. Give the trained policies a
            new problem.
          </p>
          <div className="mission-presets" aria-label="Choose a starting route">
            {templates.map((t, i) => (
              <button
                key={t.id}
                aria-pressed={i === chosen}
                onClick={() => setChosen(i)}
              >
                <span>0{i + 1}</span>
                <strong>{t.name}</strong>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
          <a
            className="mission-primary"
            href={`/create?template=${template.id}`}
          >
            Make it your own <ArrowRight size={18} />
          </a>
          <a className="mission-secondary" href="/challenge">
            Race the verified benchmark <ArrowUpRight size={15} />
          </a>
        </aside>
        <div className="mission-drawing">
          <div className="mission-drawing-head">
            <span>DESIGN STUDY / {template.name.toUpperCase()}</span>
            <span>08 TARGETS</span>
          </div>
          <MissionMap targets={template.targets} selected={chosen * 2} />
          <div className="mission-drawing-foot">
            <p>{template.note}</p>
            <span>EDITABLE TEMPLATE · NOT A RUN RESULT</span>
          </div>
        </div>
      </div>
      <div className="mission-process">
        {[
          ["01", "Set the problem", "Your target positions and sequence."],
          [
            "02",
            "Watch the attempt",
            "Real inference. Success or failure saved.",
          ],
          ["03", "Leave your mark", "A saved link. A replay. A race to share."],
        ].map(([n, title, body]) => (
          <div key={n}>
            <b>{n}</b>
            <span>
              <strong>{title}</strong>
              <small>{body}</small>
            </span>
          </div>
        ))}
      </div>
      <MissionReplay />
      <div className="mission-honesty">
        <span>THE FIRST SERIES: EIGHT TARGETS</span>
        <p>
          Fixed trained policies in a simulated body. New tasks, recorded
          attempts. This is inference, not live learning.
        </p>
        <a href="/live">
          Inside the lab <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}

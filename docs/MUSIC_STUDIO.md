# Music studio / 音乐实验室

Live: [Listening room](https://rat-lab.fun/music) · [Compose](https://rat-lab.fun/music?compose=1) · [First recorded take](https://rat-lab.fun/music?id=a9cfcf042e75987cebb8)

## Listening room update — September 26

`/music` now opens a featured **recorded** performance, clearly labelled with its recording date and operator-created provenance. The existing `/music?id=…` and `?remix=…` links remain supported; `/music?compose=1` opens the editor. The featured public record is bundled at `public/experiment/music-featured.json`, so the score, hit timing and synthesized playback do not depend on the observer being online. The separately supplied 3D replay still loads from the observer, with a cursor fallback. Playback no longer waits for 3D to load.

The performance presents an original horizontal pitch/time ribbon, eight timestamped note cues and four mapped ivory keys. Note cues pause and seek to their exact timestamp. Sound and key highlights use the same transport clock. **The rat’s response / Original score** switches between actual successful-hit timestamps and the existing evenly spaced 650ms preview; switching stops audio and resets the transport. The source-motion panel appears only for the recorded response, keeping previews distinct from model execution. WAV export always contains the recorded response, regardless of the selected listening mode.

The comparison table aligns each original note with its real hit timestamp and leaves unreached notes blank. No successful notes are invented, and no stored recording or First Takes asset is retimed. This is behavioral performance of an authored score, not an autonomous music policy or a simulation of paws pressing a physical piano.

The editor adds A/S/D/F shortcuts while the score desk is focused, optional automatic advance to the next note, and undo for the last 32 key edits. Typing in the title does not trigger notes. The final slot stays selected instead of silently wrapping. A short original transcription of the opening of Beethoven’s Ode to Joy (E E D C C D E E) joins the existing starting phrases; it stays within the four-pitch task contract.

## What ships

Visitors write eight notes from C4, D4, E4 and G4, preview the score, and submit a real fixed-policy inference attempt. Each successful target hit plays its assigned note. The saved response preserves the rat’s timing and silent misses. It includes synchronized body/cursor playback, per-note hit times, pause/seek/mute controls, WAV export, a permanent attempt link and score remixing.

The visual language keeps an original two-sided recording desk: **Side A / your composition**, **Side B / the rat’s response**. The existing black/purple and BNB yellow remain. Note cards, score staff, four oversized keys and a recorded-take timeline replace a falling-tile piano layout.

This release maps note pitches to target positions. It does not train a music policy or simulate paws playing a physical piano. Human–rat phrase exchange and separately trained rhythm policies are future work, not shipped capabilities.

## Contract and timing

`POST /challenges` accepts `{kind: "music", title, notes, requestId}`. `notes` is exactly eight integers in 0–3; booleans, fractional values, extra fields and user-supplied target coordinates are rejected. The server derives target rectangles with X=.5, Y=[.36,.45,.54,.63], half-width=.16 and half-height=.035. Rules ID: `music-eight-v1`. Music metadata and derived targets are included in the existing rules fingerprint.

Music shares the community queue, quotas, idempotency and persistent archive described in [Community missions](COMMUNITY_MISSIONS.md). It never generates paper buyback allocations or signs a transaction.

The score preview uses an even 650ms interval. The recorded response instead derives events exclusively from successful recorded clicks, relative to `firstTargetMs`. Partial verified attempts can be heard; missing notes stay silent. The audio and displayed playback use the same AudioContext clock. Resuming schedules only events at or after the new position. Pausing, seeking, hiding the tab and unmounting cancel scheduled sound. Audio requires a user gesture.

`soft-keys-v1` is original sine-partial synthesis with no remote samples. WAV export uses the same voice envelope and recorded event timing through OfflineAudioContext, 22,050Hz mono PCM16. Export is synthesized audio based on the recorded hits, not a microphone recording. Public source uses the existing original 2D playback adapter; the hosted build adds the separately supplied 3D renderer.

## First verified take

`a9cfcf042e75987cebb8` — **Little steps · studio take**

- Score: C D E G E D C E.
- Real cloud inference: 8/8 hits, zero misses, complete, exact replay verified on its recording host.
- Hit times: 0.40, 1.64, 3.12, 4.42, 5.74, 7.08, 8.42, 9.86 seconds.
- This is an operator-created example, not evidence of community adoption.

## Validation

Store tests cover music validation, derived targets, persistence, request fingerprints and safe retries. Audio tests cover hit-only events, silent misses, seek scheduling, oscillator cancellation and PCM/WAV encoding. Recording tests reject unverified or cross-mission artifacts and retain verified partial takes. Browser checks cover composing and submitting a real task, replay controls, WAV export, remix loading and 390px mobile layout.

## First Takes extension

[First Takes](FIRST_TAKES.md) adds four behavior-derived studies, an independent reconstruction pack and a test-only on-chain archive. It is a separate route from the existing user-composed eight-note studio.

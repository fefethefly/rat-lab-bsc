# First Takes — behavioral music studies

[Listen to the collection](https://rat-lab.fun/first-takes) · [Compose your own score](https://rat-lab.fun/music?compose=1)

Four recorded targeting attempts become four short musical studies. This is **behavior sonification**, using fixed, previously trained policies and human-designed task routes. It is not an independently trained music composer or a physical piano simulation. No sale or auction is enabled.

## What is available

- Four freely playable works, with audio rebuilt and verified in the browser.
- Note-by-note links to the exact source trajectory sample, plus a synchronized magnified cursor trail and pitch display. The trail uses recorded samples, without simulated extra movement.
- WAV audio, original generated covers and shareable work links.
- A ZIP for each work containing a standalone HTML player, original renderer, score, raw cursor samples, manifest, batch plan and verification script.
- A test-only ERC-721 archive with the packed score, self-contained HTML player and SVG cover stored directly on-chain. Public testnet receipts are in `public/first-takes/testnet/deployment.json`. Use **Verify the on-chain copy** on a work page to read its player and score from the public RPC, rebuild its WAV, compare fingerprints and download the recovered player.

The mainnet token and historical launch evidence are separate and unchanged. Research candidates have no production NFT edition status. Test tokens are plainly named **RAT LAB First Takes TEST** and **RATTEST**.

## Recorded batch and selection

The first four-seed calibration batch used the same baseline route to check the pipeline. Its similar pitch contours motivated a second batch with four different routes. The published batch is `first-takes-pilot-v2`; all four predeclared attempts from that batch are retained, without selecting the best output from reruns.

Seeds: 7101, 7102, 7103, 7104. Initial delay: 2800ms; between-target settle: 960ms; target timeout: 12000ms; simulation ceiling: 30000ms. Each source file includes the exact target rectangles, actual recorded samples and the result of replay verification on its recording host. The saved plan includes the mapping-code fingerprint. This was a local prerecording plan, **not** a publicly timestamped precommitment.

The four routes vary the vertical target sequence. They influence the behavior and resulting music; there is no claim that the input environment is artistically neutral. The operator supplies titles after recording. All four runs completed 8/8 with zero misses and passed the host replay check. Inspect exact durations and timestamps in the manifests rather than treating sample playback length as task completion time.

## Mapping: trajectory-keys-v1

The source is the recorded cursor, sampled approximately every 100ms. Samples before the first target and after the final recorded task duration are excluded. Maximum source window: 30 seconds; maximum note count: 64.

- Pitch: map vertical cursor position, inverted across Y=.2–.8, into `[C3,D3,E3,G3,A3,C4,D4,E4,G4,A4,C5,D5]`, clamping at the endpoints.
- Onset: the actual sample timestamp relative to first target; trigger a changed pitch after at least 200ms, or repeat a held pitch after at least 650ms. Sampling means repeats may occur at the next available sample.
- Velocity: `35 + floor(x * 80)`, bounded to 35–115.
- Duration: `220 + floor(cursor_speed * 1200)` milliseconds, bounded to 220–750ms. Speed uses Euclidean distance per second between consecutive eligible samples; the first event uses zero speed.
- Every event stores its source sample index. No manual note substitution, tempo snapping or added harmony is applied.

A human-designed mapping is not musical intent by the model. Fixed seeds and rules are reproducible; uniqueness of an official token does not make the audio uncopyable.

## Deterministic audio and reconstruction

`src/lib/firstTakesCore.js` contains the original dependency-free mapping, binary codec, integer PCM renderer and cover generator. `integer-keys-v1` uses triangle oscillators with a simple integer filter, amplitude envelopes, a fixed pitch table, 22,050Hz mono PCM16 and a 200ms final tail. These are synthesized keys, not piano samples or microphone audio.

The integer arithmetic and quantized oscillator phases are intentional: the same events generate byte-identical WAV output. Regression tests pin a reference waveform hash. Audio fidelity is a stylized prototype; a future renderer requires a new version and must never silently change an archived work.

Packed events are 10 bytes each, big-endian: timestamp uint32, MIDI pitch uint8, duration uint16, velocity uint8, source sample index uint16. The contract stores these exact bytes. Source files, code, packed scores, WAVs and covers have separate SHA-256 fingerprints. File hashes prove consistency with a manifest, not independent origin or ownership rights.

Download a ZIP, extract it, and open `player.html`. Press **Rebuild & verify**, then Play. The player contains the score and complete synthesis code, with a Content Security Policy that disallows network requests. For a full source-to-audio check:

```sh
node verify.mjs
```

This checks the source, plan, renderer, derived events, packed score, exact WAV and generated cover. Node 18+ is sufficient; no npm install is needed inside the pack. No upstream model weights, renderer, skins or 3D assets are distributed in the archive.

## Test-only archive contract

Source: `contracts/first-takes/FirstTakesTestnet.sol`. Solidity 0.8.30, optimizer 200, via IR, Paris EVM. Based on OpenZeppelin ERC-721. The constructor rejects all chains except BSC testnet (97) and local development (31337).

- Immutable issuer; issuer-only archival issuance.
- At most 16 test tokens in this contract; duplicate source hashes rejected.
- Packed score SHA-256 checked during issuance.
- Self-contained player and cover stored as immutable runtime bytecode in small data contracts.
- `tokenURI` assembles a data URI with an embedded SVG image and HTML animation; `scoreData`, `playerHTML` and `coverSVG` expose the underlying data independently.
- No payable methods, auction, resale royalties, buyback, external signer or upgrade interface.
- ERC-721 tokens retain standard transfers. No financial rights or copyright transfer are implied.

The contract preserves what the issuer submits. It does not validate the neural computation, independently verify the archived raw source, or prove that the submitted HTML implements the claimed mapping. Inspection and retrieval tests connect this deployment to the published files. It has not received an independent security audit. The contract's cap applies only to this contract; another contract can copy the data.

Testnet chains can be reset and marketplace support for embedded audio/HTML varies. This demonstration therefore **does not promise permanent storage** or marketplace playback. A paid production edition would require confirmed model/material rights, independent contract review, explicit licenses and reliable archival arrangements. Current upstream permission uncertainty remains described in `THIRD_PARTY.md`.

## Development and verification

```sh
npm ci
node scripts/first-takes/compile.mjs
node --test tests/*.test.mjs
npm run build:public
```

Local contract tests use two local Anvil instances: chain 31337 on port 18545, and chain 56 on port 18546 to verify constructor rejection without touching mainnet. Then run `node scripts/first-takes/test-contract.mjs`. Results are recorded in `public/first-takes/testnet/local-verification.json` and explicitly labelled local.

`scripts/first-takes/record.py` requires separately obtained compatible neural runtime and weights. Saved source records are sufficient to reconstruct the published music without those dependencies. `scripts/first-takes/build.mjs` expects the private recording folder and never reads wallet data. To inspect the public release, use the included per-work verification scripts instead.

Public chain retrieval should use `scripts/first-takes/recover-chain.mjs`: it requires no private key and verifies recovered data against the published fingerprints. The operator deploy script is intentionally not included in the public source distribution because it is tied to a private local signer configuration. ABI and bytecode are public for inspection.

## Next release gate

Collect qualitative listening feedback and actual repeat listening before deciding whether to run a paid edition. This prototype does not invent community demand, collector counts, auction prices or independent audit status. Resolve upstream commercial-use rights and conduct an independent review before a real-money auction. A separate music policy, human–rat duet and auction protocol remain future work.

## Confirmed public testnet deployment

- Contract: [0x07e83867b88e190651e0cb1f123159a33e39804d](https://testnet.bscscan.com/address/0x07e83867b88e190651e0cb1f123159a33e39804d).
- Chain: BSC testnet, 97. Tokens 1–4 belong to the operator-designated test wallet.
- Deployment plus four issuances: 0.001733449167783403 tBNB in gas. No mainnet issuance or spending.
- Four complete players, scores and covers were recovered from contract reads; regenerated WAV fingerprints all matched. `recovery.json` records the operator-run check, not an independent audit.

## Listening room v2

The collection now links to `public/first-takes/listen-v2/take-01.html` (and the other three works). Each self-contained HTML embeds the **unchanged original renderer and score**, verifies both the score and exact WAV hashes, and uses Web Audio with custom Play/Pause, restart and seek controls. Seeking pauses; press Play to continue. Hidden pages pause automatically, and playback only begins after a user gesture. A verified WAV download is available even if the playback API cannot start.

Use **Save offline player** to keep the compatibility HTML separately. It is an **off-chain listening client**, not newly minted content. The original `player.html`, ZIP, work index, contracts and all archived fingerprints remain unchanged. The chain-recovery button deliberately downloads the original on-chain player. `listen-v2/index.json` records separate client hashes and the corresponding original player, score and WAV hashes.

Regenerate these clients from public records with:

```sh
node scripts/first-takes/build-compatible.mjs
node --test --test-concurrency=1 tests/*.test.mjs
```

Transport tests cover resume/pause/seek offsets, end-of-recording replay, interrupted pending playback, disposal and overlapping Play requests. Archive regression checks also confirm the compatibility release has not changed the original ZIPs or players.

## Browser validation boundary

The hosted collection's custom Play/Pause, seeking, work switching, note trace and direct-chain recovery were exercised in the Codex in-app browser, including a 390px viewport. The standalone page successfully rebuilt its WAV and verified the exact fingerprints. A subsequent attempt to operate its native audio control caused that browser tab to crash; the cause has not been established. The new v2 client avoids native audio controls and has passed hosted playback, pause, seeking and restart checks in the in-app browser. Downloaded-file playback in other browsers still needs a wider compatibility check. This does not invalidate the byte-for-byte WAV reconstruction checks, and the hosted custom player remains the tested listening path.

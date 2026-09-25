# 当前架构：Flap 迁移

2026-09-25 起当前发行路径为 server/flap.py → Flap Portal.newTokenV6，计划 schemaVersion=3。server/flap_prepare.py 提供无密钥准备/模拟命令，server/autolaunch.py 执行 rat、重放、最新预检及单笔签名。Four 网页端点已停用（410），新发行拒绝旧 v2 计划。旧底层代码仅保留历史验证用途。操作与验证以 MAINNET.md、FLAP_VALIDATION.md 为准。

Flap 元数据上传到官方 IPFS 服务后逐项回读，图片 SHA-256 必须一致。新计划编码可直接解码核对税率、受益人、预买、期限、迁移和扩展设置。CREATE2 地址仅是预测，收据核验前不会当作已发行合约展示。

以下为 Four 版历史架构记录：

# Architecture

React + TypeScript + Vite serves the public-facing lab UI. A local FastAPI control plane hosts the neural runtime, owns mutable run state, stores artifacts and proxies the documented Four.meme flow. `server/autolaunch.py` is an independent operator-only signer; the web server never imports any key.

```text
Form / operator manifest
       │
       ├── DRY ──────────────────────────────┐
       └── MAINNET → Four.meme auth/image/prepare → pinned plan
                                             │
                              MuJoCo + two upstream PPO policies
                              cue → head motion → physical paw press
                                             │
                                      eight verified hits
                                             │
                    ┌────────────────────────┴──────────────────┐
               web wallet path                         terminal autonomous path
        fresh simulate → owner wallet             approval digest → neural run → replay
        receipt + TokenCreate verification         fresh simulate → budget → one signature
                                                   fsync journal → broadcast → receipt
```

## Fidelity and deliberate changes

The reference is a black scientific lab with sticky navigation, large identity hero, live/replay 3D chamber, telemetry, model explanations, launch steps and proof. We retained the real chamber renderer, simulation model, skin and brain. The new UI uses a quieter BSC gold palette, local fonts, four functional tabs, a token setup dialog, local run log and mobile layouts. The upstream 11 pons-specific steps are replaced with eight targets for a custom virtual control surface. This is API-based Four.meme integration, not browser automation of Four.meme.

The mainnet plan is prepared by the operator before the neural run. Rat hits gate eligibility to sign that exact plan. Metadata entry/upload is handled by the rig, not linguistic intelligence in the rat. This preserves an honest boundary between learned motor actions and deterministic software actions.

## Data

`data/bsc_*/manifest.json`, `events.jsonl`, `session.json`, `actions.npy`, `qpos.npy`, `result.json`; mainnet sessions additionally get `plan.json`, and verified web wallet launches get `receipt.json`. Brain and session commits use the upstream canonical algorithm. Event JSON and virtual surface mapping are additional rig artifacts; they are not part of the upstream physics proof. `data/latest.json` points to the latest completed local run for recovery. Partial runs interrupted by a process crash are not labeled complete.

## Explicit limitations

- Mainnet API authentication/creation has not been executed in this environment: Four.meme's configuration endpoint returns HTTP 403 with an explicit location restriction on this host.
- The official create API returns opaque `createArg` plus signature. We pin byte-for-byte calldata and validate the outer ABI/contract/chain/value, but do not claim complete independent semantic decoding of proprietary inner args. Receipt metadata and two canonical confirmations are checked for both signing paths; tax state is not yet independently verified.
- This is a local, single-operator service, not a hosted multi-tenant wallet service. Read/write guards reject foreign Host and Origin, write operations require a session token, and websockets only allow local origins.
- Web wallet keys never enter Python. The separate autonomous CLI unlocks an encrypted keystore using a hidden local password prompt, or reads an explicitly selected private env file outside the repository with owner-only permissions and journals one raw transaction before broadcast. The CLI is not a public server endpoint.
- Separate signing paths must not be armed for the same plan simultaneously. The CLI's exclusive wallet reservation and journal prevent a second CLI use; the HTTP transaction endpoint refuses a wallet reserved by that runner; browser storage prevents repeated wallet submission in that browser. There is no cross-device distributed transaction lock.
- The independent terminal runner does not currently publish to the browser's websocket. Its status and evidence are terminal/filesystem outputs.
- Dry rehearsal on a BSC-targeted control surface is not an on-chain testnet deployment.

## Upgrades to make before a public launch

Resolve upstream redistribution rights; verify Four.meme's current endpoint/config behavior from the actual launch host; run an end-to-end mainnet preparation with the intended creator wallet; have an operator approve the real payload/fee budget; pin the exact deployment artifact; use a separate sanitized public spectator relay rather than exposing the owner control plane.

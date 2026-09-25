# Community missions / 社区出题

## 产品方向

RAT LAB 的首页主张改为 **You set the test. The rat makes its move.** 用户来这里能够留下自己的题目、一次真实尝试和可继续创作的链接。黑紫底色与 BNB 黄保持不变，辨识度来自原创关卡、实验档案和创作者行为。

本次交付：

- 首页采用任务工作台、路线草图、编号目标与实验档案票据。原有发币机制与链上证据保留在 Origin study / Evidence。
- `/create`：Switchback、Staircase、Return trip 三个可编辑模板。拖动目标或用键盘操作滑块，调整位置与尺寸。
- 提交后运行真实的固定策略推理；保存标题、规则、规则指纹、结果、点击时间和身体姿态。没有重新训练模型。
- `/challenge?id=…`：固定关卡链接、排队状态、完成/失败记录。只有完整且回放校验通过的八目标尝试可以成为对手。
- 同步回放与逐目标分段比较；Remix 继承原题并创建新关卡，不修改原档案。
- 不将社区标题自动列为官方精选；人类成绩仅保存在本机，不伪装为可信排行榜。

## 接下来如何建立优势

1. **让用户愿意再出一道题。** 先观察提交成功率、完整尝试率和 Remix 的实际使用，收集第一批真实反馈。当前没有伪造访问量或社区成绩。
2. **建立自己的公开题库。** 人工筛选具有特点的任务，区分易完成、极限任务和失败案例，发布同一规则下可复现的记录。做精选与作者归属前，补齐身份确认、审核和滥用处理。
3. **发展模型版本对比。** 在有独立训练与可靠复现之后，让同一关卡对比多个固定检查点。公开训练来源、规则、版本和失败案例；当前版本不宣称具备这项能力。
4. **把实验变成可传播内容。** 从真实记录生成带关卡链接、路径与关键失误的结果卡/短片。分享应能回到可复现的题目，而非只有一张宣传图。

## Service contract

`POST /challenges` accepts only `{title, targets, requestId}`. Titles are 3–48 characters; eight target rectangles use normalized center X `.42–.58`, Y `.35–.64`, half-width `.14–.20`, half-height `.035–.055`. All inputs must be finite numbers. Payloads are limited to 4 KiB, including chunked bodies. No URLs, code, files or financial parameters are accepted.

A request ID is idempotent across retries; reusing it with a different design returns 409. The beta admits at most four queued/running missions, three submissions per network per hour, 24 per rolling day and 500 archived missions. Global limits also apply to clients using different network addresses. Capacity errors leave existing missions intact. Network limiting is a lightweight supplementary control, not an identity system.

`GET /challenges/{id}` returns public design/state/result only. `GET /challenges/{id}/poses.json` and `poses.bin` expose that attempt's replay artifacts. The frontend binds an opponent to these exact mission paths on its configured observer; arbitrary external replay URLs are rejected.

One worker prioritizes queued community attempts between scheduled observations. Attempts use seed 2026, a 2.8s initial delay, 0.96s between hits, 12s per target and a 60s total simulation limit. The paired human round enforces the same target timeout and remaining total time. Controls and clock sources still differ; results are local practice, not a scientific comparison or verified leaderboard. Community attempts never enter the paper buyback ledger.

SQLite on the Railway `/data` volume stores designs, status and paired artifacts. Completed links survive restarts. A running attempt interrupted by restart is explicitly marked `interrupted`; it is never silently rerun. Queued missions remain queued. Stop the service before copying the database for backup; one replica only. A volume is persistence, not an independent backup.

## Validation

- Switchback completed locally and on the cloud worker: **8/8 hits, zero misses, 9.48s**, exact replay verified on each host.
- Published example: [Switchback · first field test](https://rat-lab.fun/challenge?id=179496b7c965372effc4).
- Browser: submission → saved link → verified 3D playback → complete eight-target race; mobile viewport 390 px, all eight split times present. Automated browser score was cleared.
- The production worker was restarted after the first mission; its saved result and paired replay remained available, with matching pose hashes.
- Store/API tests cover malformed numbers, request size, CORS, idempotent retries, conflicting requests, queue ordering, global limits, restart recovery and failed verification.
- Neural source/weights retain the upstream provenance described in `THIRD_PARTY.md`; this work adds original tasks and product behavior, not a claim of an original neural model.

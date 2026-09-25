# Flap 迁移验证 · 2026-09-25

- 真实 BSC Portal：v5.24.0。链 56，代码存在，Tax V3 实现代码存在。
- 官方通用示例 TWO_THIRDS 回退 InvalidDexThresholdType(0)，按官方 BNB construct-tx 指引改为 FOUR_FIFTHS(1) 后成功。
- 原生 BNB、预买 0、msg.value 0。真实 eth_call 返回匹配的 CREATE2 7777 预测地址，eth_estimateGas 成功。
- 预计 gas limit 6,926,201（125%），gasPrice 50,000,000 wei，费用上限估计 0.00034631005 BNB。没有用户预算授权，未生成可授权计划。
- 官方上传接口成功；metadata CID：`bafkreieen6w7ejjkxml4reegco6vid4lbkol2yut3w7noooay2n6vsa7pu`。逐项回读描述、创建者和社交链接，头像 SHA-256 相同。上传端将空社交字段 null 规范化为空字符串，校验仅对这些空字段接受该等价表示。
- Python eth_abi 编码与独立 viem 解码/再编码完全一致；buyTaxRate=200、sellTaxRate=200、quoteAmt=0。
- 新神经会话：`bsc_20260925T163308_b46b6e`，8/8 命中；重放 MATCH，frames_identical/commit_ok/clicks_ok 全为 true。
- 神经证明：`0aa0dcf5536c9f92c66e730e57562b3385f819b92ff7f50a66c1b9f4730e4e8a`。
- npm test：39 项，包括 Flap 参数篡改、零预买、税率/事件核验、升级阻断，以及使用 Flap 计划的单笔签名故障恢复 mock 测试。
- npm run build：通过；Three.js 包体积提示仍存在。
- 浏览器：Flap 外链、2%/2%、零预买、受益钱包、税期、空预算与主网启动禁用状态可见；完成真实演练。

未读取或检查用户私钥文件内容。未签名、未广播、未发币、未部署域名。公开 IPFS 素材上传是本次唯一外部发布；没有发布 X 帖子。

原始只读报告：data/flap-mainnet-simulation.json、data/flap-readiness.json。签名器不能使用模拟报告。预算与参数最终复核后须新建有效期内的 v3 计划。

## 0.02 BNB 预算与发布门禁

用户随后明确授权 0.02 BNB；新 Flap v3 计划生成并模拟成功。新增 server.publish 的收据/神经证明门禁与静态白名单导出；npm test 40 项通过，操作者与 public 两种构建通过。静态产物搜索不含 eth_sendTransaction、personal_sign、/api/flap、/ws/live。浏览器验证缺少真实 release.json 时不会展示已发行或虚构合约。Vercel rat-lab 项目创建成功，尚未进行生产部署或域名绑定。

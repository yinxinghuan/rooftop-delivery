# 项目记录：Rooftop Delivery

## 基本信息

- 中文名：天台速递
- 本地目录：`/Users/yin/code/games/rooftop-delivery`
- 创建日期：2026-07-10
- 当前状态：已发布并注册，等待同事迁移工具把最新 `games.json` 入库
- 独立仓库：`https://github.com/yinxinghuan/rooftop-delivery`
- 游玩地址：`https://yinxinghuan.github.io/rooftop-delivery/`
- Remix 源码包：`https://github.com/yinxinghuan/rooftop-delivery/archive/refs/heads/master.zip`
- 游戏类型：手机竖屏 3D 弹道投掷 / 风向判断 / 精准落点
- 永久 UUID：`3ecbe73c-4354-438b-8a30-f523370c0324`
- 最高分键：`rooftop_delivery_best`

## 核心玩法

玩家在黄昏城市屋顶向远处投递 8 件包裹。向上拖动决定力度，左右拖动决定横向初速度；每轮侧风会持续推偏包裹，18 个预测点显示包含风力后的弹道。包裹落在目标中心、中圈或普通屋顶分别获得 100、60、25 基础分，连续成功形成 combo，累计 3 次坠楼提前结束。

## 技术与视觉

- Vite 6 + 原生 JavaScript + Three.js 0.180 + CSS。
- 城市、屋顶设施、包裹、目标环、风带、云层和纸屑全部程序生成。
- Web Audio API 合成音效，轻量 `zh` / `en` i18n，`base: './'`。
- 视觉方向为“航空邮政 × 黄昏模型城市”，主色为珊瑚红、纸张米白、风带青和深紫暮色。
- 当前 `public/poster.png` 是用户明确选定的 Codex 原型海报，属于本项目的人工选稿例外。
- 后续制作期海报仍必须使用 `gen_poster.py` 所记录的 Aigram transit 标准：`POST https://chat.aiwaves.tech/aigram/api/gen-image`，携带 `Origin: https://aigram.app`，保留 3 次重试；标题后处理只保留主标题。

## 已验证

- `npm run build` 通过。
- 390 × 720 无头 Chromium 检查无控制台错误。
- 已实际验证开始页、1.5 秒缓冲、Pointer 拖投、弹道预测、屋顶送达计分、下一件生成和 3 次坠楼结算。
- `doc/requirements.md` 六节齐全，`doc/technical.md` 四节齐全。
- `public/poster.png` 与 `dist/poster.png` 均为 1024 × 1024。

## 上线记录

1. 2026-07-10 创建独立公开仓库并推送 `master`。
2. 启用 GitHub Pages workflow，部署运行 `29088526999` 成功。
3. 线上 HTML 返回 `assets/index-C6r3kzyD.js`，bundle 已检出 `rooftop_delivery_best`，证明不是只完成 push。
4. `games/games.json` 条目位于数组第一位，分类为 `action`；中心海报为 `posters/rooftop-delivery.png`。
5. 平台列表仍需要同事重跑迁移工具，客户端才会从平台 DB 读到新条目。

## 后续待办

1. 邀请真实玩家测试近、中、远三档力度和强侧风命中率，调整弹道数值。
2. 决定是否抽取为“一句话造游戏”的 3D projectile cartridge；母模板不得直接承担独立游戏发布。
3. 如接排行榜，按 `game-persistence` 接入分数提交、榜单、冠军入口和 `score_beat` 通知。

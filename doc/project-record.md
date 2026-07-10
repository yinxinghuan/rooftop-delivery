# 项目记录：Rooftop Delivery

## 基本信息

- 中文名：天台速递
- 本地目录：`/Users/yin/code/games/rooftop-delivery`
- 创建日期：2026-07-10
- 当前状态：已发布、已注册并已在平台列表可见；六关主题、动物干扰与大胆邮政字阶均已上线
- 独立仓库：`https://github.com/yinxinghuan/rooftop-delivery`
- 游玩地址：`https://yinxinghuan.github.io/rooftop-delivery/`
- Remix 源码包：`https://github.com/yinxinghuan/rooftop-delivery/archive/refs/heads/master.zip`
- 游戏类型：手机竖屏 3D 弹道投掷 / 顺序闯关 / 风向判断 / 精准落点
- 永久 UUID：`3ecbe73c-4354-438b-8a30-f523370c0324`
- 最高分键：`rooftop_delivery_best`

## 核心玩法

玩家沿 6 条顺序解锁的黄昏城市路线投递包裹。向上拖动决定力度，左右拖动决定横向初速度；每轮侧风会持续推偏包裹，18 个预测点显示包含风力后的弹道。关卡逐步加入强侧风、窄目标、移动地址、单次失误上限和复合任务；只有完成当前路线的全部目标才解锁下一关。

## 技术与视觉

- Vite 6 + 原生 JavaScript + Three.js 0.180 + CSS。
- 城市、屋顶设施、包裹、目标环、风带、云层和纸屑全部程序生成。
- Web Audio API 合成音效，轻量 `zh` / `en` i18n，`base: './'`。
- 视觉方向为“航空邮政 × 黄昏模型城市”，主色为珊瑚红、纸张米白、风带青和深紫暮色。
- 2026-07-10 UI 升级后，放弃撞色方向，界面改用包裹同款珊瑚橘 `#F05D4E`、深墨紫和纸张米白，与黄昏场景保持统一；开场改为全场景点击开始和单一向上拖动手势引导。
- 已按最新版 `game-persistence` 接入永久 UUID 排行榜、冠军入口、完整榜单、跨用户头像与主页跳转、站外下载态、分数提交和单目标 `score_beat` 通知。
- 2026-07-10 玩法扩展为 6 条顺序路线：屋顶入门、侧风街区、狭窄落点、移动地址、易碎快件和天际终局。每关具有固定包裹数、失误上限、风力、目标尺寸 / 移动与任务门槛；失败只允许重试，不解锁下一关。
- 路线进度保存在 `rooftop_delivery_progress_v1`，已解锁关卡可通过路线地图回玩；路线卡位于可滚动列表并使用 Click，避免触摸滑动误选。
- 六关现拥有独立场景布置与箱子皮肤；路线 2 / 3 / 5 分别加入共享低多边形资产库的猫、狗、鸡，路线 6 同时加入猫和狗。动物沿可见虚线路径巡逻，碰撞只改变弹道，每次投掷最多触发一次。
- 为保证独立仓库可移植，动物 builders 从 `_lowpoly_lab` 移植到游戏源码，不在发布构建中引用工作区外部路径或 GLB。
- UI 字体升级为超粗压缩邮政字阶：Impact / Arial Black 展示标题与数字，压缩粗体承载任务和按钮，等宽字只保留在路线编号与微状态；中文自动回退到 PingFang SC 粗黑并取消英文式字距。
- 当前 `public/poster.png` 是用户明确选定的 Codex 原型海报，属于本项目的人工选稿例外。
- 后续制作期海报仍必须使用 `gen_poster.py` 所记录的 Aigram transit 标准：`POST https://chat.aiwaves.tech/aigram/api/gen-image`，携带 `Origin: https://aigram.app`，保留 3 次重试；标题后处理只保留主标题。

## 已验证

- `npm run build` 通过。
- 390 × 844 无头 Chromium 检查开始页、统一邮政色板 HUD、站外下载态和真实榜单模拟数据均正常。
- 模拟榜单验证 3 行数据、长用户名省略、自身行状态和其他玩家主页点击；点击第一名正确调用 `openAigramProfile('other-1')`。
- 多关卡自动化验证初始 6 卡 / 5 锁、第一关 4 件包裹、两次失误立即失败、“重试本关”按钮和进度不写入；预置全解锁进度后可选择第四关并正确加载 6 件与 300 分目标。
- 六关通过判定均做边界测试：达到全部目标时通过，送达 / 中心命中 / 分数任一低 1 均失败。
- 逐关 390 × 844 截图验证晾衣天台 / 猫 / 蓝箱、花园 / 狗 / 绿箱、霓虹设备 / 紫箱、温室 / 鸡 / 易碎箱、信标 / 猫狗 / 墨金箱；动物冲量纯函数覆盖所有配置并验证横向、抬升和纵深衰减。
- 390 × 844 英文路线地图、HUD、失败结算与中文开始页 / 路线地图均验证新字阶无溢出；640px 矮屏结算高度 504px，无滚动溢出。
- 已实际验证开始页、1.5 秒缓冲、Pointer 拖投、弹道预测、屋顶送达计分、下一件生成、关卡失误上限和任务结算。
- `doc/requirements.md` 六节齐全，`doc/technical.md` 四节齐全。
- `public/poster.png` 与 `dist/poster.png` 均为 1024 × 1024。

## 上线记录

1. 2026-07-10 创建独立公开仓库并推送 `master`。
2. 启用 GitHub Pages workflow，部署运行 `29088526999` 成功。
3. 线上 HTML 返回 `assets/index-C6r3kzyD.js`，bundle 已检出 `rooftop_delivery_best`，证明不是只完成 push。
4. `games/games.json` 条目位于数组第一位，分类为 `action`；中心海报为 `posters/rooftop-delivery.png`。
5. 同事已重跑迁移工具，用户确认平台列表可见该游戏。
6. 六关路线版本提交 `6490bdc`，GitHub Pages 部署运行 `29090914484` 成功；线上 bundle `index-BP_v6cAC.js` 已检出 `rooftop_delivery_progress_v1`、`SKYLINE FINALE`、`RETRY ROUTE` 和移动目标配置。
7. 主题场景与动物版本提交 `581d921`，GitHub Pages 部署运行 `29091829210` 成功；线上 bundle `index-DbPdyuwa.js` 已检出猫狗巡逻、鸡碰撞台词、`ANIMAL INTERFERENCE`、温室场景和 `FRAGILE` / `FINAL / 06` 箱子皮肤。
8. 字体版本提交 `5a3a876`，GitHub Pages 部署运行 `29092621276` 成功；线上 CSS `index-BQbljl_5.css` 已检出 display / condensed / mono 三层字体 token、Impact 展示字和 23px / 40px 关键字阶。

## 后续待办

1. 邀请真实玩家测试近、中、远三档力度和强侧风命中率，调整弹道数值。
2. 决定是否抽取为“一句话造游戏”的 3D projectile cartridge；母模板不得直接承担独立游戏发布。

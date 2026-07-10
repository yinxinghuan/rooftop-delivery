# Technical

## 1. 技术栈

Rooftop Delivery 是独立的 Vite 6 工程，使用原生 JavaScript、Three.js 0.180 和 CSS 实现。3D 渲染使用 `WebGLRenderer`、透视相机、雾、标准材质、基础材质、软阴影和 ACES Filmic 色调映射；建筑、包裹、目标环、云层、风带、弹道点与纸屑均由运行时几何体生成，不依赖外部模型或图片素材。

游戏物理使用固定参数的轻量弹道积分，不引入额外物理引擎。音效由 Web Audio API 动态合成；中英文使用项目内轻量 i18n，根据 `localStorage.game_locale` 或浏览器语言选择。最高分保存在 `localStorage.rooftop_delivery_best`。平台排行榜通过 vanilla Aigram bridge 调用 rank API，超越通知通过 `record/play` 的 `score_beat` 事件发送。Vite 构建固定使用 `base: './'`，资源可在任意部署子路径加载。

游戏永久 UUID 为 `3ecbe73c-4354-438b-8a30-f523370c0324`，写在 `index.html` 的 `<meta name="game-uuid">` 中，并已注册到中心 `games/games.json`。独立仓库为 `yinxinghuan/rooftop-delivery`，GitHub Pages 地址为 `https://yinxinghuan.github.io/rooftop-delivery/`。

## 2. 目录结构

- `index.html`：三态界面、HUD、手势引导、风力标签、瞄准力度条、缓冲提示、冠军入口、排行榜弹层、结算单、平台水印和游戏 UUID。
- `src/main.js`：Three.js 场景、程序化城市、投掷输入、弹道预测、物理更新、落点判断、计分、combo、反馈与三态切换。
- `src/styles.css`：以深海军蓝、高饱和钴蓝和暖白为 UI 专属撞色色板的移动端布局、HUD、手势引导、榜单、结算单、动画、触控状态与 reduced-motion 适配。
- `src/leaderboard.js`：榜单读取和标准化、冠军入口、跨用户头像与主页跳转、站外下载态、成绩提交、局前纪录快照与单目标 `score_beat` 通知。
- `src/i18n.js`：`zh` / `en` 文案、语言检测、DOM 文案注入和随机快递员台词。
- `src/sounds.js`：Web Audio API 音色封装，覆盖开始、瞄准、发射、弹跳、送达、中心命中、连击、失误和结算。
- `public/img/aigram.svg`：Aigram 平台水印。
- `public/aigram-bridge.js`：vanilla 游戏平台桥，兼容 iframe / Android `postMessage` 和 iOS WKWebView，用于排行榜、通知与主页跳转。
- `public/poster.svg`：首版 1024 × 1024 矢量封面源稿，保留作构图参考。
- `_poster_platform_raw.png`：Aigram 平台 transit `gen-image` 返回并裁切到 1024 × 1024 的无字主视觉。
- `public/poster.png`：本次由用户明确选定的 Codex 原型海报，缩放为 1024 × 1024；这是当前项目的人工选稿例外。
- `gen_poster.py`：制作期海报脚本，调用 `https://chat.aiwaves.tech/aigram/api/gen-image`，携带平台要求的 `Origin`，保留 3 次重试，并用 Pillow 合成准确标题。
- `doc/requirements.md`：最终玩法与视觉数值蓝图。
- `doc/technical.md`：最终实现说明。
- `meta.json`：平台标题和 `/poster.png` 封面路径。
- `vite.config.js`：Vite 构建配置，`base` 固定为 `./`。

## 3. 核心模块

状态集中在 `src/main.js` 的 `state` 对象中，以 `isPlaying` 和 `isGameOver` 维护开始、游戏中、结算三个互斥状态。每局初始化 8 件包裹、3 次失误额度、分数、combo、中心连续命中和统计数据；`showScreen()` 统一切换 DOM 屏幕，最高分只在 `endGame()` 中写入本地存储。开始页本身使用 Pointer Down 进入游戏，冠军入口在处理器中阻止冒泡，因此打开榜单不会误开局。

Three.js 场景由 `makeBuilding()`、`addBackgroundCity()`、`addRoofDetails()`、`createPackage()`、`createTarget()`、`createWindStreaks()` 和 `addClouds()` 生成。相机固定在前景屋顶后上方，目标屋顶、远景楼群与街谷形成纵深。大型楼体不加入阴影贴图，避免移动 GPU 上出现整块不稳定阴影；包裹和屋顶设施保留动态阴影。

输入由游戏层的 Pointer 事件统一处理。`beginAim()` 记录起点，`moveAim()` 把向上距离和横向距离转换为力度与方向，`updateAimVisuals()` 用与实际物理相同的重力和风力生成 18 个预测点，`releaseAim()` 在拖动超过 24px 后调用 `launchPackage()`。桌面端还支持 Space 蓄力、左右方向键瞄准、R 重开和 Escape 返回。

主循环使用 `requestAnimationFrame`，单帧 `dt` 最大截断到 33ms。`updatePackage()` 叠加重力与侧风、更新位移和旋转、检测目标屋顶、处理最多 2 次弹跳，并在首次接触 1,100ms 后结算。落点与目标中心的平面距离决定 100 / 60 / 25 分；低于世界高度 -7 判定坠楼。前三次中心连续命中追加 100 分，成功投递维护 combo，失误清零。

反馈由 DOM 与 3D 两层组成：`popScore()` 显示上飘分数，`showBubble()` 输出随机台词，`showCombo()` 展示连击标签；`burstParticles()` 和 `spawnTrailParticle()` 生成纸屑，目标环在中心命中时扩张。`src/sounds.js` 通过振荡器和增益包络合成全部音效，第一次开始或瞄准时恢复 AudioContext。

响应式由 `.rd-shell` 的 `100dvh` 和最大 520px 宽度控制，`resize()` 同步渲染器尺寸与相机宽高比。390 × 720 为主要验证尺寸，桌面宽屏显示圆角设备舞台。界面支持 `prefers-reduced-motion`，用户可见文案全部通过 `t()` 或 `line()` 输出。

`src/leaderboard.js` 在初始化时读取按 UUID 隔离的排行榜，并把第一名渲染到冠军入口。榜单行使用 `minmax(0, 1fr)` 和 `min-width: 0` 保护长用户名；其他玩家的头像和姓名行使用 Click 打开 `openAigramProfile()`，自身行只显示“你”。站外环境不调用平台接口，改为渲染 `https://alteru.app` 下载入口。每局开始由 `snapshotPreRunBest()` 记录平台旧最高分；结算先保存分数，再刷新榜单，筛选 `旧最高分 < 对手分数 < 本局分数` 的最高一名对手并发送一次带海报的 `score_beat` 通知，所有网络失败均静默处理。

## 4. 扩展点

- 调投掷手感：修改 `src/main.js` 的 `GRAVITY`、`velocityFromAim()`、横向速度映射、风力范围和 `LANDING_Y`。
- 调关卡长度与容错：修改 `TOTAL_PARCELS`、`MAX_MISSES`、`GRACE_MS`，并同步 `doc/requirements.md`。
- 调目标与计分：修改 `setTarget()` 的坐标范围、`evaluateLanding()` 的 0.85 / 1.7 半径，以及 `resolveDelivery()` 的 100 / 60 / 25 分和 combo 奖励。
- 调弹跳：修改 `updatePackage()` 的 22% 竖直保留、62% 水平保留、最大弹跳次数与 1,100ms 结算等待。
- 换城市视觉：修改 `makeBuilding()`、`addBackgroundCity()`、`addRoofDetails()` 的几何体、材质和灯光，并在 `src/styles.css` 同步天空、邮政标签和 HUD 色值。
- 改文案与语言：修改 `src/i18n.js` 的 `dictionaries`，不要在 HTML 或主循环里新增硬编码用户文案。
- 调音效：修改 `src/sounds.js` 中各事件的波形、频率、时长、延迟和增益。
- 调 UI 与场景反差：修改 `src/styles.css` 的 `--ui-night`、`--ui-pop`、`--ui-white` 和 `--ui-muted`；这些变量只服务界面，不修改 Three.js 场景色板。
- 调排行榜：修改 `src/leaderboard.js` 的榜单渲染、通知文案、海报 URL 和分数单位；不得改动永久 UUID，也不要简化 `public/aigram-bridge.js` 的平台信封协议。
- 换封面：后续默认修改 `gen_poster.py` 的 `PROMPT` 并重新运行，主视觉必须走 Aigram transit `gen-image`，标题由 Pillow 本地合成且只保留主标题；当前 Codex 版本仅因用户明确选稿而保留。保持 `meta.json.cover_url` 为 `/poster.png`。
- 接平台存档或其他社交功能：复用当前永久 UUID 与 `public/aigram-bridge.js`；排行榜已接入，共享墙与服务器存档尚未接入。

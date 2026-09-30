# Rooftop Delivery — Crazy Games 第三轮审图修正

## 本轮范围

- 分支：`cursor/crazygames-guest-7e22`
- 起点：`31e9daf`
- 只修改 Crazy Games 隔离代码、QA 与文档；没有修改宿主运行代码，没有重写抛掷结算。
- 10 条固定路线、七步教学、八项升级与夜间合约全部保留；没有新增路线、广告、内购或账号。

## 恢复成立的街道空间

本轮恢复 `fa376ab` 的相机、街道宽度和连续街景：玩家屋顶仍在近处，目标屋顶固定在街对面，左右楼体按原坐标公式各 11 栋连续排布。六景统一断言 `gap=4`、`streetWidth=8`、`skylineCount=22`，不再把目标屋顶推远，也没有单独悬空的楼。

## 六类建筑，而非六套染色

公共楼体生成器现在按高度生成楼层线、成组窗户、窗框、立面边柱和可见女儿墙；场景差异由六个穷举建筑族叠加：

| 场景 | 建筑族 | 800×450 静帧识别物 |
|---|---|---|
| depot | warehouse | 暖灰黄昏、仓库装卸门/雨棚、货箱和装卸牌 |
| laundry | residential | 饱和住宅排楼、外挑阳台、彩色晾衣 |
| garden | courtyard | 低层土色楼、屋顶庭院边界、连续花箱和植株 |
| neon | sign-tower | 深靛夜空、青粉灯带/窗光、可读 `NIGHT POST` 发光招牌 |
| glasshouse | glassworks | 冷蓝楼体、成排透明玻璃棚和框架 |
| beacon | harbor | 深海军楼体、竖向港区构件、暖窗、灯塔与扫光 |

所有建筑、街道、招牌、灯光和装饰继续只用 Three.js 程序化几何或运行时 CanvasTexture，没有下载模型或图片。

## 既有特殊规则保持

- Route 6 / 9 / 10：翻风静帧改在 180ms 权威风提交后拍摄。旗帜以旗杆为原点左右翻面，HUD 箭头使用相同符号；三关均自动断言 `wind = HUD = flag`，且仍只翻转一次。
- Route 7：裂纹同时放在箱体朝相机的正面和顶面；`Fragile crate cracked` 浮字下移到前景屋顶，不再遮住远端箱体。普通垫圈仍回归为 `misses=1`、`delivered=0`。

## 800×450 最终截图

六个场景的截图在 QA harness 中隐藏 HUD，直接验证只看街景仍能辨认：

- `_qa/ui/crazygames-scenes/800x450-depot.png`
- `_qa/ui/crazygames-scenes/800x450-laundry.png`
- `_qa/ui/crazygames-scenes/800x450-garden.png`
- `_qa/ui/crazygames-scenes/800x450-neon.png`
- `_qa/ui/crazygames-scenes/800x450-glasshouse.png`
- `_qa/ui/crazygames-scenes/800x450-beacon.png`
- 风向翻转：`_qa/ui/crazygames-final/800x450-wind-flip.png`
- 易碎箱裂开：`_qa/ui/crazygames-final/800x450-fragile.png`

机器可读断言：`_qa/crazygames-review.json`。

## 验证结果

- `npm test`：通过；固定路线仍为 10，夜间合约仍只轮换六个现成场景，10 条路线均有非 miss 规划落点。
- Chromium 800×450：六景及两项反馈图无溢出、页面异常或控制台错误。
- 六景共享已恢复的连续街道骨架；六个建筑族与建筑主色均唯一，差异来自可见结构而非移动楼距或只换色。
- Route 6 / 9 / 10：翻转完成后权威风、HUD 箭头和旗帜方向逐关一致。
- Route 7 普通垫圈：`misses=1`、`delivered=0`；结果浮字与箱体不重叠，顶面裂纹可见。

## 宿主 SHA-256（改前 = 改后）

| 文件 | SHA-256 |
|---|---|
| `dist/index.html` | `4b0de734d544fcb9ed7986634c8328b0d2d2ec4c1f1ce8bc82dbc4ff7d79e285` |
| `dist/assets/index-B7KsugIC.js` | `9a6592f5a12b54ebd2fbf6285b32745912af240ffcfe600614fb953a37a4ba30` |
| `dist/assets/index-BQbljl_5.css` | `663baa168e8831952ae7f5d8ccd744e96551afeaceb87056468f42b062616906` |
| `dist/aigram-bridge.js` | `80e2dddb5791cc1ef15fec294308fccb6bd9cc42772a715600fa66f6fe6fc615` |
| `dist/img/aigram.svg` | `4c5913f6bb313e8a8dfdf2c185af09fc397d048a00af85d16b68f0e3de8ebc74` |
| `dist/poster.png` | `16027d2e9dfdad698d52835e67bf5a5b11ce39ccde0d45ec03294be37b199b8f` |
| `dist/poster.svg` | `dca1091cc09c2e39c866db89bc027edf183f3cf7fd19023f44191e0fab7e81f1` |

## 视觉 QA

- Hierarchy 4/5；Coherence 5/5；Readability 4/5；Game feel 4/5；Asset quality 5/5；Responsive UX 5/5；Polish 4/5。平均 4.43，无低于 3 的项目。
- P1 “31e9daf 把街道拆成空地上的孤立方块”已通过恢复 `fa376ab` 固定空间与隐藏 HUD 的六张复拍关闭。
- P1 “楼体只是白点方块/同模型换色”已通过楼层、窗框、女儿墙和六类专属建筑结构关闭。
- P1 “翻风静帧方向未提交”和“裂箱浮字遮挡”已用最终静帧与浏览器断言关闭。
- `comprehension unverified`：本轮只改视觉辨识与反馈证据，仍没有全新真人复述玩法三问合同的证据。

# Rooftop Delivery — Crazy Games 第六轮 Neon 审图修正

## 本轮范围

- 分支：`cursor/crazygames-guest-7e22`
- 起点：`3890998`
- 只修改 Crazy Games 隔离代码、QA 与文档；没有修改宿主运行代码，没有重写抛掷结算。
- 10 条固定路线、七步教学、八项升级与夜间合约全部保留；没有新增路线、广告、内购或账号。

## 恢复成立的街道空间

本轮恢复 `fa376ab` 的相机、街道宽度和连续街景：玩家屋顶仍在近处，目标屋顶固定在街对面，左右楼体按原坐标公式各 11 栋连续排布。六景统一断言 `gap=4`、`streetWidth=8`、`skylineCount=22`，不再把目标屋顶推远，也没有单独悬空的楼。

## 六类建筑，而非六套染色

公共楼体生成器现在按高度生成楼层线、成组窗户、窗框、立面边柱和可见女儿墙；场景差异由六个穷举建筑族叠加：

| 场景 | 建筑族 | 800×450 静帧识别物 |
|---|---|---|
| depot | warehouse | 两侧临街装卸门/雨棚与屋顶货箱 |
| laundry | residential | 两侧住宅顶层窗与屋沿之间的彩色晾衣 |
| garden | courtyard | 两侧楼顶花箱、矮树与临街窗台绿植 |
| neon | sign-tower | 22 块朝街墙牌、同帧完整可读的 `NIGHT / PARCEL / EXPRESS / 24H` 四块悬挑主牌、厚灯管边框与通长檐口/跨街灯管 |
| glasshouse | glassworks | 两侧屋顶成排透明玻璃棚和框架 |
| beacon | harbor | 侧后方楼顶灯塔、扫光与沿街暖灯 |

所有建筑、街道、招牌、灯光和装饰继续只用 Three.js 程序化几何或运行时 CanvasTexture，没有下载模型或图片。

## 落点屋顶减法

上一轮集中在收件屋顶的箱堆/装卸牌、整排晾衣、四组花箱、`NIGHT POST` 主牌、整座玻璃棚和灯塔已全部移除。收件屋顶现在只保留落点圈、玩法动物、风旗，以及一个水箱或天线；Route 8/10 的两个落点均无遮挡。主题氛围由左右 22 栋街楼与后方楼群承担。

## Neon 灯牌与灯管

- 22 栋侧街楼逐栋生成朝街墙牌，宽度为墙宽 68%，高度为 2.18 层；另有四块由支架连到侧楼的悬挑主牌，确保 `NIGHT / PARCEL / EXPRESS / 24H` 在 800×450 同帧完整可读。
- 文字纹理改为彩色圆角三层 `strokeText`，只有灯管轮廓和亮芯，没有白色填字。
- 每块牌由暗色实体底板、0.20 厚的四边 emissive 内管，以及外扩 0.30 的半透明亮边组成。
- 22 栋朝街檐口各使用一根覆盖完整墙宽的通长灯管；街谷左右各一根 4.45 长的灯管直接连接玩家屋顶与落点屋顶，窗框灯管同样不再使用 0.075 细条。
- 收件屋顶未增加招牌或灯管，仍只保留垫圈、旗子和一件小型天线。

## 既有特殊规则保持

- Route 6 / 9 / 10：翻风静帧改在 180ms 权威风提交后拍摄。旗帜以旗杆为原点左右翻面，HUD 箭头使用相同符号；三关均自动断言 `wind = HUD = flag`，且仍只翻转一次。
- Route 7：裂纹同时放在箱体朝相机的正面和顶面；`Fragile crate cracked` 浮字下移到前景屋顶，不再遮住远端箱体。普通垫圈仍回归为 `misses=1`、`delivered=0`。

## 800×450 最终截图

本轮只改 neon，因此只复拍一张；其他五景证据与代码均不改：

- `_qa/ui/crazygames-scenes/800x450-neon.png`

专项脚本：`_qa/crazygames-neon-review.mjs`。

## 验证结果

- `npm test`：通过；固定路线仍为 10，夜间合约仍只轮换六个现成场景，10 条路线均有非 miss 规划落点。
- Chromium 800×450：六景及两项反馈图无溢出、页面异常或控制台错误。
- 六景共享已恢复的连续街道骨架；六个建筑族与建筑主色均唯一，差异来自可见结构而非移动楼距或只换色。
- 六张无 HUD 截图中，主题物件分布在左右/后方楼体，收件屋顶没有大型主题陈列；垫圈与旗帜保持清楚。
- neon 专项 Chromium 截图为 800×450，无溢出、裁切、页面异常或控制台错误；固定 `gap=4 / streetWidth=8 / skylineCount=22` 未变。
- 真实场景树计数：`streetSigns=22`、`heroSigns=4`、`eaves=22`、`streetTubes=2`；四块主牌文字在最终静帧中均完整。
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
- P1 “主题装饰都堆在落点屋顶”已通过侧街附着规则与六张无 HUD 复拍关闭。
- P1 “neon 细方条、小字被裁、灯牌像白字贴片”已通过逐楼大牌、四块悬挑主牌、管状描边字、0.20 内管/外层光晕和通长檐口/跨街灯管专项复拍关闭。
- P1 “翻风静帧方向未提交”和“裂箱浮字遮挡”已用最终静帧与浏览器断言关闭。
- `comprehension unverified`：本轮只改视觉辨识与反馈证据，仍没有全新真人复述玩法三问合同的证据。

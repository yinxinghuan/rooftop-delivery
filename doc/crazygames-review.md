# Rooftop Delivery — Crazy Games 游客版审图修正

## 本轮范围

- 分支：`cursor/crazygames-guest-7e22`
- 起点：`83b5cd8`
- 只修改 Crazy Games 隔离代码、测试证据与文档；没有重写抛掷结算，没有增加路线、广告、内购或账号。
- 七步教学、八项升级、10 条固定路线和夜间合约继续保留；游戏内文案保持英文。

## 画面修正

- 六个场景现在有不同的程序化楼高、墙色、窗光与屋顶轮廓；每景都有水箱或天线，并分别保留 depot 货运牌/箱堆、laundry 晾衣绳、garden 花箱、neon 霓虹招牌、glasshouse 玻璃棚和 beacon 灯塔灯。
- 夜间合约按六个现成场景循环，不创建新城。
- 包裹改为可辨认的纸箱：顶面/侧面十字胶带、正面纸质标签；屋顶接触时压扁回弹并出现小费浮字。
- 风旗和 laundry 衣物跟随可见风向倾斜；包裹滑出楼沿后持续翻滚经过街道高度，再结算失误。

## 三项玩法修正

1. Route 7 / Glasshouse：只有珊瑚中心判送达；普通垫圈或屋顶边缘会显示裂纹并计一次 miss。
2. Route 6 / 9 / 10：每件包裹按住 Space 蓄力时只翻风一次；风旗和 HUD 先转，180ms 后新风才进入预测线与实际弹道。
3. Route 8 / 10：同时生成珊瑚主圈与风青普通圈；珊瑚圈是高分/高小费 bullseye，普通圈只返回 delivered。

三类规则均复用既有一次性提示卡，没有扩写七步教学。

## 800×450 最终截图

- 装扮后的中局：`_qa/ui/crazygames-final/800x450-mid.png`
- 风向翻转：`_qa/ui/crazygames-final/800x450-wind-flip.png`
- 非 depot 花园场景：`_qa/ui/crazygames-final/800x450-garden.png`

额外证据：

- 六景逐一截图：`_qa/ui/crazygames-scenes/800x450-{depot,laundry,garden,neon,glasshouse,beacon}.png`
- 易碎箱展示：`_qa/ui/crazygames-final/800x450-fragile.png`
- 同视口改前对照：`_qa/ui/crazygames-before/800x450-{mid,neon,garden}.png`
- 浏览器断言：`_qa/crazygames-review.json`

## 验证结果

- `npm test`：通过。10 条路线均有非 miss 规划落点；固定路线数仍为 10；夜间合约六景循环通过。
- Chromium 800×450：无横向/纵向溢出，无页面异常或控制台错误。
- Route 7 普通垫圈回归：`misses=1`、`delivered=0`。
- Route 6 翻风回归：`windFlipPending` 先出现，180ms 后权威风向反转；第二次触发不改变风向。
- Route 8 / 10：均存在互不重叠的副落点，副圈分类为普通 `delivered`。
- 坠楼回归：包裹在完成前经过 `y=-8.8` 街道高度，最终才返回 `miss`。

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

- Hierarchy 4/5；Coherence 4/5；Readability 4/5；Game feel 4/5；Asset quality 4/5；Responsive UX 5/5；Polish 4/5。平均 4.14，无低于 3 的项目。
- 第一轮主要问题是 glasshouse 透明度不足、裂箱截图中文字遮挡主体、风翻转静帧不够明确。复验中提高玻璃棚框架/面板可见度，最终审核截图改用 HUD、近景旗帜和 `Wind turning` 同时出现的风翻转状态。
- `comprehension unverified`：机械路径和信息可见性已验证，但仍没有全新真人复述三问合同的证据。

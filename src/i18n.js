const dictionaries = {
  en: {
    route: 'ROUTE', score: 'SCORE', parcelsLeft: 'PARCELS LEFT', crosswind: 'CROSSWIND',
    throwPower: 'THROW POWER', readTheWind: 'READ THE WIND', kicker: 'DUSK SHIFT · AIRMAIL 08',
    lede: 'Throw eight parcels across the city. Read the wind. Land on the mark.',
    dragRelease: 'DRAG UP · RELEASE', dragHint: 'Sideways aims. Distance sets power.',
    startShift: 'START SHIFT', playHint: 'DRAG UP TO THROW', routeScore: 'ROUTE SCORE',
    newRecord: 'NEW ROUTE RECORD', best: 'BEST', delivered: 'DELIVERED', bullseyes: 'BULLSEYES',
    maxCombo: 'MAX COMBO', again: 'RUN IT AGAIN', home: 'BACK TO DEPOT',
    combo: 'COMBO', miss: 'MISS',
    leaders: 'LEADERS', champion: '#1', you: 'YOU', leaderboard: 'LEADERBOARD',
    leaderboardKicker: 'GLOBAL ROUTE', leaderboardTitle: 'TOP COURIERS',
    openInAlterU: 'Open in AlterU to join the global route.', downloadAlterU: 'GET ALTERU',
    loadingRank: 'Loading couriers...', noScores: 'No deliveries yet. Be the first.',
    shiftComplete: 'ROUTE PASSED', shiftLost: 'ROUTE FAILED', allRoutesComplete: 'ALL ROUTES COMPLETE',
    routeMap: 'ROUTE MAP', routeLabel: 'ROUTE {n}', mission: 'MISSION', locked: 'LOCKED', cleared: 'CLEARED', current: 'CURRENT',
    nextRoute: 'NEXT ROUTE', retryRoute: 'RETRY ROUTE', replayFinal: 'RUN THE FINAL AGAIN', missionComplete: 'MISSION COMPLETE', missionFailed: 'MISSION INCOMPLETE',
    level1Title: 'ROOFTOP BASICS', level1Mission: 'Deliver 3 of 4 parcels',
    level2Title: 'CROSSWIND ROW', level2Mission: 'Deliver 4 of 5 in strong wind',
    level3Title: 'NARROW LANDING', level3Mission: 'Deliver 5 · hit 1 bullseye',
    level4Title: 'MOVING ADDRESS', level4Mission: 'Deliver 4 · score 300',
    level5Title: 'FRAGILE EXPRESS', level5Mission: 'Deliver 6 · hit 2 bullseyes',
    level6Title: 'SKYLINE FINALE', level6Mission: 'Deliver 7 · 2 bullseyes · 500 pts',
    perfect: ['Doorstep perfect!', 'Dead center!', 'Express precision!'],
    deliveredLine: ['Signed and landed!', 'Right on schedule!', 'That counts!'],
    edgeLine: ['Roof is close enough!', 'Safe landing!', 'They can find it!'],
    missLine: ['Package down!', 'That address was lower.', 'Wind took it!'],
  },
  zh: {
    route: '路线', score: '得分', parcelsLeft: '剩余机会', crosswind: '侧风',
    throwPower: '投掷力度', readTheWind: '先看风向', kicker: '黄昏班次 · 航邮 08',
    lede: '把 8 件包裹送过城市。看准风向，落到标记中心。',
    dragRelease: '向上拖动 · 松手投掷', dragHint: '左右瞄准，距离决定力度。',
    startShift: '开始派送', playHint: '向上拖动投掷', routeScore: '路线得分',
    newRecord: '新路线纪录', best: '历史最高', delivered: '成功送达', bullseyes: '中心命中',
    maxCombo: '最高连击', again: '再跑一轮', home: '返回仓库',
    combo: '连击', miss: '失误',
    leaders: '排行榜', champion: '第一名', you: '你', leaderboard: '排行榜',
    leaderboardKicker: '全球路线', leaderboardTitle: '顶尖快递员',
    openInAlterU: '请在 AlterU 中查看并加入全球排行榜。', downloadAlterU: '下载 ALTERU',
    loadingRank: '正在加载排行榜…', noScores: '还没有派送纪录，来拿第一名。',
    shiftComplete: '路线通过', shiftLost: '路线失败', allRoutesComplete: '全部路线完成',
    routeMap: '路线地图', routeLabel: '路线 {n}', mission: '任务', locked: '未解锁', cleared: '已通过', current: '当前路线',
    nextRoute: '下一条路线', retryRoute: '重试本关', replayFinal: '再跑终局', missionComplete: '任务完成', missionFailed: '任务未完成',
    level1Title: '屋顶入门', level1Mission: '4 件中成功送达 3 件',
    level2Title: '侧风街区', level2Mission: '强风中 5 件送达 4 件',
    level3Title: '狭窄落点', level3Mission: '送达 5 件 · 中心命中 1 次',
    level4Title: '移动地址', level4Mission: '送达 4 件 · 得分 300',
    level5Title: '易碎快件', level5Mission: '送达 6 件 · 中心命中 2 次',
    level6Title: '天际终局', level6Mission: '送达 7 件 · 中心 2 次 · 500 分',
    perfect: ['正中门口！', '中心命中！', '快递员的尊严！'],
    deliveredLine: ['准时签收！', '稳稳送到！', '这单漂亮！'],
    edgeLine: ['屋顶也算送到！', '安全落地！', '收件人找得到！'],
    missLine: ['包裹坠落！', '地址好像在楼下。', '被风带走了！'],
  },
}

function detectLocale() {
  const saved = localStorage.getItem('game_locale')
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const locale = detectLocale()
export const t = (key, vars = {}) => {
  const value = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
  if (typeof value !== 'string') return value
  return Object.entries(vars).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value)
}
export const line = (key) => {
  const entries = dictionaries[locale][key] ?? dictionaries.en[key]
  return entries[Math.floor(Math.random() * entries.length)]
}

export function applyI18n(root = document) {
  root.documentElement.lang = locale
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n)
  })
}

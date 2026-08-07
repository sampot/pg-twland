/**
 * 機會／命運卡（效果對齊經典紙本；文案在地化；金額單位「元」）。
 * @typedef {'advance'|'pay'|'collect'|'jail'|'jailcard'|'repairs'|'nearest'|'back'|'taxpct'} CardKind
 */

/**
 * @typedef {object} Card
 * @property {string} id
 * @property {string} text
 * @property {CardKind} kind
 * @property {number} [amount]
 * @property {number} [to]           // board index
 * @property {number} [house]        // repairs per house
 * @property {number} [hotel]        // repairs per hotel
 * @property {'railroad'|'utility'} [nearest]
 * @property {boolean} [collectGo]   // salary if pass GO
 */

/** @type {Card[]} */
export const CHANCE = [
  {
    id: "c1",
    text: "捷運「請勿奔跑」廣播失靈？算了，直接衝回出發，領 200 元。",
    kind: "advance",
    to: 0,
    collectGo: false,
  },
  {
    id: "c2",
    text: "百貨週年慶開跑！前進信義計畫區。若經過出發可領薪。",
    kind: "advance",
    to: 39,
    collectGo: true,
  },
  {
    id: "c3",
    text: "東區逛街路線更新：前進忠孝東路。若經過出發可領薪。",
    kind: "advance",
    to: 21,
    collectGo: true,
  },
  {
    id: "c4",
    text: "高鐵自由座開放！前往最近車站。無主可買；有主付雙倍租金。",
    kind: "nearest",
    nearest: "railroad",
  },
  {
    id: "c5",
    text: "颱風夜跳電又停水？前往最近公用事業。無主可買；有主以骰點×10 計費。",
    kind: "nearest",
    nearest: "utility",
  },
  {
    id: "c6",
    text: "台股小賺一波，銀行發放股息 50 元。",
    kind: "collect",
    amount: 50,
  },
  {
    id: "c7",
    text: "里長蓋章證明「有在社區服務」，獲得免費出獄卡。",
    kind: "jailcard",
  },
  {
    id: "c8",
    text: "騎車逆行被叭三聲，羞愧後退三格。",
    kind: "back",
    amount: 3,
  },
  {
    id: "c9",
    text: "未禮讓行人，警察請你去坐牢。不得經過出發領薪。",
    kind: "jail",
  },
  {
    id: "c10",
    text: "老屋都更前整修：每棟房屋付 25 元，每間旅館付 100 元。",
    kind: "repairs",
    house: 25,
    hotel: 100,
  },
  {
    id: "c11",
    text: "測速照相閃光！超速罰單 15 元。",
    kind: "pay",
    amount: 15,
  },
  {
    id: "c12",
    text: "轉乘趕末班車：前進臺北車站。若經過出發可領薪。",
    kind: "advance",
    to: 5,
    collectGo: true,
  },
  {
    id: "c13",
    text: "去雙連朝聖紅豆湯：前進中山北路。若經過出發可領薪。",
    kind: "advance",
    to: 11,
    collectGo: true,
  },
  {
    id: "c14",
    text: "你當選里長，發放里民紅包：每位玩家付給你 50 元。",
    kind: "collect",
    amount: 50,
    // special: from each — handled in engine via id
  },
  {
    id: "c15",
    text: "青年安心成家貸款撥款，領取 150 元。",
    kind: "collect",
    amount: 150,
  },
  {
    id: "c16",
    text: "參加媽祖繞境扛轎競賽獲獎，領取 100 元。",
    kind: "collect",
    amount: 100,
  },
  {
    id: "c17",
    text: "夜市射飛鏢射中大獎，領取 75 元。",
    kind: "collect",
    amount: 75,
  },
  {
    id: "c18",
    text: "機車未停格被拖吊，繳 40 元。",
    kind: "pay",
    amount: 40,
  },
  {
    id: "c19",
    text: "前進仁愛路，準備拍豪宅照。若經過出發可領薪。",
    kind: "advance",
    to: 24,
    collectGo: true,
  },
  {
    id: "c20",
    text: "又是一張高鐵優惠：前往最近車站。無主可買；有主付雙倍租金。",
    kind: "nearest",
    nearest: "railroad",
  },
];

/** @type {Card[]} */
export const CHEST = [
  {
    id: "h1",
    text: "健保卡忘了帶，乾脆回家一趟：前進出發，領 200 元。",
    kind: "advance",
    to: 0,
    collectGo: false,
  },
  {
    id: "h2",
    text: "銀行 ATM 多吐鈔，行員說算你的：發給你 200 元。",
    kind: "collect",
    amount: 200,
  },
  {
    id: "h3",
    text: "急診掛號加部分負擔，就醫費 50 元。",
    kind: "pay",
    amount: 50,
  },
  {
    id: "h4",
    text: "分紅保單到期，售出零股獲 50 元。",
    kind: "collect",
    amount: 50,
  },
  {
    id: "h5",
    text: "律師朋友塞一張「保釋狀」，獲得免費出獄卡。",
    kind: "jailcard",
  },
  {
    id: "h6",
    text: "檢舉達人反被抓包惡意檢舉，去坐牢。不得經過出發領薪。",
    kind: "jail",
  },
  {
    id: "h7",
    text: "演唱會檔期撞颱風假，主辦退票給你 100 元。",
    kind: "collect",
    amount: 100,
  },
  {
    id: "h8",
    text: "年終獎金入帳，領取 100 元。",
    kind: "collect",
    amount: 100,
  },
  {
    id: "h9",
    text: "強制汽車責任險續保，支付 50 元。",
    kind: "pay",
    amount: 50,
  },
  {
    id: "h10",
    text: "綜合所得稅退稅 20 元，請查收。",
    kind: "collect",
    amount: 20,
  },
  {
    id: "h11",
    text: "今天壽星！夜市請吃雞排：每位玩家付給你 10 元。",
    kind: "collect",
    amount: 10,
  },
  {
    id: "h12",
    text: "文化部補助創作計畫過關，領取 100 元。",
    kind: "collect",
    amount: 100,
  },
  {
    id: "h13",
    text: "補習班學費到期，繳 50 元。",
    kind: "pay",
    amount: 50,
  },
  {
    id: "h14",
    text: "幫鄰居裝 Wi‑Fi，諮詢費收入 25 元。",
    kind: "collect",
    amount: 25,
  },
  {
    id: "h15",
    text: "騎樓整平與排水工程：每棟房屋付 40 元，每間旅館付 115 元。",
    kind: "repairs",
    house: 40,
    hotel: 115,
  },
  {
    id: "h16",
    text: "阿公阿嬤遺產入帳 100 元（含三罐老干媽）。",
    kind: "collect",
    amount: 100,
  },
  {
    id: "h17",
    text: "中樂透！雖然只中「普獎」，仍領取 60 元。",
    kind: "collect",
    amount: 60,
  },
  {
    id: "h18",
    text: "超商代收罰款：未繳停車費補繳 30 元。",
    kind: "pay",
    amount: 30,
  },
  {
    id: "h19",
    text: "村里發放敬老／生育津貼漏發補發，領取 80 元。",
    kind: "collect",
    amount: 80,
  },
  {
    id: "h20",
    text: "捐款賑災與物資箱，繳 45 元。",
    kind: "pay",
    amount: 45,
  },
];

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

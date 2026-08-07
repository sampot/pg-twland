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
    text: "前進至出發，領取 200 元。",
    kind: "advance",
    to: 0,
    collectGo: false,
  },
  {
    id: "c2",
    text: "前進至信義計畫區。若經過出發可領薪。",
    kind: "advance",
    to: 39,
    collectGo: true,
  },
  {
    id: "c3",
    text: "前進至忠孝東路。若經過出發可領薪。",
    kind: "advance",
    to: 21,
    collectGo: true,
  },
  {
    id: "c4",
    text: "搭乘高鐵：前往最近車站。若無主可買；若有主付雙倍租金。",
    kind: "nearest",
    nearest: "railroad",
  },
  {
    id: "c5",
    text: "前往最近公用事業。若無主可買；若有主以骰子點數×10 計費。",
    kind: "nearest",
    nearest: "utility",
  },
  { id: "c6", text: "銀行發放股息 50 元。", kind: "collect", amount: 50 },
  { id: "c7", text: "獲得一張「免費出獄」卡。", kind: "jailcard" },
  { id: "c8", text: "後退三格。", kind: "back", amount: 3 },
  { id: "c9", text: "去坐牢。不得經過出發領薪。", kind: "jail" },
  {
    id: "c10",
    text: "房屋整修：每棟房屋付 25 元，每間旅館付 100 元。",
    kind: "repairs",
    house: 25,
    hotel: 100,
  },
  { id: "c11", text: "超速罰單，繳 15 元。", kind: "pay", amount: 15 },
  {
    id: "c12",
    text: "前進至臺北車站。若經過出發可領薪。",
    kind: "advance",
    to: 5,
    collectGo: true,
  },
  {
    id: "c13",
    text: "前進至中山北路。若經過出發可領薪。",
    kind: "advance",
    to: 11,
    collectGo: true,
  },
  {
    id: "c14",
    text: "你當選里長，每位玩家付給你 50 元。",
    kind: "collect",
    amount: 50,
    // special: from each — handled in engine via id
  },
  {
    id: "c15",
    text: "建築貸款到期，領取 150 元。",
    kind: "collect",
    amount: 150,
  },
  {
    id: "c16",
    text: "十字路口競賽獲獎，領取 100 元。",
    kind: "collect",
    amount: 100,
  },
];

/** @type {Card[]} */
export const CHEST = [
  {
    id: "h1",
    text: "前進至出發，領取 200 元。",
    kind: "advance",
    to: 0,
    collectGo: false,
  },
  { id: "h2", text: "銀行錯誤，發給你 200 元。", kind: "collect", amount: 200 },
  { id: "h3", text: "就醫費，繳 50 元。", kind: "pay", amount: 50 },
  { id: "h4", text: "售出股票，獲得 50 元。", kind: "collect", amount: 50 },
  { id: "h5", text: "獲得一張「免費出獄」卡。", kind: "jailcard" },
  { id: "h6", text: "去坐牢。不得經過出發領薪。", kind: "jail" },
  {
    id: "h7",
    text: "音樂會退票，獲得 100 元。",
    kind: "collect",
    amount: 100,
  },
  { id: "h8", text: "年底獎金，領取 100 元。", kind: "collect", amount: 100 },
  {
    id: "h9",
    text: "支付保險費 50 元。",
    kind: "pay",
    amount: 50,
  },
  { id: "h10", text: "退稅 20 元。", kind: "collect", amount: 20 },
  {
    id: "h11",
    text: "今天壽星，每位玩家付給你 10 元。",
    kind: "collect",
    amount: 10,
  },
  {
    id: "h12",
    text: "基金會補助，領取 100 元。",
    kind: "collect",
    amount: 100,
  },
  { id: "h13", text: "學費，繳 50 元。", kind: "pay", amount: 50 },
  {
    id: "h14",
    text: "諮詢費收入 25 元。",
    kind: "collect",
    amount: 25,
  },
  {
    id: "h15",
    text: "街道整修：每棟房屋付 40 元，每間旅館付 115 元。",
    kind: "repairs",
    house: 40,
    hotel: 115,
  },
  {
    id: "h16",
    text: "你繼承遺產 100 元。",
    kind: "collect",
    amount: 100,
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

/**
 * 40-格紙本地產環（台灣路名換皮）。
 * 價位採經典相對比例，單位為「元」；試玩後可再調。
 */

/** @typedef {'go'|'property'|'railroad'|'utility'|'tax'|'chance'|'chest'|'jail'|'gotojail'|'parking'} TileType */

/**
 * @typedef {object} Tile
 * @property {number} id
 * @property {string} name
 * @property {TileType} type
 * @property {string} [group]
 * @property {number} [price]
 * @property {number[]} [rent]  // property: [site,1h,2h,3h,4h,hotel]; railroad unused; utility unused
 * @property {number} [houseCost]
 * @property {number} [tax]
 */

/** @type {Tile[]} */
export const BOARD = [
  { id: 0, name: "出發", type: "go" },
  {
    id: 1,
    name: "迪化街",
    type: "property",
    group: "brown",
    price: 60,
    rent: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
  },
  { id: 2, name: "命運", type: "chest" },
  {
    id: 3,
    name: "華西街",
    type: "property",
    group: "brown",
    price: 60,
    rent: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
  },
  { id: 4, name: "所得稅", type: "tax", tax: 200 },
  { id: 5, name: "臺北車站", type: "railroad", price: 200 },
  {
    id: 6,
    name: "民生東路",
    type: "property",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  { id: 7, name: "機會", type: "chance" },
  {
    id: 8,
    name: "南京西路",
    type: "property",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  {
    id: 9,
    name: "長春路",
    type: "property",
    group: "lightblue",
    price: 120,
    rent: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
  },
  { id: 10, name: "坐牢", type: "jail" },
  {
    id: 11,
    name: "中山北路",
    type: "property",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  { id: 12, name: "台灣電力", type: "utility", price: 150 },
  {
    id: 13,
    name: "民權東路",
    type: "property",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  {
    id: 14,
    name: "南京東路",
    type: "property",
    group: "pink",
    price: 160,
    rent: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
  },
  { id: 15, name: "桃園車站", type: "railroad", price: 200 },
  {
    id: 16,
    name: "敦化北路",
    type: "property",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  { id: 17, name: "命運", type: "chest" },
  {
    id: 18,
    name: "復興北路",
    type: "property",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  {
    id: 19,
    name: "建國北路",
    type: "property",
    group: "orange",
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
  },
  { id: 20, name: "免費停車", type: "parking" },
  {
    id: 21,
    name: "忠孝東路",
    type: "property",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  { id: 22, name: "機會", type: "chance" },
  {
    id: 23,
    name: "忠孝西路",
    type: "property",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  {
    id: 24,
    name: "仁愛路",
    type: "property",
    group: "red",
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
  },
  { id: 25, name: "臺中車站", type: "railroad", price: 200 },
  {
    id: 26,
    name: "信義路",
    type: "property",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  {
    id: 27,
    name: "基隆路",
    type: "property",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  { id: 28, name: "自來水公司", type: "utility", price: 150 },
  {
    id: 29,
    name: "松仁路",
    type: "property",
    group: "yellow",
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
  },
  { id: 30, name: "去坐牢", type: "gotojail" },
  {
    id: 31,
    name: "敦化南路",
    type: "property",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  {
    id: 32,
    name: "復興南路",
    type: "property",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  { id: 33, name: "命運", type: "chest" },
  {
    id: 34,
    name: "和平東路",
    type: "property",
    group: "green",
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
  },
  { id: 35, name: "高雄車站", type: "railroad", price: 200 },
  { id: 36, name: "機會", type: "chance" },
  {
    id: 37,
    name: "忠孝東路四段",
    type: "property",
    group: "darkblue",
    price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
  },
  { id: 38, name: "奢侈稅", type: "tax", tax: 100 },
  {
    id: 39,
    name: "信義計畫區",
    type: "property",
    group: "darkblue",
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
  },
];

export const GROUP_COLOR = {
  brown: "#8b4513",
  lightblue: "#87ceeb",
  pink: "#ff69b4",
  orange: "#ffa500",
  red: "#e11d48",
  yellow: "#eab308",
  green: "#16a34a",
  darkblue: "#1d4ed8",
};

export const GROUP_TILES = BOARD.reduce((acc, t) => {
  if (t.group) {
    (acc[t.group] ??= []).push(t.id);
  }
  return acc;
}, /** @type {Record<string, number[]>} */ ({}));

export const GO_SALARY = 200;
export const START_CASH = 1500;
export const JAIL_FINE = 50;
export const MAX_HOUSES = 32;
export const MAX_HOTELS = 12;
export const HOUSES_PER_HOTEL = 4;

export function tileById(id) {
  return BOARD[id];
}

export function isOwnable(tile) {
  return (
    tile.type === "property" ||
    tile.type === "railroad" ||
    tile.type === "utility"
  );
}

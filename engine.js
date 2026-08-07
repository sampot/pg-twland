import {
  BOARD,
  GROUP_TILES,
  GO_SALARY,
  START_CASH,
  JAIL_FINE,
  MAX_HOUSES,
  MAX_HOTELS,
  HOUSES_PER_HOTEL,
  tileById,
  isOwnable,
} from "./board.js";
import { CHANCE, CHEST, shuffle } from "./cards.js";

/**
 * @typedef {'lobby'|'roll'|'jail_turn'|'buy'|'auction'|'debt'|'manage'|'trade'|'ended'} Phase
 */

/**
 * @param {number} n
 * @param {() => number} rng
 */
function rollDie(rng) {
  return 1 + Math.floor(rng() * 6);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class TwLandGame {
  /**
   * @param {object} opts
   * @param {number} [opts.playerCount]
   * @param {string[]} [opts.names]
   * @param {boolean[]} [opts.aiFlags]
   * @param {() => number} [opts.rng]
   */
  constructor(opts = {}) {
    this.rng = opts.rng ?? Math.random;
    this.log = [];
    this.phase = /** @type {Phase} */ ("lobby");
    this.winnerId = /** @type {number|null} */ (null);
    this.housesLeft = MAX_HOUSES;
    this.hotelsLeft = MAX_HOTELS;
    this.chance = shuffle(CHANCE, this.rng);
    this.chest = shuffle(CHEST, this.rng);
    this.chanceIdx = 0;
    this.chestIdx = 0;

    const n = Math.min(4, Math.max(2, opts.playerCount ?? 2));
    const names = opts.names ?? [];
    const aiFlags = opts.aiFlags ?? [];
    this.players = Array.from({ length: n }, (_, i) => ({
      id: i,
      name: names[i] || `玩家 ${i + 1}`,
      cash: START_CASH,
      pos: 0,
      jail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
      doubles: 0,
      /** When true, UI autopilot drives this seat. */
      ai: Boolean(aiFlags[i]),
    }));

    /** @type {Record<number, {owner: number|null, houses: number, mortgaged: boolean}>} */
    this.props = {};
    for (const t of BOARD) {
      if (isOwnable(t)) {
        this.props[t.id] = { owner: null, houses: 0, mortgaged: false };
      }
    }

    this.turn = 0;
    this.lastDice = /** @type {[number, number]|null} */ (null);
    this.pendingBuy = /** @type {number|null} */ (null);
    /** @type {null|{tileId:number, highBid:number, highBidder:number|null, turn:number, passed:number[]}} */
    this.auction = null;
    /** @type {null|{debtor:number, creditor:number|'bank', amount:number, reason:string}} */
    this.debt = null;
    /** @type {null|{from:number, to:number, offerCash:number, askCash:number, offerTiles:number[], askTiles:number[], offerJail:number, askJail:number}} */
    this.trade = null;
    this.canRollAgain = false;
    this.turnStarted = false;
    /** @type {null|{playerId:number, total:number}} */
    this.pendingJailExit = null;
  }

  pushLog(msg) {
    this.log.unshift(msg);
    if (this.log.length > 80) this.log.length = 80;
  }

  alivePlayers() {
    return this.players.filter((p) => !p.bankrupt);
  }

  current() {
    return this.players[this.turn];
  }

  /**
   * Toggle AI custody for a seat (hot-seat autopilot).
   * @param {number} playerId
   * @param {boolean} on
   */
  setPlayerAi(playerId, on) {
    const p = this.players[playerId];
    if (!p || p.bankrupt) return { ok: false, error: "無法託管" };
    p.ai = Boolean(on);
    this.pushLog(
      p.ai ? `${p.name} 已託管給 AI。` : `${p.name} 已收回手動操作。`,
    );
    return { ok: true };
  }

  start() {
    if (this.phase !== "lobby") return { ok: false, error: "已開局" };
    this.phase = "roll";
    this.turnStarted = true;
    this.pushLog(`開局！${this.current().name} 先手（各持 ${START_CASH} 元）。`);
    return { ok: true };
  }

  /** Snapshot for UI */
  snapshot() {
    return {
      phase: this.phase,
      turn: this.turn,
      players: deepClone(this.players),
      props: deepClone(this.props),
      lastDice: this.lastDice,
      pendingBuy: this.pendingBuy,
      auction: deepClone(this.auction),
      debt: deepClone(this.debt),
      trade: deepClone(this.trade),
      housesLeft: this.housesLeft,
      hotelsLeft: this.hotelsLeft,
      winnerId: this.winnerId,
      canRollAgain: this.canRollAgain,
      log: [...this.log],
    };
  }

  // —— helpers ——

  ownsGroup(playerId, group) {
    const ids = GROUP_TILES[group] || [];
    return ids.every((id) => this.props[id]?.owner === playerId && !this.props[id].mortgaged);
  }

  countOwned(playerId, type) {
    return BOARD.filter(
      (t) => t.type === type && this.props[t.id]?.owner === playerId,
    ).length;
  }

  buildingsOf(playerId) {
    let houses = 0;
    let hotels = 0;
    for (const t of BOARD) {
      if (t.type !== "property") continue;
      const st = this.props[t.id];
      if (st?.owner !== playerId) continue;
      if (st.houses === 5) hotels++;
      else houses += st.houses;
    }
    return { houses, hotels };
  }

  rentDue(tileId, diceTotal) {
    const tile = tileById(tileId);
    const st = this.props[tileId];
    if (!st || st.owner == null || st.mortgaged) return 0;
    const owner = st.owner;

    if (tile.type === "property") {
      if (st.houses > 0) return tile.rent[st.houses];
      const base = tile.rent[0];
      return this.ownsGroup(owner, tile.group) ? base * 2 : base;
    }
    if (tile.type === "railroad") {
      const n = this.countOwned(owner, "railroad");
      return [0, 25, 50, 100, 200][n] || 0;
    }
    if (tile.type === "utility") {
      const n = this.countOwned(owner, "utility");
      const mult = n >= 2 ? 10 : 4;
      return (diceTotal || 0) * mult;
    }
    return 0;
  }

  /**
   * @param {number} playerId
   * @param {number} amount
   * @param {number|'bank'} creditor
   * @param {string} reason
   */
  requirePay(playerId, amount, creditor, reason) {
    if (amount <= 0) return;
    const p = this.players[playerId];
    if (p.cash >= amount) {
      p.cash -= amount;
      if (creditor !== "bank") this.players[creditor].cash += amount;
      this.pushLog(`${p.name} 支付 ${amount} 元（${reason}）。`);
      return;
    }
    this.debt = { debtor: playerId, creditor, amount, reason };
    this.phase = "debt";
    this.pushLog(
      `${p.name} 需付 ${amount} 元（${reason}），現金不足，請抵押／賣屋／交易或宣告破產。`,
    );
  }

  trySettleDebt() {
    if (!this.debt) return;
    const { debtor, creditor, amount, reason } = this.debt;
    const p = this.players[debtor];
    if (p.cash >= amount) {
      p.cash -= amount;
      if (creditor !== "bank") this.players[creditor].cash += amount;
      this.pushLog(`${p.name} 付清 ${amount} 元（${reason}）。`);
      this.debt = null;
      this.afterDebtCleared();
    }
  }

  afterDebtCleared() {
    if (this.pendingJailExit) {
      const { playerId, total } = this.pendingJailExit;
      this.pendingJailExit = null;
      const p = this.players[playerId];
      p.jail = false;
      p.jailTurns = 0;
      this.movePlayer(playerId, total);
      this.resolveLanding(playerId, { diceTotal: total });
      return;
    }
    if (this.pendingBuy != null) {
      this.phase = "buy";
      return;
    }
    if (this.auction) {
      this.phase = "auction";
      return;
    }
    this.enterManageOrContinue();
  }

  enterManageOrContinue() {
    if (this.phase === "ended") return;
    // 雙子再擲前仍進入管理，可蓋房／交易；UI 再提供「再擲一次」
    this.phase = "manage";
  }

  checkWin() {
    const alive = this.alivePlayers();
    if (alive.length === 1) {
      this.winnerId = alive[0].id;
      this.phase = "ended";
      this.pushLog(`${alive[0].name} 勝出！`);
      return true;
    }
    return false;
  }

  nextTurn() {
    if (this.phase === "ended") return;
    this.canRollAgain = false;
    this.lastDice = null;
    this.pendingBuy = null;
    const n = this.players.length;
    for (let i = 0; i < n; i++) {
      this.turn = (this.turn + 1) % n;
      if (!this.players[this.turn].bankrupt) break;
    }
    const p = this.current();
    if (p.jail) {
      this.phase = "jail_turn";
      this.pushLog(`輪到 ${p.name}（在牢裡）。`);
    } else {
      this.phase = "roll";
      this.pushLog(`輪到 ${p.name}。`);
    }
  }

  endTurn() {
    if (this.phase !== "manage" && this.phase !== "roll") {
      return { ok: false, error: "現在不能結束回合" };
    }
    if (this.phase === "roll" && !this.canRollAgain && this.lastDice == null) {
      return { ok: false, error: "請先擲骰" };
    }
    // allow end from manage; from roll only if somehow stuck
    if (this.phase === "roll" && this.canRollAgain) {
      return { ok: false, error: "還可以再擲一次" };
    }
    this.trade = null;
    this.nextTurn();
    return { ok: true };
  }

  // —— movement ——

  /**
   * @param {number} playerId
   * @param {number} steps
   * @param {{collectGo?: boolean}} [opts]
   */
  movePlayer(playerId, steps, opts = {}) {
    const p = this.players[playerId];
    const collectGo = opts.collectGo !== false;
    let next = p.pos + steps;
    if (next >= 40) {
      next %= 40;
      if (collectGo) {
        p.cash += GO_SALARY;
        this.pushLog(`${p.name} 經過出發，領取 ${GO_SALARY} 元。`);
      }
    }
    if (next < 0) next = (next + 40) % 40;
    p.pos = next;
  }

  /**
   * @param {number} playerId
   * @param {number} to
   * @param {{collectGo?: boolean}} [opts]
   */
  advanceTo(playerId, to, opts = {}) {
    const p = this.players[playerId];
    const collectGo = opts.collectGo !== false;
    if (to < p.pos && collectGo) {
      p.cash += GO_SALARY;
      this.pushLog(`${p.name} 經過出發，領取 ${GO_SALARY} 元。`);
    } else if (to === 0 && p.pos !== 0) {
      p.cash += GO_SALARY;
      this.pushLog(`${p.name} 抵達出發，領取 ${GO_SALARY} 元。`);
    }
    p.pos = to;
  }

  sendToJail(playerId) {
    const p = this.players[playerId];
    p.pos = 10;
    p.jail = true;
    p.jailTurns = 0;
    p.doubles = 0;
    this.canRollAgain = false;
    this.pushLog(`${p.name} 進入坐牢。`);
  }

  // —— land resolve ——

  /**
   * @param {number} playerId
   * @param {{diceTotal?: number, railDouble?: boolean, utilTen?: boolean}} [ctx]
   */
  resolveLanding(playerId, ctx = {}) {
    const p = this.players[playerId];
    const tile = tileById(p.pos);
    this.pushLog(`${p.name} 停在「${tile.name}」。`);

    if (tile.type === "gotojail") {
      this.sendToJail(playerId);
      this.phase = "manage";
      return;
    }
    if (tile.type === "go" || tile.type === "jail" || tile.type === "parking") {
      this.enterManageOrContinue();
      return;
    }
    if (tile.type === "tax") {
      this.requirePay(playerId, tile.tax, "bank", tile.name);
      if (this.phase !== "debt") this.enterManageOrContinue();
      return;
    }
    if (tile.type === "chance") {
      this.drawCard(playerId, "chance", ctx);
      return;
    }
    if (tile.type === "chest") {
      this.drawCard(playerId, "chest", ctx);
      return;
    }
    if (isOwnable(tile)) {
      const st = this.props[tile.id];
      if (st.owner == null) {
        this.pendingBuy = tile.id;
        this.phase = "buy";
        return;
      }
      if (st.owner === playerId || st.mortgaged) {
        this.enterManageOrContinue();
        return;
      }
      let rent = this.rentDue(tile.id, ctx.diceTotal);
      if (tile.type === "railroad" && ctx.railDouble) rent *= 2;
      if (tile.type === "utility" && ctx.utilTen) {
        rent = (ctx.diceTotal || 0) * 10;
      }
      this.requirePay(playerId, rent, st.owner, `${tile.name} 租金`);
      if (this.phase !== "debt") this.enterManageOrContinue();
    }
  }

  /**
   * @param {number} playerId
   * @param {'chance'|'chest'} deck
   * @param {object} ctx
   */
  drawCard(playerId, deck, ctx = {}) {
    const p = this.players[playerId];
    const list = deck === "chance" ? this.chance : this.chest;
    let idx = deck === "chance" ? this.chanceIdx : this.chestIdx;
    const card = list[idx % list.length];
    if (deck === "chance") this.chanceIdx = idx + 1;
    else this.chestIdx = idx + 1;

    this.pushLog(`${p.name} 抽到${deck === "chance" ? "機會" : "命運"}：${card.text}`);

    const finish = () => {
      if (this.phase !== "debt") this.enterManageOrContinue();
    };

    switch (card.kind) {
      case "jailcard":
        p.jailCards += 1;
        finish();
        break;
      case "jail":
        this.sendToJail(playerId);
        this.phase = "manage";
        break;
      case "pay":
        this.requirePay(playerId, card.amount, "bank", card.text);
        finish();
        break;
      case "collect":
        if (card.id === "c14" || card.id === "h11") {
          const each = card.amount;
          for (const o of this.players) {
            if (o.bankrupt || o.id === playerId) continue;
            if (o.cash >= each) {
              o.cash -= each;
              p.cash += each;
            } else {
              // simplified: take what they have
              p.cash += o.cash;
              this.pushLog(`${o.name} 現金不足，付給 ${p.name} ${o.cash} 元。`);
              o.cash = 0;
            }
          }
          this.pushLog(`${p.name} 向其他玩家共收得款項。`);
          finish();
        } else {
          p.cash += card.amount;
          finish();
        }
        break;
      case "repairs": {
        const { houses, hotels } = this.buildingsOf(playerId);
        const bill = houses * card.house + hotels * card.hotel;
        this.requirePay(playerId, bill, "bank", "整修費");
        finish();
        break;
      }
      case "back":
        this.movePlayer(playerId, -card.amount, { collectGo: false });
        this.resolveLanding(playerId, ctx);
        break;
      case "advance":
        this.advanceTo(playerId, card.to, { collectGo: card.collectGo !== false });
        this.resolveLanding(playerId, ctx);
        break;
      case "nearest": {
        const type = card.nearest;
        let pos = p.pos;
        for (let i = 1; i <= 40; i++) {
          const id = (p.pos + i) % 40;
          if (tileById(id).type === type) {
            pos = id;
            break;
          }
        }
        this.advanceTo(playerId, pos, { collectGo: true });
        const st = this.props[pos];
        if (st?.owner != null && st.owner !== playerId) {
          this.resolveLanding(playerId, {
            diceTotal: ctx.diceTotal || rollDie(this.rng) + rollDie(this.rng),
            railDouble: type === "railroad",
            utilTen: type === "utility",
          });
        } else {
          this.resolveLanding(playerId, ctx);
        }
        break;
      }
      default:
        finish();
    }
  }

  // —— actions ——

  roll() {
    if (
      this.phase !== "roll" &&
      !(this.phase === "manage" && this.canRollAgain)
    ) {
      return { ok: false, error: "現在不能擲骰" };
    }
    const p = this.current();
    if (p.bankrupt) return { ok: false, error: "已破產" };

    const d1 = rollDie(this.rng);
    const d2 = rollDie(this.rng);
    this.lastDice = [d1, d2];
    const total = d1 + d2;
    const isDouble = d1 === d2;
    this.pushLog(`${p.name} 擲出 ${d1}+${d2}=${total}${isDouble ? "（雙子）" : ""}。`);

    if (isDouble) {
      p.doubles += 1;
      if (p.doubles >= 3) {
        this.pushLog(`${p.name} 連續三次雙子，去坐牢。`);
        this.sendToJail(p.id);
        this.phase = "manage";
        return { ok: true, dice: this.lastDice };
      }
      this.canRollAgain = true;
    } else {
      p.doubles = 0;
      this.canRollAgain = false;
    }

    this.movePlayer(p.id, total);
    this.resolveLanding(p.id, { diceTotal: total });
    return { ok: true, dice: this.lastDice };
  }

  jailPay() {
    if (this.phase !== "jail_turn") return { ok: false, error: "不在獄中回合" };
    const p = this.current();
    if (p.cash < JAIL_FINE) return { ok: false, error: "現金不足" };
    p.cash -= JAIL_FINE;
    p.jail = false;
    p.jailTurns = 0;
    this.pushLog(`${p.name} 繳 ${JAIL_FINE} 元出獄。`);
    this.phase = "roll";
    return { ok: true };
  }

  jailCard() {
    if (this.phase !== "jail_turn") return { ok: false, error: "不在獄中回合" };
    const p = this.current();
    if (p.jailCards < 1) return { ok: false, error: "沒有免費出獄卡" };
    p.jailCards -= 1;
    p.jail = false;
    p.jailTurns = 0;
    this.pushLog(`${p.name} 使用免費出獄卡。`);
    this.phase = "roll";
    return { ok: true };
  }

  jailRoll() {
    if (this.phase !== "jail_turn") return { ok: false, error: "不在獄中回合" };
    const p = this.current();
    const d1 = rollDie(this.rng);
    const d2 = rollDie(this.rng);
    this.lastDice = [d1, d2];
    this.pushLog(`${p.name} 在牢中擲出 ${d1}+${d2}。`);
    if (d1 === d2) {
      p.jail = false;
      p.jailTurns = 0;
      this.canRollAgain = false;
      this.pushLog(`${p.name} 擲出雙子出獄！`);
      this.movePlayer(p.id, d1 + d2);
      this.resolveLanding(p.id, { diceTotal: d1 + d2 });
      return { ok: true };
    }
    p.jailTurns += 1;
    if (p.jailTurns >= 3) {
      const total = d1 + d2;
      if (p.cash < JAIL_FINE) {
        this.pendingJailExit = { playerId: p.id, total };
        this.debt = {
          debtor: p.id,
          creditor: "bank",
          amount: JAIL_FINE,
          reason: "第三回合強制繳費出獄",
        };
        this.phase = "debt";
        this.pushLog(`${p.name} 第三回合必須繳費，現金不足。`);
        return { ok: true };
      }
      p.cash -= JAIL_FINE;
      p.jail = false;
      p.jailTurns = 0;
      this.pushLog(`${p.name} 第三回合繳 ${JAIL_FINE} 元出獄並前進。`);
      this.movePlayer(p.id, total);
      this.resolveLanding(p.id, { diceTotal: total });
      return { ok: true };
    }
    this.phase = "manage";
    this.canRollAgain = false;
    this.pushLog(`${p.name} 繼續坐牢。`);
    return { ok: true };
  }

  buy() {
    if (this.phase !== "buy" || this.pendingBuy == null) {
      return { ok: false, error: "無可購買地產" };
    }
    const p = this.current();
    const id = this.pendingBuy;
    const tile = tileById(id);
    if (p.cash < tile.price) return { ok: false, error: "現金不足" };
    p.cash -= tile.price;
    this.props[id].owner = p.id;
    this.pushLog(`${p.name} 買下「${tile.name}」，花 ${tile.price} 元。`);
    this.pendingBuy = null;
    this.enterManageOrContinue();
    return { ok: true };
  }

  declineBuy() {
    if (this.phase !== "buy" || this.pendingBuy == null) {
      return { ok: false, error: "無可拒絕購買" };
    }
    const id = this.pendingBuy;
    this.pendingBuy = null;
    this.startAuction(id);
    return { ok: true };
  }

  startAuction(tileId) {
    const alive = this.alivePlayers().map((p) => p.id);
    this.auction = {
      tileId,
      highBid: 0,
      highBidder: null,
      turn: alive[0],
      passed: [],
    };
    this.phase = "auction";
    this.pushLog(`「${tileById(tileId).name}」進入拍賣。`);
  }

  auctionBid(amount) {
    if (this.phase !== "auction" || !this.auction) {
      return { ok: false, error: "不在拍賣中" };
    }
    const a = this.auction;
    const p = this.players[a.turn];
    if (p.id !== a.turn) return { ok: false, error: "不是你的出價回合" };
    const bid = Math.floor(Number(amount));
    if (!Number.isFinite(bid) || bid <= a.highBid) {
      return { ok: false, error: `出價須高於 ${a.highBid} 元` };
    }
    if (p.cash < bid) return { ok: false, error: "現金不足" };
    a.highBid = bid;
    a.highBidder = p.id;
    a.passed = [];
    this.pushLog(`${p.name} 出價 ${bid} 元。`);
    this.advanceAuctionTurn();
    return { ok: true };
  }

  auctionPass() {
    if (this.phase !== "auction" || !this.auction) {
      return { ok: false, error: "不在拍賣中" };
    }
    const a = this.auction;
    const p = this.players[a.turn];
    if (!a.passed.includes(p.id)) a.passed.push(p.id);
    this.pushLog(`${p.name} 放棄出價。`);

    const alive = this.alivePlayers().map((x) => x.id);
    if (a.highBidder != null) {
      // everyone except high bidder has passed since last bid
      const others = alive.filter((id) => id !== a.highBidder);
      if (others.every((id) => a.passed.includes(id))) {
        this.finishAuction();
        return { ok: true };
      }
    } else if (alive.every((id) => a.passed.includes(id))) {
      this.pushLog(`無人出價，「${tileById(a.tileId).name}」仍無主。`);
      this.auction = null;
      this.enterManageOrContinue();
      return { ok: true };
    }
    this.advanceAuctionTurn();
    return { ok: true };
  }

  advanceAuctionTurn() {
    const a = this.auction;
    if (!a) return;
    const alive = this.alivePlayers().map((p) => p.id);
    let idx = alive.indexOf(a.turn);
    for (let i = 0; i < alive.length; i++) {
      idx = (idx + 1) % alive.length;
      a.turn = alive[idx];
      // skip if somehow
      break;
    }
  }

  finishAuction() {
    const a = this.auction;
    if (!a || a.highBidder == null) return;
    const p = this.players[a.highBidder];
    const tile = tileById(a.tileId);
    if (p.cash < a.highBid) {
      // shouldn't happen
      this.pushLog(`${p.name} 無力支付得標價，拍賣作廢。`);
      this.auction = null;
      this.enterManageOrContinue();
      return;
    }
    p.cash -= a.highBid;
    this.props[a.tileId].owner = p.id;
    this.pushLog(`${p.name} 以 ${a.highBid} 元得標「${tile.name}」。`);
    this.auction = null;
    this.enterManageOrContinue();
  }

  // —— build / mortgage ——

  groupHouseLevels(group) {
    return (GROUP_TILES[group] || []).map((id) => this.props[id].houses);
  }

  canBuildOn(playerId, tileId) {
    const tile = tileById(tileId);
    if (tile.type !== "property") return { ok: false, error: "不可蓋房" };
    const st = this.props[tileId];
    if (st.owner !== playerId) return { ok: false, error: "不是你的地" };
    if (st.mortgaged) return { ok: false, error: "已抵押" };
    if (!this.ownsGroup(playerId, tile.group)) {
      return { ok: false, error: "未集齊同色組（或組內有抵押）" };
    }
    if (st.houses >= 5) return { ok: false, error: "已是旅館" };
    const levels = this.groupHouseLevels(tile.group);
    const min = Math.min(...levels);
    if (st.houses > min) return { ok: false, error: "須平均蓋房" };
    if (st.houses === 4) {
      if (this.hotelsLeft < 1) return { ok: false, error: "銀行旅館售完" };
    } else if (this.housesLeft < 1) {
      return { ok: false, error: "銀行房屋售完" };
    }
    const p = this.players[playerId];
    if (p.cash < tile.houseCost) return { ok: false, error: "現金不足" };
    return { ok: true };
  }

  build(tileId) {
    if (this.phase !== "manage" && this.phase !== "debt" && this.phase !== "roll") {
      // allow manage primarily; also debt to raise? building spends money — only manage
    }
    if (this.phase !== "manage") return { ok: false, error: "僅在管理階段可蓋房" };
    const p = this.current();
    const check = this.canBuildOn(p.id, tileId);
    if (!check.ok) return check;
    const tile = tileById(tileId);
    const st = this.props[tileId];
    p.cash -= tile.houseCost;
    if (st.houses === 4) {
      this.housesLeft += 4;
      this.hotelsLeft -= 1;
      st.houses = 5;
      this.pushLog(`${p.name} 在「${tile.name}」蓋旅館（${tile.houseCost} 元）。`);
    } else {
      this.housesLeft -= 1;
      st.houses += 1;
      this.pushLog(
        `${p.name} 在「${tile.name}」蓋第 ${st.houses} 棟房屋（${tile.houseCost} 元）。`,
      );
    }
    return { ok: true };
  }

  canSellHouse(playerId, tileId) {
    const tile = tileById(tileId);
    if (tile.type !== "property") return { ok: false, error: "不可賣屋" };
    const st = this.props[tileId];
    if (st.owner !== playerId) return { ok: false, error: "不是你的地" };
    if (st.houses < 1) return { ok: false, error: "沒有房屋" };
    const levels = this.groupHouseLevels(tile.group);
    const max = Math.max(...levels);
    if (st.houses < max) return { ok: false, error: "須平均拆房" };
    if (st.houses === 5 && this.housesLeft < 4) {
      return { ok: false, error: "銀行房屋不足，無法拆旅館" };
    }
    return { ok: true };
  }

  sellHouse(tileId) {
    if (this.phase !== "manage" && this.phase !== "debt") {
      return { ok: false, error: "現在不能賣屋" };
    }
    const actor =
      this.phase === "debt" && this.debt
        ? this.players[this.debt.debtor]
        : this.current();
    const check = this.canSellHouse(actor.id, tileId);
    if (!check.ok) return check;
    const tile = tileById(tileId);
    const st = this.props[tileId];
    const refund = Math.floor(tile.houseCost / 2);
    if (st.houses === 5) {
      this.hotelsLeft += 1;
      this.housesLeft -= 4;
      st.houses = 4;
    } else {
      this.housesLeft += 1;
      st.houses -= 1;
    }
    actor.cash += refund;
    this.pushLog(`${actor.name} 拆「${tile.name}」一棟，收回 ${refund} 元。`);
    if (this.phase === "debt") this.trySettleDebt();
    return { ok: true };
  }

  mortgage(tileId) {
    if (this.phase !== "manage" && this.phase !== "debt") {
      return { ok: false, error: "現在不能抵押" };
    }
    const actor =
      this.phase === "debt" && this.debt
        ? this.players[this.debt.debtor]
        : this.current();
    const tile = tileById(tileId);
    if (!isOwnable(tile)) return { ok: false, error: "不可抵押" };
    const st = this.props[tileId];
    if (st.owner !== actor.id) return { ok: false, error: "不是你的地" };
    if (st.mortgaged) return { ok: false, error: "已抵押" };
    if (tile.type === "property" && st.houses > 0) {
      return { ok: false, error: "請先拆光房屋" };
    }
    // group must have no houses
    if (tile.group) {
      const anyHouses = (GROUP_TILES[tile.group] || []).some(
        (id) => this.props[id].houses > 0,
      );
      if (anyHouses) return { ok: false, error: "同色組仍有房屋" };
    }
    st.mortgaged = true;
    const loan = Math.floor(tile.price / 2);
    actor.cash += loan;
    this.pushLog(`${actor.name} 抵押「${tile.name}」，取得 ${loan} 元。`);
    if (this.phase === "debt") this.trySettleDebt();
    return { ok: true };
  }

  unmortgage(tileId) {
    if (this.phase !== "manage") return { ok: false, error: "僅管理階段可贖回" };
    const p = this.current();
    const tile = tileById(tileId);
    const st = this.props[tileId];
    if (st.owner !== p.id || !st.mortgaged) return { ok: false, error: "無法贖回" };
    const cost = Math.ceil((tile.price / 2) * 1.1);
    if (p.cash < cost) return { ok: false, error: "現金不足" };
    p.cash -= cost;
    st.mortgaged = false;
    this.pushLog(`${p.name} 花 ${cost} 元贖回「${tile.name}」。`);
    return { ok: true };
  }

  declareBankrupt() {
    if (this.phase !== "debt" || !this.debt) {
      return { ok: false, error: "僅欠債時可宣告破產" };
    }
    const { debtor, creditor } = this.debt;
    const p = this.players[debtor];
    this.pushLog(`${p.name} 宣告破產。`);

    // return houses to bank
    for (const t of BOARD) {
      if (t.type !== "property") continue;
      const st = this.props[t.id];
      if (st.owner !== debtor) continue;
      if (st.houses === 5) {
        this.hotelsLeft += 1;
        st.houses = 0;
      } else if (st.houses > 0) {
        this.housesLeft += st.houses;
        st.houses = 0;
      }
    }

    if (creditor === "bank") {
      for (const t of BOARD) {
        if (!isOwnable(t)) continue;
        const st = this.props[t.id];
        if (st.owner === debtor) {
          st.owner = null;
          st.mortgaged = false;
          st.houses = 0;
        }
      }
      p.cash = 0;
      p.jailCards = 0;
    } else {
      const c = this.players[creditor];
      c.cash += p.cash;
      p.cash = 0;
      c.jailCards += p.jailCards;
      p.jailCards = 0;
      for (const t of BOARD) {
        if (!isOwnable(t)) continue;
        const st = this.props[t.id];
        if (st.owner === debtor) {
          st.owner = creditor;
          // mortgaged properties stay mortgaged; creditor may later unmortgage
        }
      }
    }

    p.bankrupt = true;
    p.jail = false;
    this.debt = null;
    this.pendingBuy = null;
    this.auction = null;
    this.trade = null;
    if (this.checkWin()) return { ok: true };
    this.nextTurn();
    return { ok: true };
  }

  // —— trade ——

  /**
   * @param {object} proposal
   */
  proposeTrade(proposal) {
    if (this.phase !== "manage" && this.phase !== "debt") {
      return { ok: false, error: "現在不能交易" };
    }
    const from =
      this.phase === "debt" && this.debt
        ? this.debt.debtor
        : this.current().id;
    const to = proposal.to;
    if (to === from || this.players[to]?.bankrupt) {
      return { ok: false, error: "對手無效" };
    }
    const offerTiles = proposal.offerTiles || [];
    const askTiles = proposal.askTiles || [];
    for (const id of offerTiles) {
      if (this.props[id]?.owner !== from || this.props[id].houses > 0) {
        return { ok: false, error: "出让地產無效（須無房屋）" };
      }
    }
    for (const id of askTiles) {
      if (this.props[id]?.owner !== to || this.props[id].houses > 0) {
        return { ok: false, error: "索取地產無效（須無房屋）" };
      }
    }
    this.trade = {
      from,
      to,
      offerCash: Math.max(0, Math.floor(proposal.offerCash || 0)),
      askCash: Math.max(0, Math.floor(proposal.askCash || 0)),
      offerTiles,
      askTiles,
      offerJail: Math.max(0, Math.floor(proposal.offerJail || 0)),
      askJail: Math.max(0, Math.floor(proposal.askJail || 0)),
    };
    this.pushLog(
      `${this.players[from].name} 向 ${this.players[to].name} 提出交易。`,
    );
    return { ok: true };
  }

  acceptTrade() {
    if (!this.trade) return { ok: false, error: "無待確認交易" };
    const t = this.trade;
    const a = this.players[t.from];
    const b = this.players[t.to];
    if (a.cash < t.offerCash || b.cash < t.askCash) {
      return { ok: false, error: "現金不足" };
    }
    if (a.jailCards < t.offerJail || b.jailCards < t.askJail) {
      return { ok: false, error: "出獄卡不足" };
    }
    a.cash -= t.offerCash;
    b.cash += t.offerCash;
    b.cash -= t.askCash;
    a.cash += t.askCash;
    a.jailCards -= t.offerJail;
    b.jailCards += t.offerJail;
    b.jailCards -= t.askJail;
    a.jailCards += t.askJail;
    for (const id of t.offerTiles) this.props[id].owner = t.to;
    for (const id of t.askTiles) this.props[id].owner = t.from;
    this.pushLog(`交易成交：${a.name} ⇄ ${b.name}。`);
    this.trade = null;
    if (this.phase === "debt") this.trySettleDebt();
    return { ok: true };
  }

  rejectTrade() {
    if (!this.trade) return { ok: false, error: "無待確認交易" };
    this.pushLog(`交易被拒絕。`);
    this.trade = null;
    return { ok: true };
  }
}

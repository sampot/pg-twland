/**
 * Heuristic AI for hot-seat autopilot (託管).
 * Aligned with Taiwan paper rules (no auction).
 * Each step returns `{ ok, action }` so the UI can show what the AI did.
 */

import { BOARD, tileById, isOwnable, GROUP_TILES, JAIL_FINE } from "./board.js";

const CASH_RESERVE = 120;

/**
 * @typedef {{ ok: boolean, action?: string, error?: string }} AiResult
 */

/**
 * @param {import('./engine.js').TwLandGame} game
 * @returns {AiResult | null} null = no AI actor this phase
 */
export function aiStep(game) {
  const actorId = actingPlayerId(game);
  if (actorId == null) return null;
  const p = game.players[actorId];
  if (!p || p.bankrupt || !p.ai) return null;

  switch (game.phase) {
    case "roll":
      return withDice(game, game.roll(), "擲骰");
    case "jail_turn":
      return aiJail(game, p);
    case "buy":
      return aiBuy(game, p);
    case "debt":
      return aiDebt(game, p);
    case "manage":
      return aiManage(game, p);
    default:
      return null;
  }
}

/**
 * Who must act now (may differ from turn owner in debt／trade).
 * @param {import('./engine.js').TwLandGame} game
 */
export function actingPlayerId(game) {
  if (!game || game.phase === "ended" || game.phase === "lobby") return null;
  if (game.trade) return game.trade.to;
  if (game.phase === "debt" && game.debt) return game.debt.debtor;
  return game.turn;
}

/**
 * @param {import('./engine.js').TwLandGame} game
 */
export function needsAiStep(game) {
  const id = actingPlayerId(game);
  if (id == null) return false;
  const p = game.players[id];
  return Boolean(p && p.ai && !p.bankrupt);
}

/**
 * @param {import('./engine.js').TwLandGame} game
 * @param {{ ok: boolean, error?: string, dice?: [number, number] }} result
 * @param {string} fallback
 * @returns {AiResult}
 */
function withDice(game, result, fallback) {
  if (!result.ok) return { ...result, action: fallback };
  const d = result.dice || game.lastDice;
  if (d) {
    const sum = d[0] + d[1];
    const dub = d[0] === d[1] ? "（雙子）" : "";
    return { ok: true, action: `${fallback} ${d[0]}+${d[1]}=${sum}${dub}` };
  }
  return { ok: true, action: fallback };
}

/**
 * @param {import('./engine.js').TwLandGame} game
 * @param {object} p
 * @returns {AiResult}
 */
function aiJail(game, p) {
  // One visible improve step per tick, then exit next tick
  const improved = tryImprove(game, p);
  if (improved) return { ok: true, action: improved };

  if (p.jailCards > 0) {
    const r = game.jailCard();
    return { ...r, action: "使用免費出獄卡" };
  }
  if (p.cash >= JAIL_FINE + CASH_RESERVE) {
    const r = game.jailPay();
    return { ...r, action: `繳 ${JAIL_FINE} 元出獄` };
  }
  return withDice(game, game.jailRoll(), "坐牢中試擲雙子");
}

/**
 * @param {import('./engine.js').TwLandGame} game
 * @param {object} p
 * @returns {AiResult}
 */
function aiBuy(game, p) {
  const id = game.pendingBuy;
  if (id == null) return { ok: false, error: "無可購買地產", action: "購買失敗" };
  const tile = tileById(id);
  const want = shouldBuy(game, p, tile);
  if (want && p.cash >= tile.price) {
    const r = game.buy();
    return { ...r, action: `買下「${tile.name}」（${tile.price} 元）` };
  }
  const r = game.declineBuy();
  return { ...r, action: `不買「${tile.name}」，維持空地` };
}

function shouldBuy(game, p, tile) {
  if (!tile.price || p.cash < tile.price) return false;
  const after = p.cash - tile.price;
  if (after < 50) return false;

  if (tile.type === "railroad") {
    return after >= CASH_RESERVE || countOwned(game, p.id, "railroad") >= 1;
  }
  if (tile.type === "utility") return after >= CASH_RESERVE + 50;

  if (tile.type === "property" && tile.group) {
    const ids = GROUP_TILES[tile.group] || [];
    const owned = ids.filter((tid) => game.props[tid]?.owner === p.id).length;
    if (owned >= 1) return true;
    if (tile.price <= 160 && after >= CASH_RESERVE) return true;
    if (after >= CASH_RESERVE + 80) return true;
    return false;
  }
  return after >= CASH_RESERVE;
}

function countOwned(game, playerId, type) {
  return BOARD.filter(
    (t) => t.type === type && game.props[t.id]?.owner === playerId,
  ).length;
}

/**
 * @param {import('./engine.js').TwLandGame} game
 * @param {object} p
 * @returns {AiResult}
 */
function aiDebt(game, p) {
  const withHouses = BOARD.filter((t) => {
    if (t.type !== "property") return false;
    const st = game.props[t.id];
    return st?.owner === p.id && st.houses > 0;
  });
  withHouses.sort(
    (a, b) => (game.props[b.id].houses || 0) - (game.props[a.id].houses || 0),
  );
  for (const t of withHouses) {
    const before = game.props[t.id].houses;
    const r = game.sellHouse(t.id);
    if (r.ok) {
      const label = before === 5 ? "拆旅館為 4 房" : "拆一棟房屋";
      return { ok: true, action: `欠債籌款：${label}（${t.name}）` };
    }
  }

  const mortgagable = BOARD.filter((t) => {
    if (!isOwnable(t)) return false;
    const st = game.props[t.id];
    return (
      st?.owner === p.id &&
      !st.mortgaged &&
      (t.type !== "property" || st.houses === 0)
    );
  }).sort((a, b) => (a.price || 0) - (b.price || 0));

  for (const t of mortgagable) {
    const r = game.mortgage(t.id);
    if (r.ok) {
      return { ok: true, action: `欠債籌款：抵押「${t.name}」` };
    }
  }

  const r = game.declareBankrupt();
  return { ...r, action: "宣告破產" };
}

/**
 * @param {import('./engine.js').TwLandGame} game
 * @param {object} p
 * @returns {AiResult | null}
 */
function aiManage(game, p) {
  if (game.trade) {
    if (game.trade.to === p.id) {
      const r = game.rejectTrade();
      return { ...r, action: "拒絕交易提案" };
    }
    return null;
  }

  const improved = tryImprove(game, p);
  if (improved) return { ok: true, action: improved };

  if (game.canRollAgain) {
    return withDice(game, game.roll(), "雙子再擲");
  }
  const r = game.endTurn();
  return { ...r, action: "結束回合" };
}

/**
 * @param {import('./engine.js').TwLandGame} game
 * @param {object} p
 * @returns {string | null}
 */
function tryImprove(game, p) {
  if (p.cash > CASH_RESERVE + 200) {
    const mort = BOARD.filter((t) => {
      const st = game.props[t.id];
      return isOwnable(t) && st?.owner === p.id && st.mortgaged;
    }).sort((a, b) => (a.price || 0) - (b.price || 0));
    for (const t of mort) {
      const cost = Math.ceil(((t.price || 0) / 2) * 1.1);
      if (p.cash - cost < CASH_RESERVE) break;
      const r = game.unmortgage(t.id);
      if (r.ok) return `贖回「${t.name}」（${cost} 元）`;
    }
  }

  if (p.cash < CASH_RESERVE + 100) return null;
  for (const group of Object.keys(GROUP_TILES)) {
    const ids = GROUP_TILES[group];
    if (
      !ids.every(
        (id) => game.props[id]?.owner === p.id && !game.props[id].mortgaged,
      )
    ) {
      continue;
    }
    const levels = ids.map((id) => game.props[id].houses);
    const min = Math.min(...levels);
    if (min >= 5) continue;
    const targetId = ids.find((id) => game.props[id].houses === min);
    if (targetId == null) continue;
    const check = game.canBuildOn(p.id, targetId);
    if (!check.ok) continue;
    const tile = tileById(targetId);
    if (p.cash - tile.houseCost < CASH_RESERVE) continue;
    const before = game.props[targetId].houses;
    const r = game.build(targetId);
    if (!r.ok) continue;
    if (before === 4) return `在「${tile.name}」蓋旅館`;
    return `在「${tile.name}」蓋第 ${before + 1} 棟房屋`;
  }
  return null;
}

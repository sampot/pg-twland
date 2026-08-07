/**
 * Heuristic AI for hot-seat autopilot (託管).
 * Not optimal — enough to finish games and cover phases.
 */

import { BOARD, tileById, isOwnable, GROUP_TILES, JAIL_FINE } from "./board.js";

const CASH_RESERVE = 120;

/**
 * @param {import('./engine.js').TwLandGame} game
 * @returns {{ ok: boolean, error?: string } | null} null = no AI actor this phase
 */
export function aiStep(game) {
  const actorId = actingPlayerId(game);
  if (actorId == null) return null;
  const p = game.players[actorId];
  if (!p || p.bankrupt || !p.ai) return null;

  switch (game.phase) {
    case "roll":
      return game.roll();
    case "jail_turn":
      return aiJail(game, p);
    case "buy":
      return aiBuy(game, p);
    case "auction":
      return aiAuction(game, p);
    case "debt":
      return aiDebt(game, p);
    case "manage":
      return aiManage(game, p);
    default:
      return null;
  }
}

/**
 * Who must act now (may differ from turn owner in auction／debt／trade).
 * @param {import('./engine.js').TwLandGame} game
 */
export function actingPlayerId(game) {
  if (!game || game.phase === "ended" || game.phase === "lobby") return null;
  if (game.trade) return game.trade.to;
  if (game.phase === "auction" && game.auction) return game.auction.turn;
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

function aiJail(game, p) {
  if (p.jailCards > 0) return game.jailCard();
  if (p.cash >= JAIL_FINE + CASH_RESERVE) return game.jailPay();
  return game.jailRoll();
}

function aiBuy(game, p) {
  const id = game.pendingBuy;
  if (id == null) return { ok: false, error: "無可購買地產" };
  const tile = tileById(id);
  const want = shouldBuy(game, p, tile);
  if (want && p.cash >= tile.price) return game.buy();
  return game.declineBuy();
}

function shouldBuy(game, p, tile) {
  if (!tile.price || p.cash < tile.price) return false;
  const after = p.cash - tile.price;
  if (after < 50) return false;

  if (tile.type === "railroad") return after >= CASH_RESERVE || countOwned(game, p.id, "railroad") >= 1;
  if (tile.type === "utility") return after >= CASH_RESERVE + 50;

  if (tile.type === "property" && tile.group) {
    const ids = GROUP_TILES[tile.group] || [];
    const owned = ids.filter((tid) => game.props[tid]?.owner === p.id).length;
    if (owned >= 1) return true; // chase monopoly
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

function aiAuction(game, p) {
  const a = game.auction;
  if (!a) return { ok: false, error: "不在拍賣中" };
  const tile = tileById(a.tileId);

  // Already winning — pass to let auction close when others pass.
  if (a.highBidder === p.id) return game.auctionPass();

  const maxBid = maxWillingBid(game, p, tile);
  const next = a.highBid + Math.max(10, Math.floor((tile.price || 100) * 0.05));
  if (next <= maxBid && p.cash >= next) {
    return game.auctionBid(next);
  }
  return game.auctionPass();
}

function maxWillingBid(game, p, tile) {
  if (!tile.price) return 0;
  let cap = Math.floor(tile.price * 0.85);
  if (tile.type === "property" && tile.group) {
    const ids = GROUP_TILES[tile.group] || [];
    const owned = ids.filter((tid) => game.props[tid]?.owner === p.id).length;
    if (owned >= 1) cap = Math.floor(tile.price * 1.15);
  }
  if (tile.type === "railroad" && countOwned(game, p.id, "railroad") >= 1) {
    cap = Math.floor(tile.price * 1.1);
  }
  return Math.min(cap, Math.max(0, p.cash - CASH_RESERVE));
}

function aiDebt(game, p) {
  // Prefer selling hotels/houses, then mortgage cheap tiles, else bankrupt.
  const withHouses = BOARD.filter((t) => {
    if (t.type !== "property") return false;
    const st = game.props[t.id];
    return st?.owner === p.id && st.houses > 0;
  });
  // Sell from highest house count groups (engine enforces even sell)
  withHouses.sort(
    (a, b) => (game.props[b.id].houses || 0) - (game.props[a.id].houses || 0),
  );
  for (const t of withHouses) {
    const r = game.sellHouse(t.id);
    if (r.ok) return r;
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
    if (r.ok) return r;
  }

  return game.declareBankrupt();
}

function aiManage(game, p) {
  if (game.trade) {
    // Simple: never accept trades offered to AI
    if (game.trade.to === p.id) return game.rejectTrade();
    return null;
  }

  // Light build / unmortgage then continue turn
  tryImprove(game, p);

  if (game.canRollAgain) return game.roll();
  return game.endTurn();
}

function tryImprove(game, p) {
  // Unmortgage if flush
  if (p.cash > CASH_RESERVE + 200) {
    const mort = BOARD.filter((t) => {
      const st = game.props[t.id];
      return isOwnable(t) && st?.owner === p.id && st.mortgaged;
    }).sort((a, b) => (a.price || 0) - (b.price || 0));
    for (const t of mort) {
      const cost = Math.ceil(((t.price || 0) / 2) * 1.1);
      if (p.cash - cost < CASH_RESERVE) break;
      const r = game.unmortgage(t.id);
      if (r.ok) return;
    }
  }

  // Build one house if monopoly and cash allows
  if (p.cash < CASH_RESERVE + 100) return;
  for (const group of Object.keys(GROUP_TILES)) {
    const ids = GROUP_TILES[group];
    if (!ids.every((id) => game.props[id]?.owner === p.id && !game.props[id].mortgaged)) {
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
    game.build(targetId);
    return;
  }
}

import { BOARD, GROUP_COLOR, tileById, isOwnable } from "./board.js";
import { TwLandGame } from "./engine.js";

/** @type {TwLandGame | null} */
let game = null;

const lobbyEl = document.getElementById("lobby");
const gameEl = document.getElementById("game");
const nameFields = document.getElementById("name-fields");
const playerCountSel = document.getElementById("player-count");
const boardEl = document.getElementById("board");
const playersEl = document.getElementById("players");
const actionsEl = document.getElementById("actions");
const promptEl = document.getElementById("prompt");
const phaseLabel = document.getElementById("phase-label");
const diceLabel = document.getElementById("dice-label");
const stockLabel = document.getElementById("stock-label");
const logEl = document.getElementById("log");
const sheetEl = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetBody = document.getElementById("sheet-body");
const sheetActions = document.getElementById("sheet-actions");

const TOKEN_COLORS = [
  "var(--token-0)",
  "var(--token-1)",
  "var(--token-2)",
  "var(--token-3)",
];

const PHASE_ZH = {
  lobby: "開局",
  roll: "擲骰",
  jail_turn: "坐牢",
  buy: "購買",
  auction: "拍賣",
  debt: "欠債",
  manage: "管理",
  trade: "交易",
  ended: "終局",
};

/** Board CSS grid positions: classic ring, bottom-left = GO (0) */
function cellGridPos(id) {
  // 0 at bottom-left corner of 11x11 outer ring
  if (id >= 0 && id <= 10) {
    // bottom row rightward? Classic: GO bottom-left, then go clockwise.
    // Visual: bottom edge left→right = 0..10
    return { col: id + 1, row: 11 };
  }
  if (id >= 11 && id <= 20) {
    // left edge going up: 11 above GO ... 20 top-left
    // id 10 is jail at bottom-left... wait.
    // Standard Monopoly visual (GO bottom-right in some, bottom-left in others).
    // Use: GO bottom-left (0), along bottom to jail (10) at bottom-right,
    // up left side? No — clockwise from GO bottom-left goes UP the left side in some boards.
    // Classic published board: GO is bottom-RIGHT. Let's use:
    // GO bottom-left for mobile reading of Taiwan names LTR along bottom.
    // Path: bottom L→R (0-10), right R bottom→top (11-20), top R→L (21-30), left top→bottom (31-39 back to 0).
    return { col: 11, row: 11 - (id - 10) };
  }
  if (id >= 21 && id <= 30) {
    return { col: 11 - (id - 20), row: 1 };
  }
  // 31-39
  return { col: 1, row: id - 29 };
}

function money(n) {
  return `${n.toLocaleString("zh-Hant")} 元`;
}

function closeSheet() {
  sheetEl.hidden = true;
  sheetTitle.textContent = "";
  sheetBody.innerHTML = "";
  sheetActions.innerHTML = "";
}

/**
 * @param {string} title
 * @param {string|HTMLElement} body
 * @param {{label:string, className?:string, onClick:()=>void}[]} buttons
 */
function openSheet(title, body, buttons) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = "";
  if (typeof body === "string") {
    sheetBody.innerHTML = body;
  } else {
    sheetBody.appendChild(body);
  }
  sheetActions.innerHTML = "";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = b.label;
    btn.className = b.className || "secondary";
    btn.addEventListener("click", b.onClick);
    sheetActions.appendChild(btn);
  }
  sheetEl.hidden = false;
}

function renderNameFields() {
  const n = Number(playerCountSel.value);
  nameFields.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const label = document.createElement("label");
    label.className = "field";
    label.innerHTML = `<span>玩家 ${i + 1} 暱稱</span>`;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 12;
    input.placeholder = `玩家 ${i + 1}`;
    input.dataset.idx = String(i);
    input.autocomplete = "nickname";
    label.appendChild(input);
    nameFields.appendChild(label);
  }
}

function buildBoardShell() {
  boardEl.innerHTML = "";
  const center = document.createElement("div");
  center.className = "cell center-slot";
  center.textContent = "台灣路名地產";
  center.style.gridColumn = "2 / 11";
  center.style.gridRow = "2 / 11";
  boardEl.appendChild(center);

  for (const tile of BOARD) {
    const pos = cellGridPos(tile.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell" + (tile.type === "go" || tile.type === "jail" || tile.type === "parking" || tile.type === "gotojail" ? " corner" : "");
    btn.dataset.id = String(tile.id);
    btn.style.gridColumn = String(pos.col);
    btn.style.gridRow = String(pos.row);
    btn.addEventListener("click", () => showTileDetail(tile.id));
    boardEl.appendChild(btn);
  }
}

function showTileDetail(id) {
  if (!game) return;
  const tile = tileById(id);
  const st = game.props[id];
  const parts = [`<p><strong>${tile.name}</strong></p>`];
  if (tile.price != null) parts.push(`<p>價格：${money(tile.price)}</p>`);
  if (tile.type === "property" && tile.rent) {
    parts.push(
      `<p>租金：空地 ${tile.rent[0]}／1房 ${tile.rent[1]}／2房 ${tile.rent[2]}／3房 ${tile.rent[3]}／4房 ${tile.rent[4]}／旅館 ${tile.rent[5]}</p>`,
    );
    parts.push(`<p>每棟房／旅館造價：${money(tile.houseCost)}</p>`);
  }
  if (tile.type === "railroad") {
    parts.push(`<p>租金：1站 25／2站 50／3站 100／4站 200</p>`);
  }
  if (tile.type === "utility") {
    parts.push(`<p>租金：1間×4、2間×10（乘骰子點數）</p>`);
  }
  if (tile.type === "tax") parts.push(`<p>稅額：${money(tile.tax)}</p>`);
  if (st) {
    const owner =
      st.owner == null ? "無主" : game.players[st.owner].name;
    parts.push(`<p>擁有者：${owner}</p>`);
    if (tile.type === "property") {
      parts.push(
        `<p>建築：${st.houses === 5 ? "旅館" : st.houses + " 棟房屋"}${st.mortgaged ? "（已抵押）" : ""}</p>`,
      );
    } else if (st.mortgaged) {
      parts.push(`<p>狀態：已抵押</p>`);
    }
  }
  openSheet(tile.name, parts.join(""), [
    { label: "關閉", className: "secondary", onClick: closeSheet },
  ]);
}

function paintBoard() {
  if (!game) return;
  for (const tile of BOARD) {
    const el = boardEl.querySelector(`[data-id="${tile.id}"]`);
    if (!el) continue;
    const st = game.props[tile.id];
    let sub = "";
    if (tile.price != null) sub = money(tile.price);
    if (tile.type === "tax") sub = money(tile.tax);
    if (st?.houses) {
      sub = st.houses === 5 ? "旅館" : `房×${st.houses}`;
    }
    if (st?.mortgaged) sub = "抵押";

    const swatch =
      tile.group && GROUP_COLOR[tile.group]
        ? `<span class="swatch" style="background:${GROUP_COLOR[tile.group]}"></span>`
        : "";

    const tokens = game.players
      .filter((p) => !p.bankrupt && p.pos === tile.id)
      .map(
        (p) =>
          `<span style="background:${TOKEN_COLORS[p.id]}" title="${p.name}"></span>`,
      )
      .join("");

    el.innerHTML = `${swatch}<div class="name">${tile.name}</div><div class="sub">${sub}</div><div class="tokens">${tokens}</div>`;
  }
}

function paintPlayers() {
  if (!game) return;
  playersEl.innerHTML = "";
  for (const p of game.players) {
    const owned = BOARD.filter(
      (t) => isOwnable(t) && game.props[t.id].owner === p.id,
    ).length;
    const card = document.createElement("div");
    card.className =
      "player-card" +
      (p.id === game.turn && game.phase !== "ended" ? " active" : "") +
      (p.bankrupt ? " broke" : "");
    card.innerHTML = `
      <span class="token" style="background:${TOKEN_COLORS[p.id]}"></span>
      <div>
        <strong>${p.name}</strong>
        <div class="meta">${p.bankrupt ? "已破產" : p.jail ? "坐牢中" : `位置：${tileById(p.pos).name}`} · 地產 ${owned} · 出獄卡 ${p.jailCards}</div>
      </div>
      <strong>${p.bankrupt ? "—" : money(p.cash)}</strong>
    `;
    playersEl.appendChild(card);
  }
}

function paintLog() {
  if (!game) return;
  logEl.innerHTML = game.log.map((l) => `<li>${l}</li>`).join("");
}

function setPrompt(text) {
  promptEl.textContent = text;
}

function btn(label, className, onClick, disabled = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.className = className;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function afterAct(result) {
  if (result && result.ok === false) {
    setPrompt(result.error || "無法執行");
    return;
  }
  render();
}

function ownedTiles(playerId, { bareOnly = false } = {}) {
  return BOARD.filter((t) => {
    const st = game.props[t.id];
    if (!isOwnable(t) || st.owner !== playerId) return false;
    if (bareOnly && t.type === "property" && st.houses > 0) return false;
    return true;
  });
}

function openManageSheet() {
  const p = game.current();
  const wrap = document.createElement("div");
  wrap.className = "tile-list";
  const tiles = ownedTiles(p.id);
  if (!tiles.length) {
    wrap.innerHTML = "<p>尚無地產。</p>";
  }
  for (const t of tiles) {
    const st = game.props[t.id];
    const row = document.createElement("div");
    row.className = "tile-row";
    const info = document.createElement("div");
    info.style.flex = "1";
    info.innerHTML = `<strong>${t.name}</strong><div class="meta">${st.mortgaged ? "已抵押" : st.houses === 5 ? "旅館" : st.houses ? `房×${st.houses}` : "空地"}</div>`;
    row.appendChild(info);

    if (t.type === "property" && !st.mortgaged) {
      row.appendChild(
        btn("蓋", "secondary", () => {
          afterAct(game.build(t.id));
          closeSheet();
        }),
      );
      if (st.houses > 0) {
        row.appendChild(
          btn("拆", "secondary", () => {
            afterAct(game.sellHouse(t.id));
            closeSheet();
          }),
        );
      }
    }
    if (!st.mortgaged && (t.type !== "property" || st.houses === 0)) {
      row.appendChild(
        btn("抵押", "secondary", () => {
          afterAct(game.mortgage(t.id));
          closeSheet();
        }),
      );
    }
    if (st.mortgaged) {
      row.appendChild(
        btn("贖回", "secondary", () => {
          afterAct(game.unmortgage(t.id));
          closeSheet();
        }),
      );
    }
    wrap.appendChild(row);
  }
  openSheet(`${p.name} · 地產管理`, wrap, [
    { label: "關閉", onClick: closeSheet },
  ]);
}

function openDebtSheet() {
  const d = game.debt;
  if (!d) return;
  const p = game.players[d.debtor];
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p>尚欠 <strong>${money(d.amount)}</strong>（${d.reason}）。目前現金 ${money(p.cash)}。</p>`;
  const list = document.createElement("div");
  list.className = "tile-list";
  for (const t of ownedTiles(p.id)) {
    const st = game.props[t.id];
    const row = document.createElement("div");
    row.className = "tile-row";
    row.innerHTML = `<div style="flex:1"><strong>${t.name}</strong></div>`;
    if (t.type === "property" && st.houses > 0) {
      row.appendChild(
        btn("拆屋", "secondary", () => {
          afterAct(game.sellHouse(t.id));
          if (game.debt) openDebtSheet();
          else closeSheet();
        }),
      );
    } else if (!st.mortgaged) {
      row.appendChild(
        btn("抵押", "secondary", () => {
          afterAct(game.mortgage(t.id));
          if (game.debt) openDebtSheet();
          else closeSheet();
        }),
      );
    }
    list.appendChild(row);
  }
  wrap.appendChild(list);
  openSheet("籌款還債", wrap, [
    {
      label: "提出交易",
      className: "secondary",
      onClick: () => {
        closeSheet();
        openTradeSheet(true);
      },
    },
    {
      label: "宣告破產",
      className: "danger",
      onClick: () => {
        closeSheet();
        afterAct(game.declareBankrupt());
      },
    },
    { label: "關閉", onClick: closeSheet },
  ]);
}

function openTradeSheet(fromDebt = false) {
  const from =
    fromDebt && game.debt ? game.debt.debtor : game.current().id;
  const others = game.alivePlayers().filter((p) => p.id !== from);
  const wrap = document.createElement("div");
  wrap.className = "trade-grid";

  const partnerLabel = document.createElement("label");
  partnerLabel.className = "field";
  partnerLabel.innerHTML = "<span>交易對象</span>";
  const partnerSel = document.createElement("select");
  for (const o of others) {
    const opt = document.createElement("option");
    opt.value = String(o.id);
    opt.textContent = o.name;
    partnerSel.appendChild(opt);
  }
  partnerLabel.appendChild(partnerSel);
  wrap.appendChild(partnerLabel);

  const offerCash = document.createElement("input");
  offerCash.type = "number";
  offerCash.min = "0";
  offerCash.value = "0";
  const askCash = document.createElement("input");
  askCash.type = "number";
  askCash.min = "0";
  askCash.value = "0";

  const mkCash = (label, input) => {
    const l = document.createElement("label");
    l.className = "field";
    l.innerHTML = `<span>${label}</span>`;
    l.appendChild(input);
    return l;
  };
  wrap.appendChild(mkCash("你付出現金", offerCash));
  wrap.appendChild(mkCash("對方付出現金", askCash));

  const offerJail = document.createElement("input");
  offerJail.type = "number";
  offerJail.min = "0";
  offerJail.value = "0";
  const askJail = document.createElement("input");
  askJail.type = "number";
  askJail.min = "0";
  askJail.value = "0";
  wrap.appendChild(mkCash("你付出出獄卡", offerJail));
  wrap.appendChild(mkCash("對方付出出獄卡", askJail));

  /** @type {Set<number>} */
  const offerSet = new Set();
  /** @type {Set<number>} */
  const askSet = new Set();

  const offerList = document.createElement("div");
  offerList.className = "tile-list";
  offerList.innerHTML = "<h3>你出让的地（無房屋）</h3>";
  for (const t of ownedTiles(from, { bareOnly: true })) {
    const row = document.createElement("label");
    row.className = "tile-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      if (cb.checked) offerSet.add(t.id);
      else offerSet.delete(t.id);
    });
    row.appendChild(cb);
    row.appendChild(document.createTextNode(t.name));
    offerList.appendChild(row);
  }
  wrap.appendChild(offerList);

  const askList = document.createElement("div");
  askList.className = "tile-list";
  askList.innerHTML = "<h3>你索取的地</h3>";
  const refreshAsk = () => {
    askList.querySelectorAll("label.tile-row").forEach((n) => n.remove());
    askSet.clear();
    const to = Number(partnerSel.value);
    for (const t of ownedTiles(to, { bareOnly: true })) {
      const row = document.createElement("label");
      row.className = "tile-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("change", () => {
        if (cb.checked) askSet.add(t.id);
        else askSet.delete(t.id);
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(t.name));
      askList.appendChild(row);
    }
  };
  partnerSel.addEventListener("change", refreshAsk);
  refreshAsk();
  wrap.appendChild(askList);

  openSheet("提出交易", wrap, [
    {
      label: "送出提案",
      className: "primary",
      onClick: () => {
        const result = game.proposeTrade({
          to: Number(partnerSel.value),
          offerCash: Number(offerCash.value),
          askCash: Number(askCash.value),
          offerTiles: [...offerSet],
          askTiles: [...askSet],
          offerJail: Number(offerJail.value),
          askJail: Number(askJail.value),
        });
        closeSheet();
        afterAct(result);
      },
    },
    { label: "取消", onClick: closeSheet },
  ]);
}

function paintActions() {
  if (!game) return;
  actionsEl.innerHTML = "";
  const phase = game.phase;
  const p = game.current();

  if (phase === "ended") {
    const w = game.players[game.winnerId];
    setPrompt(`${w.name} 贏得這局！`);
    actionsEl.appendChild(
      btn("再來一局", "primary", () => {
        lobbyEl.hidden = false;
        gameEl.hidden = true;
        game = null;
        closeSheet();
      }),
    );
    return;
  }

  if (phase === "roll") {
    setPrompt(`輪到 ${p.name}：請擲骰。`);
    actionsEl.appendChild(btn("擲骰", "primary", () => afterAct(game.roll())));
    return;
  }

  if (phase === "jail_turn") {
    setPrompt(`${p.name} 在坐牢：繳費、用卡或試擲雙子。`);
    actionsEl.appendChild(btn("繳 50 元出獄", "primary", () => afterAct(game.jailPay())));
    actionsEl.appendChild(
      btn("用出獄卡", "secondary", () => afterAct(game.jailCard()), p.jailCards < 1),
    );
    actionsEl.appendChild(btn("試擲雙子", "secondary", () => afterAct(game.jailRoll())));
    return;
  }

  if (phase === "buy") {
    const tile = tileById(game.pendingBuy);
    setPrompt(`${p.name} 可買「${tile.name}」（${money(tile.price)}），或拒絕進入拍賣。`);
    actionsEl.appendChild(
      btn(`買下（${money(tile.price)}）`, "primary", () => afterAct(game.buy()), p.cash < tile.price),
    );
    actionsEl.appendChild(btn("不買，拍賣", "secondary", () => afterAct(game.declineBuy())));
    return;
  }

  if (phase === "auction") {
    const a = game.auction;
    const tile = tileById(a.tileId);
    const bidder = game.players[a.turn];
    setPrompt(
      `拍賣「${tile.name}」· 最高 ${money(a.highBid)}${a.highBidder != null ? `（${game.players[a.highBidder].name}）` : ""} · 輪到 ${bidder.name}`,
    );
    actionsEl.appendChild(
      btn("出價", "primary", () => {
        const wrap = document.createElement("div");
        const input = document.createElement("input");
        input.type = "number";
        input.min = String(a.highBid + 1);
        input.value = String(a.highBid + 10);
        const lab = document.createElement("label");
        lab.className = "field";
        lab.innerHTML = "<span>出價金額</span>";
        lab.appendChild(input);
        wrap.appendChild(lab);
        openSheet("拍賣出價", wrap, [
          {
            label: "確認出價",
            className: "primary",
            onClick: () => {
              const r = game.auctionBid(input.value);
              closeSheet();
              afterAct(r);
            },
          },
          { label: "取消", onClick: closeSheet },
        ]);
      }),
    );
    actionsEl.appendChild(btn("放棄", "secondary", () => afterAct(game.auctionPass())));
    return;
  }

  if (phase === "debt") {
    const d = game.debt;
    const debtor = game.players[d.debtor];
    setPrompt(
      `${debtor.name} 欠 ${money(d.amount)}（${d.reason}）。請抵押／拆屋／交易，或宣告破產。`,
    );
    actionsEl.appendChild(btn("籌款…", "primary", () => openDebtSheet()));
    actionsEl.appendChild(btn("交易…", "secondary", () => openTradeSheet(true)));
    actionsEl.appendChild(
      btn("宣告破產", "danger", () => afterAct(game.declareBankrupt())),
    );
    return;
  }

  if (phase === "manage") {
    if (game.trade) {
      const t = game.trade;
      setPrompt(
        `${game.players[t.from].name} 向 ${game.players[t.to].name} 提出交易，請 ${game.players[t.to].name} 確認。`,
      );
      actionsEl.appendChild(btn("接受交易", "primary", () => afterAct(game.acceptTrade())));
      actionsEl.appendChild(btn("拒絕交易", "danger", () => afterAct(game.rejectTrade())));
      return;
    }
    if (game.canRollAgain) {
      setPrompt(`${p.name} 擲出雙子：可先管理地產，或再擲一次。`);
      actionsEl.appendChild(btn("再擲一次", "primary", () => afterAct(game.roll())));
      actionsEl.appendChild(btn("地產管理", "secondary", () => openManageSheet()));
      actionsEl.appendChild(btn("交易", "secondary", () => openTradeSheet(false)));
      return;
    }
    setPrompt(`${p.name} 可蓋房、抵押、交易，或結束回合。`);
    actionsEl.appendChild(btn("地產管理", "secondary", () => openManageSheet()));
    actionsEl.appendChild(btn("交易", "secondary", () => openTradeSheet(false)));
    actionsEl.appendChild(btn("結束回合", "primary", () => afterAct(game.endTurn())));
  }
}

function render() {
  if (!game) return;
  const snap = game.snapshot();
  phaseLabel.textContent = PHASE_ZH[snap.phase] || snap.phase;
  diceLabel.textContent = snap.lastDice
    ? `${snap.lastDice[0]} + ${snap.lastDice[1]}`
    : "—";
  stockLabel.textContent = `${snap.housesLeft}／${snap.hotelsLeft}`;
  paintBoard();
  paintPlayers();
  paintLog();
  paintActions();
}

document.getElementById("btn-start").addEventListener("click", () => {
  const n = Number(playerCountSel.value);
  const inputs = [...nameFields.querySelectorAll("input")];
  const names = inputs.map((el, i) => el.value.trim() || `玩家 ${i + 1}`);
  game = new TwLandGame({ playerCount: n, names });
  game.start();
  lobbyEl.hidden = true;
  gameEl.hidden = false;
  closeSheet();
  render();
});

document.getElementById("btn-new").addEventListener("click", () => {
  lobbyEl.hidden = false;
  gameEl.hidden = true;
  game = null;
  closeSheet();
});

playerCountSel.addEventListener("change", renderNameFields);
sheetEl.addEventListener("click", (e) => {
  if (e.target === sheetEl) closeSheet();
});

renderNameFields();
buildBoardShell();

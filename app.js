import { BOARD, GROUP_COLOR, tileById, isOwnable } from "./board.js";
import { TwLandGame } from "./engine.js";
import { aiStep, needsAiStep, actingPlayerId } from "./ai.js";

/** @type {TwLandGame | null} */
let game = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let aiTimer = null;
const AI_STEP_MS = 700;
/** Latest AI action line for the prompt (cleared when humans act). */
let lastAiBanner = "";
/** @type {[number, number] | null} */
let lastPaintedDice = null;
/** @type {Map<number, number>} */
const prevPlayerPos = new Map();
/** True while card reveal / dice spin blocks AI autopilot. */
let fxBusy = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let cardRevealTimer = null;
let diceSpinning = false;

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
const toastHost = document.getElementById("toast-host");
const cardRevealEl = document.getElementById("card-reveal");
const cardRevealKicker = document.getElementById("card-reveal-kicker");
const cardRevealTitle = document.getElementById("card-reveal-title");
const cardRevealText = document.getElementById("card-reveal-text");

const TOKEN_COLORS = [
  "var(--token-0)",
  "var(--token-1)",
  "var(--token-2)",
  "var(--token-3)",
];

/** Seat piece: Taiwan-flavored silhouettes (color + shape). */
const TOKEN_META = [
  { id: "scooter", label: "機車" },
  { id: "boba", label: "珍奶" },
  { id: "mrt", label: "捷運" },
  { id: "lantern", label: "燈籠" },
];

/**
 * @param {number} playerId
 * @param {{ size?: number, title?: string, className?: string }} [opts]
 */
function tokenMarkup(playerId, opts = {}) {
  const meta = TOKEN_META[playerId % TOKEN_META.length];
  const color = TOKEN_COLORS[playerId % TOKEN_COLORS.length];
  const size = opts.size ?? 22;
  const title = opts.title ?? meta.label;
  const cls = ["piece", `piece--${meta.id}`, opts.className].filter(Boolean).join(" ");
  const svg = tokenSvgPath(meta.id);
  return `<span class="${cls}" style="--piece:${color}" title="${escapeAttr(title)}" role="img" aria-label="${escapeAttr(title)}"><svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${svg}</svg></span>`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Inline SVG paths — filled with currentColor via CSS. */
function tokenSvgPath(id) {
  switch (id) {
    case "scooter":
      return `
        <g stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8.6" cy="23.2" r="3.9" fill="none" stroke="currentColor" stroke-width="2.15"/>
          <circle cx="8.6" cy="23.2" r="1.35" fill="currentColor"/>
          <circle cx="23.4" cy="23.2" r="3.9" fill="none" stroke="currentColor" stroke-width="2.15"/>
          <circle cx="23.4" cy="23.2" r="1.35" fill="currentColor"/>
          <path fill="currentColor" d="M12.2 22.6h8.6l1.35-6.5H14.6c-.75 0-1.4.45-1.65 1.15L12.2 22.6z"/>
          <path fill="currentColor" d="M14.8 16h10.2l.85-2.55c.2-.6-.25-1.2-.9-1.2H18.1c-.55 0-1.05.35-1.25.85L14.8 16z"/>
          <path fill="currentColor" d="M22.4 12.25h2.55V8.6c0-.7-.55-1.25-1.25-1.25h-.55c-.4 0-.75.35-.75.75v4.15z"/>
          <path fill="currentColor" d="M11 18.7 8.1 15.2c-.3-.4-.1-1 .4-1.2l1.75-.55c.4-.12.85.1 1.05.5l1.55 3.35-1.85 1.4z"/>
          <path fill="none" stroke="currentColor" stroke-width="1.5" d="M16.2 16.1v3.4"/>
        </g>`;
    case "boba":
      return `
        <path fill="currentColor" d="M10.3 10.8h11.4l-1.15 15.4c-.12 1.25-1.15 2.2-2.4 2.2h-4.1c-1.25 0-2.28-.95-2.4-2.2L10.3 10.8z"/>
        <path fill="currentColor" opacity=".28" d="M11.1 10.8h9.8l-.28 3.4H11.4L11.1 10.8z"/>
        <rect x="14.6" y="3.2" width="2.8" height="8.2" rx="1.3" fill="currentColor"/>
        <ellipse cx="16" cy="3.6" rx="1.55" ry=".7" fill="currentColor"/>
        <circle cx="13.1" cy="22.4" r="1.4" fill="var(--piece-bubble)"/>
        <circle cx="16.6" cy="24.3" r="1.4" fill="var(--piece-bubble)"/>
        <circle cx="19.3" cy="22.6" r="1.35" fill="var(--piece-bubble)"/>
        <circle cx="15.1" cy="20.1" r="1.2" fill="var(--piece-bubble)"/>
        <circle cx="18" cy="20.6" r="1.05" fill="var(--piece-bubble)"/>
        <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M10 10.9h12"/>`;
    case "mrt":
      return `
        <path fill="currentColor" d="M11.6 5.8h8.8l1.7 3.1H9.9L11.6 5.8z"/>
        <rect x="14.4" y="3.5" width="3.2" height="2.5" rx=".7" fill="currentColor"/>
        <rect x="5.6" y="8.9" width="20.8" height="13.4" rx="3.4" fill="currentColor"/>
        <rect x="7.8" y="11" width="5.4" height="4.4" rx="1.1" fill="var(--piece-window)"/>
        <rect x="14.3" y="11" width="5.4" height="4.4" rx="1.1" fill="var(--piece-window)"/>
        <rect x="20.8" y="11" width="3.4" height="4.4" rx="1.1" fill="var(--piece-window)"/>
        <path fill="currentColor" opacity=".35" d="M7.8 16.8h16.4v1.4H7.8z"/>
        <path fill="currentColor" d="M7.8 22.1h16.4v2.3c0 .75-.6 1.35-1.35 1.35H9.15c-.75 0-1.35-.6-1.35-1.35v-2.3z"/>
        <circle cx="10.4" cy="26" r="1.85" fill="currentColor"/>
        <circle cx="21.6" cy="26" r="1.85" fill="currentColor"/>
        <circle cx="10.4" cy="26" r=".7" fill="var(--piece-window)"/>
        <circle cx="21.6" cy="26" r=".7" fill="var(--piece-window)"/>`;
    case "lantern":
    default:
      return `
        <path fill="currentColor" d="M14.4 2.8h3.2v2.4h-3.2z"/>
        <path fill="currentColor" d="M16 5.2c-4.8 0-8.1 2.9-8.1 7.4 0 5.6 3.35 10.7 8.1 14.6 4.75-3.9 8.1-9 8.1-14.6 0-4.5-3.3-7.4-8.1-7.4z"/>
        <path fill="none" stroke="var(--piece-ribbon)" stroke-width="1.7" stroke-linecap="round" d="M11.2 11.2h9.6M11.9 14.9h8.2M12.9 18.5h6.2"/>
        <path fill="currentColor" opacity=".22" d="M12.2 8.4c1.1-.7 2.4-1.05 3.8-1.05 1.4 0 2.7.35 3.8 1.05-.9.45-2.25.75-3.8.75s-2.9-.3-3.8-.75z"/>
        <path fill="currentColor" d="M15 25.4h2v3.4c0 .55-.45 1-1 1s-1-.45-1-1v-3.4z"/>
        <circle cx="16" cy="29.5" r="1.2" fill="currentColor"/>`;
  }
}

/** Visual house / hotel strip for board + sheets. `n` = 0–4 houses, 5 = hotel. */
function buildingsMarkup(n, { compact = false } = {}) {
  const count = Number(n) || 0;
  if (count < 1) return "";
  const label = count === 5 ? "旅館" : `${count} 棟房屋`;
  const cls = ["buildings", compact ? "buildings--compact" : ""].filter(Boolean).join(" ");
  if (count === 5) {
    return `<span class="${cls}" title="${label}" aria-label="${label}"><span class="bld bld--hotel" aria-hidden="true"></span><span class="bld-count">旅館</span></span>`;
  }
  const houses = Array.from(
    { length: count },
    () => `<span class="bld bld--house" aria-hidden="true"></span>`,
  ).join("");
  return `<span class="${cls}" title="${label}" aria-label="${label}">${houses}<span class="bld-count">${count}房</span></span>`;
}

const PHASE_ZH = {
  lobby: "開局",
  roll: "擲骰",
  jail_turn: "坐牢",
  buy: "購買",
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

/** Visual dice faces for the status bar. */
function diceMarkup(pair, opts = {}) {
  if (!pair) {
    lastPaintedDice = null;
    return `<span class="dice-empty">—</span>`;
  }
  const [a, b] = pair;
  const changed =
    opts.forceSpin ||
    !lastPaintedDice ||
    lastPaintedDice[0] !== a ||
    lastPaintedDice[1] !== b;
  if (!opts.forceSpin) lastPaintedDice = [a, b];
  const rollCls = changed ? " is-rolling" : "";
  const die = (n) =>
    `<span class="die${rollCls}" data-face="${n}" aria-label="${n}">${"<span class='pip'></span>".repeat(9)}</span>`;
  const sum = opts.forceSpin
    ? `<span class="dice-sum">…</span>`
    : `<span class="dice-sum">${a}+${b}=${a + b}</span>`;
  return `${die(a)}${die(b)}${sum}`;
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
    const wrap = document.createElement("div");
    wrap.className = "seat-setup";

    const head = document.createElement("div");
    head.className = "seat-setup-head";
    head.innerHTML = `${tokenMarkup(i, { size: 26, className: "piece--lobby" })}<span class="seat-setup-piece">${TOKEN_META[i % TOKEN_META.length].label}</span>`;
    wrap.appendChild(head);

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
    wrap.appendChild(label);

    const aiLabel = document.createElement("label");
    aiLabel.className = "ai-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.aiIdx = String(i);
    // Default: seat 0 human, others AI when 2+ — nicer for solo try
    cb.checked = i > 0;
    aiLabel.appendChild(cb);
    aiLabel.appendChild(document.createTextNode(" 開局即託管 AI"));
    wrap.appendChild(aiLabel);

    nameFields.appendChild(wrap);
  }
}

function stopAiLoop() {
  if (aiTimer != null) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function scheduleAi() {
  stopAiLoop();
  if (fxBusy || diceSpinning) return;
  if (!game || !needsAiStep(game)) return;
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (fxBusy || diceSpinning) return;
    if (!game || !needsAiStep(game)) return;
    const id = actingPlayerId(game);
    const name = id != null ? game.players[id].name : "AI";
    const result = aiStep(game);
    if (!result) {
      lastAiBanner = `${name}（AI）：無可用行動`;
    } else if (result.ok === false) {
      lastAiBanner = `${name}（AI）：${result.error || "無法行動"}`;
      setPrompt(lastAiBanner);
    } else {
      lastAiBanner = `${name}（AI）：${result.action || "行動完成"}`;
    }
    render();
  }, AI_STEP_MS);
}

function showToast(text, tone = "neutral") {
  if (!toastHost || !text) return;
  const el = document.createElement("div");
  el.className = `toast toast--${tone}`;
  el.textContent = text;
  toastHost.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--in"));
  setTimeout(() => {
    el.classList.remove("toast--in");
    el.classList.add("toast--out");
    setTimeout(() => el.remove(), 280);
  }, 2200);
}

function dismissCardReveal() {
  if (cardRevealTimer != null) {
    clearTimeout(cardRevealTimer);
    cardRevealTimer = null;
  }
  if (!cardRevealEl || cardRevealEl.hidden) {
    fxBusy = false;
    scheduleAi();
    return;
  }
  cardRevealEl.classList.remove("card-reveal--show");
  setTimeout(() => {
    cardRevealEl.hidden = true;
    fxBusy = false;
    scheduleAi();
  }, 200);
}

/**
 * @param {{ deck: string, text: string, player?: string }} evt
 */
function showCardReveal(evt) {
  if (!cardRevealEl) return;
  fxBusy = true;
  stopAiLoop();
  const isChance = evt.deck === "chance";
  cardRevealEl.classList.toggle("card-reveal--chance", isChance);
  cardRevealEl.classList.toggle("card-reveal--chest", !isChance);
  cardRevealKicker.textContent = isChance ? "機會" : "命運";
  cardRevealTitle.textContent = evt.player
    ? `${evt.player} 抽到${isChance ? "機會" : "命運"}`
    : isChance
      ? "機會"
      : "命運";
  cardRevealText.textContent = evt.text;
  cardRevealEl.hidden = false;
  requestAnimationFrame(() => cardRevealEl.classList.add("card-reveal--show"));
  const deckSel = isChance ? ".deck--chance" : ".deck--chest";
  boardEl?.querySelector(deckSel)?.classList.add("deck--pulse");
  setTimeout(
    () => boardEl?.querySelector(deckSel)?.classList.remove("deck--pulse"),
    700,
  );
  if (cardRevealTimer != null) clearTimeout(cardRevealTimer);
  cardRevealTimer = setTimeout(dismissCardReveal, 2600);
}

function playFx(events) {
  if (!events?.length) return;
  for (const e of events) {
    if (e.type === "card") showCardReveal(e);
    else if (e.type === "toast") showToast(e.text, e.tone || "neutral");
  }
}

/** Anticipation spin, then run the real roll. */
function rollWithFx(action) {
  if (!game || diceSpinning || fxBusy) return;
  diceSpinning = true;
  stopAiLoop();
  const faces = () => 1 + Math.floor(Math.random() * 6);
  let ticks = 0;
  const spin = () => {
    diceLabel.innerHTML = diceMarkup([faces(), faces()], { forceSpin: true });
    ticks += 1;
    if (ticks < 8) {
      setTimeout(spin, 55 + ticks * 12);
      return;
    }
    diceSpinning = false;
    lastPaintedDice = null;
    afterAct(action());
  };
  spin();
}

function buildBoardShell() {
  boardEl.innerHTML = "";
  // List order = board index (mobile-first). Ring layout uses gridColumn/Row at ≥720px.
  for (const tile of BOARD) {
    const pos = cellGridPos(tile.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "cell" +
      (tile.type === "go" ||
      tile.type === "jail" ||
      tile.type === "parking" ||
      tile.type === "gotojail"
        ? " corner"
        : "") +
      (tile.type === "chance" ? " cell--chance" : "") +
      (tile.type === "chest" ? " cell--chest" : "");
    btn.dataset.id = String(tile.id);
    btn.style.gridColumn = String(pos.col);
    btn.style.gridRow = String(pos.row);
    btn.addEventListener("click", () => showTileDetail(tile.id));
    boardEl.appendChild(btn);
  }
  const center = document.createElement("div");
  center.className = "center-slot";
  center.setAttribute("aria-hidden", "true");
  center.innerHTML = `
    <div class="board-logo">
      <span class="board-logo-mark">台灣路名地產</span>
      <span class="board-logo-sub">紙本規則</span>
    </div>
    <div class="deck deck--chest" title="命運牌庫">
      <div class="deck-stack" aria-hidden="true">
        <span class="deck-layer"></span>
        <span class="deck-layer"></span>
        <span class="deck-face">
          <span class="deck-glyph">命</span>
          <span class="deck-label">命運</span>
        </span>
      </div>
    </div>
    <div class="deck deck--chance" title="機會牌庫">
      <div class="deck-stack" aria-hidden="true">
        <span class="deck-layer"></span>
        <span class="deck-layer"></span>
        <span class="deck-face">
          <span class="deck-glyph">機</span>
          <span class="deck-label">機會</span>
        </span>
      </div>
    </div>
  `;
  boardEl.appendChild(center);
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
  if (tile.type === "chance") {
    parts.push(`<p>踩到此格時，從中央<strong>機會</strong>牌庫抽一張並執行。</p>`);
  }
  if (tile.type === "chest") {
    parts.push(`<p>踩到此格時，從中央<strong>命運</strong>牌庫抽一張並執行。</p>`);
  }
  if (tile.type === "tax") parts.push(`<p>稅額：${money(tile.tax)}</p>`);
  if (st) {
    const owner =
      st.owner == null ? "無主" : game.players[st.owner].name;
    parts.push(`<p>擁有者：${owner}</p>`);
    if (tile.type === "property") {
      const built =
        st.houses > 0
          ? buildingsMarkup(st.houses)
          : `<span class="buildings buildings--empty">空地</span>`;
      parts.push(
        `<p class="detail-buildings">建築：${built}${st.mortgaged ? "（已抵押）" : ""}</p>`,
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
  /** @type {HTMLElement | null} */
  let focusEl = null;
  const currentPos = game.current()?.pos;

  for (const tile of BOARD) {
    const el = boardEl.querySelector(`[data-id="${tile.id}"]`);
    if (!el) continue;
    const st = game.props[tile.id];
    let sub = "";
    if (tile.price != null) sub = money(tile.price);
    if (tile.type === "tax") sub = money(tile.tax);
    if (tile.type === "chance") sub = "抽機會卡";
    if (tile.type === "chest") sub = "抽命運卡";
    if (st?.owner != null && !st.mortgaged && tile.price != null) {
      const ownerName = game.players[st.owner]?.name ?? "";
      sub = sub ? `${sub} · ${ownerName}` : ownerName;
    }
    if (st?.mortgaged) sub = sub ? `${sub} · 抵押` : "抵押";

    const occupants = game.players.filter(
      (p) => !p.bankrupt && p.pos === tile.id,
    );
    const here = occupants.some((p) => p.id === game.turn);
    el.classList.toggle("here", here);
    el.classList.toggle("has-buildings", Boolean(st?.houses));
    if (tile.id === currentPos) focusEl = el;

    const ownerDot =
      st?.owner != null
        ? `<span class="owner-dot" style="background:${TOKEN_COLORS[st.owner % TOKEN_COLORS.length]}" title="${escapeAttr(game.players[st.owner].name)}"></span>`
        : "";

    const swatch =
      tile.group && GROUP_COLOR[tile.group]
        ? `<span class="swatch" style="background:${GROUP_COLOR[tile.group]}"></span>`
        : tile.type === "chance"
          ? `<span class="swatch swatch--chance"></span>`
          : tile.type === "chest"
            ? `<span class="swatch swatch--chest"></span>`
            : `<span class="swatch" style="background:transparent"></span>`;

    const deckBadge =
      tile.type === "chance"
        ? `<span class="tile-deck-badge tile-deck-badge--chance" aria-hidden="true">?</span>`
        : tile.type === "chest"
          ? `<span class="tile-deck-badge tile-deck-badge--chest" aria-hidden="true">★</span>`
          : "";

    const buildings =
      tile.type === "property" && st?.houses
        ? buildingsMarkup(st.houses, { compact: true })
        : "";

    const tokens = occupants
      .map((p) => {
        const moved = prevPlayerPos.has(p.id) && prevPlayerPos.get(p.id) !== p.pos;
        return tokenMarkup(p.id, {
          size: 22,
          title: `${p.name}（${TOKEN_META[p.id % TOKEN_META.length].label}）`,
          className: "piece--board" + (moved ? " piece--arrive" : ""),
        });
      })
      .join("");

    el.innerHTML = `${swatch}<span class="cell-body"><span class="name">${ownerDot}${deckBadge}${tile.name}</span>${buildings}<span class="sub">${sub || "—"}</span></span><span class="tokens">${tokens}</span>`;
  }

  for (const p of game.players) {
    if (!p.bankrupt) prevPlayerPos.set(p.id, p.pos);
  }

  // Keep current tile visible in the mobile list without hijacking wide ring scroll.
  if (
    focusEl &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 719px)").matches
  ) {
    focusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
      (p.bankrupt ? " broke" : "") +
      (p.ai ? " ai" : "");

    const main = document.createElement("div");
    main.className = "player-card-main";
    main.innerHTML = `
      ${tokenMarkup(p.id, {
        size: 28,
        title: `${p.name}（${TOKEN_META[p.id % TOKEN_META.length].label}）`,
        className: "piece--card",
      })}
      <div class="player-card-text">
        <strong>${p.name}${p.ai ? " · AI" : ""} <span class="piece-label">${TOKEN_META[p.id % TOKEN_META.length].label}</span></strong>
        <div class="meta">${p.bankrupt ? "已破產" : p.jail ? "坐牢中" : `位置：${tileById(p.pos).name}`} · 地產 ${owned}${p.jailCards ? ` · 出獄卡 ${p.jailCards}` : ""}</div>
      </div>
      <strong class="cash">${p.bankrupt ? "—" : money(p.cash)}</strong>
    `;
    card.appendChild(main);

    if (!p.bankrupt && game.phase !== "ended") {
      const tog = document.createElement("button");
      tog.type = "button";
      tog.className = "secondary ai-seat-btn";
      tog.textContent = p.ai ? "收回" : "託管 AI";
      tog.addEventListener("click", () => {
        game.setPlayerAi(p.id, !p.ai);
        render();
      });
      card.appendChild(tog);
    }

    playersEl.appendChild(card);
  }
}

function paintLog() {
  if (!game) return;
  logEl.innerHTML = game.log.map((l) => `<li>${l}</li>`).join("");
}

function setPrompt(text, opts = {}) {
  promptEl.textContent = text;
  if (opts.ai) promptEl.dataset.ai = "1";
  else delete promptEl.dataset.ai;
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
    diceSpinning = false;
    return;
  }
  render();
}

function render() {
  if (!game) return;
  const snap = game.snapshot();
  const fx = typeof game.consumeFx === "function" ? game.consumeFx() : [];
  phaseLabel.textContent = PHASE_ZH[snap.phase] || snap.phase;
  if (!diceSpinning) {
    diceLabel.innerHTML = diceMarkup(snap.lastDice);
  }
  stockLabel.textContent = `${snap.housesLeft}／${snap.hotelsLeft}`;
  paintBoard();
  paintPlayers();
  paintLog();
  paintActions();
  playFx(fx);
  if (!fxBusy && !diceSpinning) scheduleAi();
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
    info.innerHTML = `<strong>${t.name}</strong><div class="meta manage-buildings">${
      st.mortgaged
        ? "已抵押"
        : t.type === "property"
          ? st.houses
            ? buildingsMarkup(st.houses)
            : "空地"
          : "—"
    }</div>`;
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
    stopAiLoop();
    const w = game.players[game.winnerId];
    setPrompt(`${w.name} 贏得這局！`);
    actionsEl.appendChild(
      btn("再來一局", "primary", () => {
        stopAiLoop();
        lobbyEl.hidden = false;
        gameEl.hidden = true;
        game = null;
        closeSheet();
      }),
    );
    return;
  }

  // AI custody: show what the AI just did／is doing
  if (needsAiStep(game)) {
    const id = actingPlayerId(game);
    const ap = game.players[id];
    setPrompt(lastAiBanner || `${ap.name}（AI）思考中…`, { ai: true });
    actionsEl.appendChild(
      btn("收回此玩家", "secondary", () => {
        game.setPlayerAi(id, false);
        lastAiBanner = "";
        render();
      }),
    );
    return;
  }

  if (phase === "roll") {
    setPrompt(`輪到 ${p.name}：請擲骰。`);
    actionsEl.appendChild(btn("擲骰", "primary", () => rollWithFx(() => game.roll())));
    return;
  }

  if (phase === "jail_turn") {
    setPrompt(
      `${p.name} 在坐牢：可先管理／交易，再繳 50 元、用卡或試擲雙子出獄。`,
    );
    actionsEl.appendChild(btn("繳 50 元出獄", "primary", () => afterAct(game.jailPay())));
    actionsEl.appendChild(
      btn("用出獄卡", "secondary", () => afterAct(game.jailCard()), p.jailCards < 1),
    );
    actionsEl.appendChild(
      btn("試擲雙子", "secondary", () => rollWithFx(() => game.jailRoll())),
    );
    actionsEl.appendChild(btn("地產管理", "secondary", () => openManageSheet()));
    actionsEl.appendChild(btn("交易", "secondary", () => openTradeSheet(false)));
    return;
  }

  if (phase === "buy") {
    const tile = tileById(game.pendingBuy);
    setPrompt(
      `${p.name} 可買「${tile.name}」（${money(tile.price)}）。不買則維持空地。`,
    );
    actionsEl.appendChild(
      btn(`買下（${money(tile.price)}）`, "primary", () => afterAct(game.buy()), p.cash < tile.price),
    );
    actionsEl.appendChild(btn("不買", "secondary", () => afterAct(game.declineBuy())));
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
      setPrompt(
        `${p.name} 擲出雙子：可先管理地產（若停在自家地可蓋房），或再擲一次。`,
      );
      actionsEl.appendChild(
        btn("再擲一次", "primary", () => rollWithFx(() => game.roll())),
      );
      actionsEl.appendChild(btn("地產管理", "secondary", () => openManageSheet()));
      actionsEl.appendChild(btn("交易", "secondary", () => openTradeSheet(false)));
      return;
    }
    const buildHint =
      game.landedOwnTileId != null
        ? "停在自家地，可為該色組蓋房；"
        : "蓋房須先停在自己的土地上；";
    setPrompt(`${p.name}：${buildHint}也可抵押、交易，或結束回合。`);
    actionsEl.appendChild(btn("地產管理", "secondary", () => openManageSheet()));
    actionsEl.appendChild(btn("交易", "secondary", () => openTradeSheet(false)));
    actionsEl.appendChild(btn("結束回合", "primary", () => afterAct(game.endTurn())));
  }
}

document.getElementById("btn-start").addEventListener("click", () => {
  const n = Number(playerCountSel.value);
  const inputs = [...nameFields.querySelectorAll("input[type='text']")];
  const names = inputs.map((el, i) => el.value.trim() || `玩家 ${i + 1}`);
  const aiFlags = [...nameFields.querySelectorAll("input[data-ai-idx]")].map(
    (el) => /** @type {HTMLInputElement} */ (el).checked,
  );
  stopAiLoop();
  lastAiBanner = "";
  lastPaintedDice = null;
  prevPlayerPos.clear();
  fxBusy = false;
  diceSpinning = false;
  if (cardRevealTimer != null) {
    clearTimeout(cardRevealTimer);
    cardRevealTimer = null;
  }
  if (cardRevealEl) {
    cardRevealEl.hidden = true;
    cardRevealEl.classList.remove("card-reveal--show");
  }
  game = new TwLandGame({ playerCount: n, names, aiFlags });
  game.start();
  for (const p of game.players) {
    if (p.ai) game.pushLog(`${p.name} 開局即由 AI 託管。`);
  }
  lobbyEl.hidden = true;
  gameEl.hidden = false;
  closeSheet();
  render();
});

document.getElementById("btn-new").addEventListener("click", () => {
  stopAiLoop();
  lastAiBanner = "";
  lobbyEl.hidden = false;
  gameEl.hidden = true;
  game = null;
  closeSheet();
});

playerCountSel.addEventListener("change", renderNameFields);
sheetEl.addEventListener("click", (e) => {
  if (e.target === sheetEl) closeSheet();
});
cardRevealEl?.addEventListener("click", dismissCardReveal);

renderNameFields();
buildBoardShell();

"use strict";

/* =========================================================
   OFFLINE TEXAS HOLD'EM
   1 Spieler + 3 Bots
   Nur virtuelle Coins
========================================================= */

const STARTING_STACK = 10000;
const SMALL_BLIND = 50;
const BIG_BLIND = 100;

const SUITS = ["♠", "♥", "♦", "♣"];

const RANKS = [
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 11 },
  { rank: "Q", value: 12 },
  { rank: "K", value: 13 },
  { rank: "A", value: 14 }
];

const PLAYER_NAMES = [
  "DU",
  "MAX",
  "LISA",
  "TOM"
];

const BOT_STYLE = {
  1: "careful",
  2: "balanced",
  3: "aggressive"
};


/* =========================================================
   DOM
========================================================= */

const $ = id => document.getElementById(id);

const potValue = $("potValue");
const communityCardsEl = $("communityCards");
const heroCardsEl = $("heroCards");

const balanceValue = $("balanceValue");
const bottomBalance = $("bottomBalance");

const blindValue = $("blindValue");
const betValue = $("betValue");
const winValue = $("winValue");

const message = $("message");
const heroAction = $("heroAction");

const foldBtn = $("foldBtn");
const checkBtn = $("checkBtn");
const callBtn = $("callBtn");
const callAmount = $("callAmount");
const raiseBtn = $("raiseBtn");
const newHandBtn = $("newHandBtn");

const raisePanel = $("raisePanel");

const statsBtn = $("statsBtn");
const newGameBtn = $("newGameBtn");

const statsDialog = $("statsDialog");
const closeStatsBtn = $("closeStatsBtn");

const statHands = $("statHands");
const statWins = $("statWins");
const statLosses = $("statLosses");
const statBiggestPot = $("statBiggestPot");


/* =========================================================
   SPEICHER
========================================================= */

function freshStats() {
  return {
    hands: 0,
    wins: 0,
    losses: 0,
    biggestPot: 0
  };
}

function freshPersistentState() {
  return {
    stacks: [
      STARTING_STACK,
      STARTING_STACK,
      STARTING_STACK,
      STARTING_STACK
    ],

    dealer: 0,

    stats: freshStats()
  };
}

function loadPersistentState() {
  try {

    const raw =
      localStorage.getItem(
        "offlinePokerStateV2"
      );

    if (!raw) {
      return freshPersistentState();
    }

    const saved =
      JSON.parse(raw);

    const base =
      freshPersistentState();

    return {
      ...base,
      ...saved,

      stats: {
        ...base.stats,
        ...(saved.stats || {})
      }
    };

  } catch (e) {

    return freshPersistentState();
  }
}

const persistent =
  loadPersistentState();


/* =========================================================
   SPIELVARIABLE
========================================================= */

let players = [];

let deck = [];
let community = [];

let pot = 0;

let street = "idle";

let currentBet = 0;
let currentPlayer = -1;

let handRunning = false;

let lastWin = 0;


/* =========================================================
   SPIELER
========================================================= */

function buildPlayers() {

  players =
    PLAYER_NAMES.map(
      (name, id) => ({
        id,
        name,

        stack:
          persistent.stacks[id] ??
          STARTING_STACK,

        hand: [],

        folded: false,
        allIn: false,

        betStreet: 0,

        contributed: 0,

        acted: false
      })
    );
}

buildPlayers();


/* =========================================================
   SPEICHERN
========================================================= */

function saveState() {

  persistent.stacks =
    players.map(
      p => p.stack
    );

  localStorage.setItem(
    "offlinePokerStateV2",
    JSON.stringify(persistent)
  );
}


/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function fmt(n) {

  return Math
    .round(n)
    .toLocaleString("de-DE");
}

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


/* =========================================================
   DECK
========================================================= */

function createDeck() {

  const cards = [];

  for (const suit of SUITS) {

    for (const item of RANKS) {

      cards.push({
        rank: item.rank,
        value: item.value,
        suit
      });
    }
  }

  return cards;
}

function shuffle(arr) {

  for (
    let i = arr.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      arr[i],
      arr[j]
    ] = [
      arr[j],
      arr[i]
    ];
  }

  return arr;
}

function drawCard() {

  if (deck.length === 0) {
    throw new Error(
      "Deck ist leer."
    );
  }

  return deck.pop();
}


/* =========================================================
   KARTEN HTML
========================================================= */

function cardClass(card) {

  const red =
    card.suit === "♥" ||
    card.suit === "♦";

  return red
    ? "card red dealt"
    : "card dealt";
}

function cardHTML(card) {

  return `
    <div class="${cardClass(card)}">
      ${card.rank}${card.suit}
    </div>
  `;
}

function cardBackHTML() {

  return `
    <div class="card card-back">
      ★
    </div>
  `;
}


/* =========================================================
   PLAYER DOM
========================================================= */

function playerEl(i) {

  return $("player" + i);
}

function setPlayerAction(
  i,
  text
) {

  const el =
    playerEl(i);

  if (!el) return;

  const action =
    el.querySelector(
      ".player-action"
    );

  if (action) {
    action.textContent =
      text || "";
  }
}

function updatePlayerBoxes() {

  for (
    let i = 0;
    i < players.length;
    i++
  ) {

    const el =
      playerEl(i);

    if (!el) continue;

    const coinEl =
      el.querySelector(
        ".player-coins"
      );

    if (coinEl) {

      coinEl.textContent =
        fmt(
          players[i].stack
        );
    }

    el.classList.toggle(
      "folded",
      players[i].folded
    );

    el.classList.toggle(
      "active",
      handRunning &&
      currentPlayer === i
    );
  }
}


/* =========================================================
   KARTEN RENDERN
========================================================= */

function renderHands(
  showBots = false
) {

  heroCardsEl.innerHTML =
    players[0].hand
      .map(cardHTML)
      .join("");

  for (
    let i = 1;
    i < 4;
    i++
  ) {

    const el =
      playerEl(i);

    if (!el) continue;

    const cards =
      el.querySelector(
        ".cards"
      );

    if (!cards) continue;

    if (
      showBots &&
      !players[i].folded
    ) {

      cards.innerHTML =
        players[i].hand
          .map(cardHTML)
          .join("");

    } else {

      cards.innerHTML =
        cardBackHTML() +
        cardBackHTML();
    }
  }
}

function renderCommunity() {

  const html = [];

  for (
    let i = 0;
    i < 5;
    i++
  ) {

    if (community[i]) {

      html.push(
        cardHTML(
          community[i]
        )
      );

    } else {

      html.push(`
        <div class="card empty-card"></div>
      `);
    }
  }

  communityCardsEl.innerHTML =
    html.join("");
}


/* =========================================================
   UI
========================================================= */

function updateUI() {

  potValue.textContent =
    fmt(pot);

  balanceValue.textContent =
    fmt(
      players[0].stack
    );

  bottomBalance.textContent =
    fmt(
      players[0].stack
    );

  blindValue.textContent =
    `${fmt(SMALL_BLIND)} / ${fmt(BIG_BLIND)}`;

  betValue.textContent =
    fmt(
      players[0].betStreet
    );

  winValue.textContent =
    fmt(lastWin);

  const need =
    Math.max(
      0,
      currentBet -
      players[0].betStreet
    );

  callAmount.textContent =
    need > 0
      ? fmt(
          Math.min(
            need,
            players[0].stack
          )
        )
      : "";

  updatePlayerBoxes();

  saveState();
}


/* =========================================================
   CHIP LOGIK
========================================================= */

function commitChips(
  player,
  amount
) {

  amount =
    Math.max(
      0,
      Math.floor(amount)
    );

  const pay =
    Math.min(
      amount,
      player.stack
    );

  player.stack -= pay;

  player.betStreet += pay;

  player.contributed += pay;

  pot += pay;

  if (
    player.stack === 0
  ) {

    player.allIn = true;
  }

  if (
    player.betStreet >
    currentBet
  ) {

    currentBet =
      player.betStreet;
  }

  return pay;
}


/* =========================================================
   DEALER / SITZ
========================================================= */

function nextSeat(i) {

  return (
    i + 1
  ) % players.length;
}

function nextActivePlayer(
  from
) {

  for (
    let n = 1;
    n <= players.length;
    n++
  ) {

    const idx =
      (
        from + n
      ) % players.length;

    const p =
      players[idx];

    if (
      !p.folded &&
      !p.allIn
    ) {

      return idx;
    }
  }

  return -1;
}


/* =========================================================
   BLINDS
========================================================= */

function postBlinds() {

  const sb =
    nextSeat(
      persistent.dealer
    );

  const bb =
    nextSeat(sb);

  commitChips(
    players[sb],
    SMALL_BLIND
  );

  commitChips(
    players[bb],
    BIG_BLIND
  );

  currentBet =
    Math.max(
      players[sb].betStreet,
      players[bb].betStreet
    );

  setPlayerAction(
    sb,
    `SB ${fmt(players[sb].betStreet)}`
  );

  setPlayerAction(
    bb,
    `BB ${fmt(players[bb].betStreet)}`
  );

  currentPlayer =
    nextActivePlayer(bb);
}


/* =========================================================
   KARTEN AUSTEILEN
========================================================= */

function dealHoleCards() {

  for (
    let round = 0;
    round < 2;
    round++
  ) {

    for (
      let i = 0;
      i < 4;
      i++
    ) {

      players[i]
        .hand
        .push(
          drawCard()
        );
    }
  }
}


/* =========================================================
   AKTIVE SPIELER
========================================================= */

function activePlayers() {

  return players.filter(
    p => !p.folded
  );
}

function activeNotAllIn() {

  return players.filter(
    p =>
      !p.folded &&
      !p.allIn
  );
}

function onlyOneLeft() {

  return (
    activePlayers().length === 1
  );
}


/* =========================================================
   STREET
========================================================= */

function resetStreetBets() {

  for (
    const p of players
  ) {

    p.betStreet = 0;

    p.acted = false;
  }

  currentBet = 0;
}

function bettingRoundComplete() {

  const active =
    activeNotAllIn();

  if (
    active.length === 0
  ) {

    return true;
  }

  return active.every(
    p =>
      p.acted &&
      p.betStreet ===
        currentBet
  );
}


/* =========================================================
   HERO BUTTONS
========================================================= */

function disableActionButtons(
  disabled = true
) {

  foldBtn.disabled =
    disabled;

  checkBtn.disabled =
    disabled;

  callBtn.disabled =
    disabled;

  raiseBtn.disabled =
    disabled;
}

function prepareHeroButtons() {

  const hero =
    players[0];

  if (
    !handRunning ||
    hero.folded ||
    hero.allIn ||
    currentPlayer !== 0
  ) {

    disableActionButtons(true);

    return;
  }

  const need =
    Math.max(
      0,
      currentBet -
      hero.betStreet
    );

  foldBtn.disabled =
    false;

  if (
    need === 0
  ) {

    checkBtn.disabled =
      false;

    callBtn.disabled =
      true;

  } else {

    checkBtn.disabled =
      true;

    callBtn.disabled =
      false;
  }

  raiseBtn.disabled =
    hero.stack <= need;
}


/* =========================================================
   HAND-EVALUATOR
========================================================= */

/*
  Ergebnis wird immer so aufgebaut:

  {
    category: Zahl,
    name: "Zwei Paare",
    tiebreak: [...]
  }

  Je höher category, desto besser.
*/

function combinations(
  arr,
  size
) {

  const result = [];

  function walk(
    start,
    chosen
  ) {

    if (
      chosen.length === size
    ) {

      result.push(
        [...chosen]
      );

      return;
    }

    for (
      let i = start;
      i < arr.length;
      i++
    ) {

      chosen.push(
        arr[i]
      );

      walk(
        i + 1,
        chosen
      );

      chosen.pop();
    }
  }

  walk(
    0,
    []
  );

  return result;
}

function compareArrays(
  a,
  b
) {

  const len =
    Math.max(
      a.length,
      b.length
    );

  for (
    let i = 0;
    i < len;
    i++
  ) {

    const av =
      a[i] || 0;

    const bv =
      b[i] || 0;

    if (
      av > bv
    ) return 1;

    if (
      av < bv
    ) return -1;
  }

  return 0;
}

function evaluateFive(
  cards
) {

  const values =
    cards
      .map(
        c => c.value
      )
      .sort(
        (a, b) => b - a
      );

  const suits =
    cards.map(
      c => c.suit
    );

  const flush =
    suits.every(
      suit =>
        suit === suits[0]
    );

  const counts = {};

  for (
    const value
    of values
  ) {

    counts[value] =
      (
        counts[value] ||
        0
      ) + 1;
  }

  const uniqueValues =
    [
      ...new Set(values)
    ];

  /*
    Wheel:
    A 2 3 4 5
  */

  let straightHigh = 0;

  if (
    uniqueValues.includes(14) &&
    uniqueValues.includes(5) &&
    uniqueValues.includes(4) &&
    uniqueValues.includes(3) &&
    uniqueValues.includes(2)
  ) {

    straightHigh = 5;

  } else {

    for (
      let i = 0;
      i <=
      uniqueValues.length - 5;
      i++
    ) {

      if (
        uniqueValues[i] -
        uniqueValues[i + 4]
        === 4
      ) {

        straightHigh =
          uniqueValues[i];

        break;
      }
    }
  }


  const groups =
    Object
      .entries(counts)

      .map(
        ([value, count]) => ({
          value:
            Number(value),

          count
        })
      )

      .sort(
        (a, b) =>
          b.count -
          a.count ||
          b.value -
          a.value
      );


  /* Straight Flush */

  if (
    flush &&
    straightHigh
  ) {

    return {
      category: 8,
      name:
        straightHigh === 14
          ? "Royal Flush"
          : "Straight Flush",

      tiebreak: [
        straightHigh
      ]
    };
  }


  /* Vierling */

  if (
    groups[0].count === 4
  ) {

    const kicker =
      groups
        .find(
          g => g.count === 1
        )
        ?.value || 0;

    return {
      category: 7,
      name: "Vierling",

      tiebreak: [
        groups[0].value,
        kicker
      ]
    };
  }


  /* Full House */

  if (
    groups[0].count === 3 &&
    groups[1] &&
    groups[1].count >= 2
  ) {

    return {
      category: 6,
      name: "Full House",

      tiebreak: [
        groups[0].value,
        groups[1].value
      ]
    };
  }


  /* Flush */

  if (flush) {

    return {
      category: 5,
      name: "Flush",

      tiebreak: [
        ...values
      ]
    };
  }


  /* Straight */

  if (straightHigh) {

    return {
      category: 4,
      name: "Straight",

      tiebreak: [
        straightHigh
      ]
    };
  }


  /* Drilling */

  if (
    groups[0].count === 3
  ) {

    const kickers =
      groups
        .filter(
          g =>
            g.count === 1
        )
        .map(
          g => g.value
        )
        .sort(
          (a, b) => b - a
        );

    return {
      category: 3,
      name: "Drilling",

      tiebreak: [
        groups[0].value,
        ...kickers
      ]
    };
  }


  /* Zwei Paare */

  const pairs =
    groups
      .filter(
        g =>
          g.count === 2
      )
      .map(
        g => g.value
      )
      .sort(
        (a, b) => b - a
      );

  if (
    pairs.length >= 2
  ) {

    const highPair =
      pairs[0];

    const lowPair =
      pairs[1];

    const kicker =
      values
        .filter(
          v =>
            v !== highPair &&
            v !== lowPair
        )
        .sort(
          (a, b) => b - a
        )[0] || 0;

    return {
      category: 2,
      name: "Zwei Paare",

      tiebreak: [
        highPair,
        lowPair,
        kicker
      ]
    };
  }


  /* Ein Paar */

  if (
    pairs.length === 1
  ) {

    const pair =
      pairs[0];

    const kickers =
      values
        .filter(
          v =>
            v !== pair
        )
        .sort(
          (a, b) => b - a
        );

    return {
      category: 1,
      name: "Ein Paar",

      tiebreak: [
        pair,
        ...kickers
      ]
    };
  }


  /* High Card */

  return {
    category: 0,
    name: "High Card",

    tiebreak: [
      ...values
    ]
  };
}

function compareEvaluation(
  a,
  b
) {

  if (
    a.category >
    b.category
  ) return 1;

  if (
    a.category <
    b.category
  ) return -1;

  return compareArrays(
    a.tiebreak,
    b.tiebreak
  );
}

function evaluateBestHand(
  cards
) {

  if (
    cards.length < 5
  ) {

    return null;
  }

  const all =
    combinations(
      cards,
      5
    );

  let best = null;

  for (
    const combo
    of all
  ) {

    const evaluation =
      evaluateFive(combo);

    if (
      !best ||
      compareEvaluation(
        evaluation,
        best
      ) > 0
    ) {

      best =
        evaluation;
    }
  }

  return best;
}


/* =========================================================
   BOT STÄRKE
========================================================= */

function preflopStrength(
  hand
) {

  const [a, b] =
    hand;

  const high =
    Math.max(
      a.value,
      b.value
    );

  const low =
    Math.min(
      a.value,
      b.value
    );

  let score =
    high;

  if (
    a.value ===
    b.value
  ) {

    score +=
      10 + high;
  }

  if (
    a.suit ===
    b.suit
  ) {

    score += 2;
  }

  const gap =
    Math.abs(
      a.value -
      b.value
    );

  if (
    gap === 1
  ) score += 2;

  if (
    gap === 2
  ) score += 1;

  if (
    high === 14
  ) score += 3;

  if (
    high >= 12 &&
    low >= 10
  ) score += 3;

  return score;
}

function botHandStrength(
  player
) {

  if (
    community.length < 3
  ) {

    return preflopStrength(
      player.hand
    );
  }

  const result =
    evaluateBestHand([
      ...player.hand,
      ...community
    ]);

  if (!result) {
    return 0;
  }

  return (
    result.category * 15 +
    (
      result.tiebreak[0] ||
      0
    )
  );
}


/* =========================================================
   BOT AKTION
========================================================= */

async function botAct(i) {

  const p =
    players[i];

  if (
    p.folded ||
    p.allIn
  ) {

    return;
  }

  await sleep(
    400 +
    Math.random() * 450
  );

  const need =
    Math.max(
      0,
      currentBet -
      p.betStreet
    );

  const strength =
    botHandStrength(p);

  const style =
    BOT_STYLE[i];

  let foldLimit = 10;
  let raiseLimit = 26;

  if (
    style === "careful"
  ) {

    foldLimit = 13;
    raiseLimit = 30;
  }

  if (
    style === "aggressive"
  ) {

    foldLimit = 8;
    raiseLimit = 22;
  }

  const adjusted =
    strength +
    Math.random() * 6;


  /* Fold */

  if (
    need > 0 &&
    adjusted < foldLimit &&
    need >
      Math.max(
        BIG_BLIND,
        p.stack * 0.15
      )
  ) {

    p.folded = true;
    p.acted = true;

    setPlayerAction(
      i,
      "PASSEN"
    );
  }

  /* Raise */

  else if (
    adjusted >
      raiseLimit &&
    p.stack >
      need +
      BIG_BLIND
  ) {

    let target =
      Math.max(
        currentBet +
          BIG_BLIND * 2,

        currentBet * 2
      );

    target =
      Math.min(
        target,
        p.betStreet +
          p.stack
      );

    const amount =
      target -
      p.betStreet;

    commitChips(
      p,
      amount
    );

    for (
      const other
      of players
    ) {

      if (
        other.id !== i &&
        !other.folded &&
        !other.allIn
      ) {

        other.acted =
          false;
      }
    }

    p.acted = true;

    setPlayerAction(
      i,

      p.allIn
        ? "ALL-IN"
        : `ERHÖHEN ${fmt(p.betStreet)}`
    );
  }

  /* Call */

  else if (
    need > 0
  ) {

    const paid =
      commitChips(
        p,
        need
      );

    p.acted = true;

    setPlayerAction(
      i,

      p.allIn
        ? "ALL-IN"
        : `MITGEHEN ${fmt(paid)}`
    );
  }

  /* Check */

  else {

    p.acted = true;

    setPlayerAction(
      i,
      "CHECK"
    );
  }

  updateUI();
}


/* =========================================================
   HERO
========================================================= */

async function heroFold() {

  if (
    currentPlayer !== 0 ||
    !handRunning
  ) return;

  players[0].folded =
    true;

  players[0].acted =
    true;

  heroAction.textContent =
    "PASSEN";

  raisePanel.classList.add(
    "hidden"
  );

  updateUI();

  await continueAction();
}

async function heroCheck() {

  if (
    currentPlayer !== 0 ||
    !handRunning
  ) return;

  const need =
    Math.max(
      0,
      currentBet -
      players[0].betStreet
    );

  if (
    need !== 0
  ) return;

  players[0].acted =
    true;

  heroAction.textContent =
    "CHECK";

  raisePanel.classList.add(
    "hidden"
  );

  updateUI();

  await continueAction();
}

async function heroCall() {

  if (
    currentPlayer !== 0 ||
    !handRunning
  ) return;

  const hero =
    players[0];

  const need =
    Math.max(
      0,
      currentBet -
      hero.betStreet
    );

  const paid =
    commitChips(
      hero,
      need
    );

  hero.acted =
    true;

  heroAction.textContent =
    hero.allIn
      ? "ALL-IN"
      : `MITGEHEN ${fmt(paid)}`;

  raisePanel.classList.add(
    "hidden"
  );

  updateUI();

  await continueAction();
}

async function heroRaise(
  multiplier
) {

  if (
    currentPlayer !== 0 ||
    !handRunning
  ) return;

  const hero =
    players[0];

  let target;

  if (
    multiplier ===
    "allin"
  ) {

    target =
      hero.betStreet +
      hero.stack;

  } else {

    const mult =
      Number(multiplier);

    target =
      Math.max(
        currentBet +
          BIG_BLIND,

        currentBet *
          mult,

        BIG_BLIND *
          mult
      );

    target =
      Math.min(
        target,
        hero.betStreet +
          hero.stack
      );
  }

  if (
    target <=
    currentBet
  ) {

    return;
  }

  const amount =
    target -
    hero.betStreet;

  commitChips(
    hero,
    amount
  );

  for (
    const p
    of players
  ) {

    if (
      p.id !== 0 &&
      !p.folded &&
      !p.allIn
    ) {

      p.acted =
        false;
    }
  }

  hero.acted =
    true;

  heroAction.textContent =
    hero.allIn
      ? "ALL-IN"
      : `ERHÖHEN ${fmt(hero.betStreet)}`;

  raisePanel.classList.add(
    "hidden"
  );

  updateUI();

  await continueAction();
}


/* =========================================================
   ACTION LOOP
========================================================= */

async function continueAction() {

  if (
    onlyOneLeft()
  ) {

    await finishByFold();

    return;
  }

  if (
    bettingRoundComplete()
  ) {

    await advanceStreet();

    return;
  }

  currentPlayer =
    nextActivePlayer(
      currentPlayer
    );

  if (
    currentPlayer === -1
  ) {

    await advanceStreet();

    return;
  }

  updateUI();

  if (
    currentPlayer === 0
  ) {

    prepareHeroButtons();

    message.textContent =
      "Du bist dran.";

    return;
  }

  disableActionButtons(true);

  await botAct(
    currentPlayer
  );

  await continueAction();
}


/* =========================================================
   STREET WEITER
========================================================= */

async function advanceStreet() {

  disableActionButtons(true);

  await sleep(400);

  if (
    street ===
    "preflop"
  ) {

    street = "flop";

    community.push(
      drawCard(),
      drawCard(),
      drawCard()
    );

    message.textContent =
      "FLOP";
  }

  else if (
    street ===
    "flop"
  ) {

    street = "turn";

    community.push(
      drawCard()
    );

    message.textContent =
      "TURN";
  }

  else if (
    street ===
    "turn"
  ) {

    street = "river";

    community.push(
      drawCard()
    );

    message.textContent =
      "RIVER";
  }

  else if (
    street ===
    "river"
  ) {

    await showdown();

    return;
  }

  renderCommunity();

  resetStreetBets();

  if (
    activeNotAllIn()
      .length <= 1
  ) {

    await runOutBoard();

    return;
  }

  currentPlayer =
    nextActivePlayer(
      persistent.dealer
    );

  updateUI();

  await sleep(350);

  if (
    currentPlayer === 0
  ) {

    prepareHeroButtons();

    message.textContent =
      `${street.toUpperCase()} · Du bist dran.`;

  } else {

    await botAct(
      currentPlayer
    );

    await continueAction();
  }
}


/* =========================================================
   BOARD AUTOMATISCH
========================================================= */

async function runOutBoard() {

  disableActionButtons(true);

  while (
    community.length < 5
  ) {

    await sleep(400);

    community.push(
      drawCard()
    );

    renderCommunity();
  }

  await showdown();
}


/* =========================================================
   WINNER MARKIERUNG
========================================================= */

function clearWinnerClasses() {

  for (
    let i = 0;
    i < 4;
    i++
  ) {

    playerEl(i)
      ?.classList
      .remove(
        "winner"
      );
  }
}

function highlightWinner(
  i
) {

  playerEl(i)
    ?.classList
    .add(
      "winner"
    );
}


/* =========================================================
   SIDE POTS
========================================================= */

function buildSidePots() {

  const levels =
    [
      ...new Set(
        players
          .map(
            p =>
              p.contributed
          )
          .filter(
            n =>
              n > 0
          )
      )
    ]
    .sort(
      (a, b) =>
        a - b
    );

  const sidePots = [];

  let previous = 0;

  for (
    const level
    of levels
  ) {

    const contributors =
      players.filter(
        p =>
          p.contributed >=
          level
      );

    const amount =
      (
        level -
        previous
      ) *
      contributors.length;

    const eligible =
      contributors.filter(
        p =>
          !p.folded
      );

    if (
      amount > 0 &&
      eligible.length > 0
    ) {

      sidePots.push({
        amount,
        eligible
      });
    }

    previous =
      level;
  }

  return sidePots;
}


/* =========================================================
   GEWINNER EINER SPIELERLISTE
========================================================= */

function determineWinners(
  eligible
) {

  const evaluations =
    eligible.map(
      player => ({
        player,

        evaluation:
          evaluateBestHand([
            ...player.hand,
            ...community
          ])
      })
    );

  let best =
    evaluations[0];

  let winners =
    [best];

  for (
    let i = 1;
    i <
    evaluations.length;
    i++
  ) {

    const cmp =
      compareEvaluation(
        evaluations[i]
          .evaluation,

        best.evaluation
      );

    if (
      cmp > 0
    ) {

      best =
        evaluations[i];

      winners =
        [evaluations[i]];
    }

    else if (
      cmp === 0
    ) {

      winners.push(
        evaluations[i]
      );
    }
  }

  return {
    winners,
    bestHand:
      best.evaluation
  };
}


/* =========================================================
   SHOWDOWN
========================================================= */

async function showdown() {

  disableActionButtons(true);

  renderHands(true);

  const totalPot =
    pot;

  const sidePots =
    buildSidePots();

  const heroBefore =
    players[0].stack;

  const winnerIds =
    new Set();

  let displayBestHand =
    null;

  let displayWinners =
    [];

  for (
    const sidePot
    of sidePots
  ) {

    const result =
      determineWinners(
        sidePot.eligible
      );

    const winners =
      result.winners;

    const share =
      Math.floor(
        sidePot.amount /
        winners.length
      );

    let remainder =
      sidePot.amount -
      share *
      winners.length;

    for (
      const item
      of winners
    ) {

      item.player.stack +=
        share;

      winnerIds.add(
        item.player.id
      );

      if (
        remainder > 0
      ) {

        item.player.stack++;

        remainder--;
      }
    }

    if (
      !displayBestHand ||
      compareEvaluation(
        result.bestHand,
        displayBestHand
      ) > 0
    ) {

      displayBestHand =
        result.bestHand;

      displayWinners =
        winners;
    }
  }

  const heroGain =
    Math.max(
      0,
      players[0].stack -
      heroBefore
    );

  lastWin =
    heroGain;

  persistent.stats.biggestPot =
    Math.max(
      persistent.stats.biggestPot,
      totalPot
    );

  const heroWon =
    winnerIds.has(0);

  if (
    heroWon
  ) {

    persistent.stats.wins++;

  } else {

    persistent.stats.losses++;
  }

  persistent.stats.hands++;

  for (
    const id
    of winnerIds
  ) {

    highlightWinner(id);
  }

  const names =
    [
      ...winnerIds
    ]
    .map(
      id =>
        players[id].name
    )
    .join(" + ");

  message.textContent =
    `${names} gewinnt mit ${
      displayBestHand?.name ||
      "bester Hand"
    } · Pot ${fmt(totalPot)}`;

  pot = 0;

  handRunning =
    false;

  currentPlayer =
    -1;

  updateUI();

  newHandBtn.disabled =
    false;
}


/* =========================================================
   GEWINN DURCH FOLD
========================================================= */

async function finishByFold() {

  const winner =
    activePlayers()[0];

  const wonPot =
    pot;

  winner.stack +=
    wonPot;

  lastWin =
    winner.id === 0
      ? wonPot
      : 0;

  persistent.stats.biggestPot =
    Math.max(
      persistent.stats.biggestPot,
      wonPot
    );

  if (
    winner.id === 0
  ) {

    persistent.stats.wins++;

    message.textContent =
      `Du gewinnst ${fmt(wonPot)} Coins.`;

  } else {

    persistent.stats.losses++;

    message.textContent =
      `${winner.name} gewinnt ${fmt(wonPot)} Coins.`;
  }

  persistent.stats.hands++;

  highlightWinner(
    winner.id
  );

  pot = 0;

  handRunning =
    false;

  currentPlayer =
    -1;

  updateUI();

  newHandBtn.disabled =
    false;
}


/* =========================================================
   NEUE HAND
========================================================= */

async function startHand() {

  if (
    handRunning
  ) return;

  /*
    Falls jemand komplett pleite ist,
    bekommt er für diese Offline-Demo
    automatisch wieder Startchips.
  */

  for (
    const p
    of players
  ) {

    if (
      p.stack <= 0
    ) {

      p.stack =
        STARTING_STACK;
    }
  }

  clearWinnerClasses();

  for (
    const p
    of players
  ) {

    p.hand = [];

    p.folded = false;
    p.allIn = false;

    p.betStreet = 0;

    p.contributed = 0;

    p.acted = false;
  }

  pot = 0;

  community = [];

  currentBet = 0;

  lastWin = 0;

  street =
    "preflop";

  deck =
    shuffle(
      createDeck()
    );

  dealHoleCards();

  renderHands(false);

  renderCommunity();

  for (
    let i = 0;
    i < 4;
    i++
  ) {

    setPlayerAction(
      i,
      ""
    );
  }

  postBlinds();

  handRunning =
    true;

  newHandBtn.disabled =
    true;

  message.textContent =
    "Neue Hand.";

  updateUI();

  await sleep(400);

  if (
    currentPlayer === 0
  ) {

    prepareHeroButtons();

    message.textContent =
      "Du bist dran.";

  } else {

    disableActionButtons(true);

    await botAct(
      currentPlayer
    );

    await continueAction();
  }
}


/* =========================================================
   RESET
========================================================= */

function resetGame() {

  if (
    !confirm(
      "Komplettes Pokerspiel zurücksetzen?"
    )
  ) {

    return;
  }

  persistent.stacks = [
    STARTING_STACK,
    STARTING_STACK,
    STARTING_STACK,
    STARTING_STACK
  ];

  persistent.dealer = 0;

  persistent.stats =
    freshStats();

  buildPlayers();

  pot = 0;

  community = [];

  currentBet = 0;

  currentPlayer = -1;

  street = "idle";

  handRunning =
    false;

  lastWin = 0;

  renderHands(false);

  renderCommunity();

  message.textContent =
    "Drücke „NEUE RUNDE“";

  updateUI();
}


/* =========================================================
   STATISTIK
========================================================= */

function showStats() {

  statHands.textContent =
    fmt(
      persistent.stats.hands
    );

  statWins.textContent =
    fmt(
      persistent.stats.wins
    );

  statLosses.textContent =
    fmt(
      persistent.stats.losses
    );

  statBiggestPot.textContent =
    fmt(
      persistent.stats.biggestPot
    );

  statsDialog.showModal();
}


/* =========================================================
   EVENTS
========================================================= */

foldBtn.addEventListener(
  "click",
  heroFold
);

checkBtn.addEventListener(
  "click",
  heroCheck
);

callBtn.addEventListener(
  "click",
  heroCall
);

raiseBtn.addEventListener(
  "click",
  () => {

    if (
      currentPlayer === 0 &&
      handRunning
    ) {

      raisePanel
        .classList
        .toggle(
          "hidden"
        );
    }
  }
);

document
  .querySelectorAll(
    "[data-raise]"
  )
  .forEach(
    btn => {

      btn.addEventListener(
        "click",
        () =>
          heroRaise(
            btn.dataset.raise
          )
      );
    }
  );

newHandBtn.addEventListener(
  "click",
  async () => {

    persistent.dealer =
      (
        persistent.dealer +
        1
      ) % 4;

    await startHand();
  }
);

statsBtn.addEventListener(
  "click",
  showStats
);

closeStatsBtn.addEventListener(
  "click",
  () =>
    statsDialog.close()
);

newGameBtn.addEventListener(
  "click",
  resetGame
);


/* =========================================================
   START
========================================================= */

disableActionButtons(true);

renderHands(false);

renderCommunity();

message.textContent =
  "Drücke „NEUE RUNDE“";

updateUI();
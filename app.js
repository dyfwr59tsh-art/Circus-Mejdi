"use strict";

/* =========================
   GRUNDEINSTELLUNGEN
========================= */

const STARTING_STACK = 10000;
const SMALL_BLIND = 50;
const BIG_BLIND = 100;

const SUITS = ["♠","♥","♦","♣"];
const RANKS = [
  {r:"2",v:2},
  {r:"3",v:3},
  {r:"4",v:4},
  {r:"5",v:5},
  {r:"6",v:6},
  {r:"7",v:7},
  {r:"8",v:8},
  {r:"9",v:9},
  {r:"10",v:10},
  {r:"J",v:11},
  {r:"Q",v:12},
  {r:"K",v:13},
  {r:"A",v:14}
];

const PLAYER_NAMES = ["DU","MAX","LISA","TOM"];

const BOT_STYLE = {
  1:"careful",
  2:"balanced",
  3:"aggressive"
};


/* =========================
   DOM
========================= */

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


/* =========================
   STATE
========================= */

function freshStats(){
  return {
    hands:0,
    wins:0,
    losses:0,
    biggestPot:0
  };
}

function freshState(){
  return {
    stacks:[
      STARTING_STACK,
      STARTING_STACK,
      STARTING_STACK,
      STARTING_STACK
    ],
    dealer:0,
    stats:freshStats()
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem("offlinePokerStateV1");
    if(!raw) return freshState();

    const saved = JSON.parse(raw);
    const base = freshState();

    return {
      ...base,
      ...saved,
      stats:{
        ...base.stats,
        ...(saved.stats || {})
      }
    };
  }catch(e){
    return freshState();
  }
}

const persistent = loadState();

let players = [];
let deck = [];
let community = [];
let pot = 0;

let street = "idle";
let currentBet = 0;
let currentPlayer = 0;
let lastWin = 0;

let handRunning = false;
let heroFolded = false;


/* =========================
   PLAYER OBJEKTE
========================= */

function buildPlayers(){
  players = PLAYER_NAMES.map((name,i)=>({
    id:i,
    name,
    stack:persistent.stacks[i] ?? STARTING_STACK,
    hand:[],
    folded:false,
    allIn:false,
    betStreet:0,
    contributed:0,
    acted:false
  }));
}

buildPlayers();


/* =========================
   SPEICHERN
========================= */

function saveState(){
  persistent.stacks = players.map(p=>p.stack);
  localStorage.setItem(
    "offlinePokerStateV1",
    JSON.stringify(persistent)
  );
}


/* =========================
   HILFSFUNKTIONEN
========================= */

function fmt(n){
  return Math.round(n).toLocaleString("de-DE");
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}


/* =========================
   DECK
========================= */

function createDeck(){
  const cards = [];

  for(const suit of SUITS){
    for(const rank of RANKS){
      cards.push({
        rank:rank.r,
        value:rank.v,
        suit
      });
    }
  }

  return cards;
}

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

function drawCard(){
  return deck.pop();
}


/* =========================
   KARTEN-HTML
========================= */

function cardClass(card){
  return card.suit==="♥" || card.suit==="♦"
    ? "card red dealt"
    : "card dealt";
}

function cardHTML(card){
  return `
    <div class="${cardClass(card)}">
      ${card.rank}${card.suit}
    </div>
  `;
}

function cardBackHTML(){
  return `<div class="card card-back">★</div>`;
}


/* =========================
   UI PLAYER
========================= */

function playerEl(i){
  return $("player"+i);
}

function updatePlayerBoxes(){
  for(let i=0;i<4;i++){
    const el = playerEl(i);
    if(!el) continue;

    const coinEl = el.querySelector(".player-coins");
    if(coinEl) coinEl.textContent = fmt(players[i].stack);

    el.classList.toggle("folded",players[i].folded);
    el.classList.toggle("active",handRunning && currentPlayer===i);
  }
}

function setPlayerAction(i,text){
  const el = playerEl(i);
  if(!el) return;

  const action = el.querySelector(".player-action");
  if(action) action.textContent = text || "";
}


/* =========================
   KARTEN ANZEIGEN
========================= */

function renderHands(showBots=false){
  heroCardsEl.innerHTML =
    players[0].hand.map(cardHTML).join("");

  for(let i=1;i<4;i++){
    const el = playerEl(i);
    const cards = el.querySelector(".cards");

    if(!cards) continue;

    if(showBots){
      cards.innerHTML =
        players[i].hand.map(cardHTML).join("");
    }else{
      cards.innerHTML =
        cardBackHTML()+cardBackHTML();
    }
  }
}

function renderCommunity(){
  const html = [];

  for(let i=0;i<5;i++){
    if(community[i]){
      html.push(cardHTML(community[i]));
    }else{
      html.push(`<div class="card empty-card"></div>`);
    }
  }

  communityCardsEl.innerHTML = html.join("");
}


/* =========================
   GESAMT-UI
========================= */

function updateUI(){
  potValue.textContent = fmt(pot);

  balanceValue.textContent = fmt(players[0].stack);
  bottomBalance.textContent = fmt(players[0].stack);

  blindValue.textContent =
    `${fmt(SMALL_BLIND)} / ${fmt(BIG_BLIND)}`;

  betValue.textContent =
    fmt(players[0].betStreet);

  winValue.textContent =
    fmt(lastWin);

  const need =
    Math.max(
      0,
      currentBet - players[0].betStreet
    );

  callAmount.textContent =
    need>0 ? fmt(need) : "";

  updatePlayerBoxes();
  saveState();
}


/* =========================
   RESET STREET
========================= */

function resetStreetBets(){
  for(const p of players){
    p.betStreet = 0;
    p.acted = false;
  }

  currentBet = 0;
}


/* =========================
   BET HELPER
========================= */

function commitChips(player,amount){
  const pay = Math.min(amount,player.stack);

  player.stack -= pay;
  player.betStreet += pay;
  player.contributed += pay;
  pot += pay;

  if(player.stack===0){
    player.allIn = true;
  }

  if(player.betStreet>currentBet){
    currentBet = player.betStreet;
  }

  return pay;
}


/* =========================
   BLINDS
========================= */

function nextSeat(i){
  return (i+1)%4;
}

function postBlinds(){
  const sb = nextSeat(persistent.dealer);
  const bb = nextSeat(sb);

  commitChips(players[sb],SMALL_BLIND);
  commitChips(players[bb],BIG_BLIND);

  currentBet = BIG_BLIND;

  setPlayerAction(sb,`SB ${fmt(SMALL_BLIND)}`);
  setPlayerAction(bb,`BB ${fmt(BIG_BLIND)}`);

  currentPlayer = nextSeat(bb);
}


/* =========================
   DEAL
========================= */

function dealHoleCards(){
  for(let round=0;round<2;round++){
    for(let i=0;i<4;i++){
      players[i].hand.push(drawCard());
    }
  }
}


/* =========================
   AKTIVE SPIELER
========================= */

function activePlayers(){
  return players.filter(p=>!p.folded);
}

function activeNotAllIn(){
  return players.filter(
    p=>!p.folded && !p.allIn
  );
}

function onlyOneLeft(){
  return activePlayers().length===1;
}


/* =========================
   BETTING ROUND ENDE?
========================= */

function bettingRoundComplete(){
  const active = activeNotAllIn();

  if(active.length===0){
    return true;
  }

  return active.every(
    p =>
      p.acted &&
      p.betStreet===currentBet
  );
}


/* =========================
   NÄCHSTER SPIELER
========================= */

function nextActivePlayer(from){
  for(let n=1;n<=4;n++){
    const idx = (from+n)%4;
    const p = players[idx];

    if(
      !p.folded &&
      !p.allIn
    ){
      return idx;
    }
  }

  return -1;
}


/* =========================
   HERO BUTTONS
========================= */

function disableActionButtons(disabled=true){
  foldBtn.disabled = disabled;
  checkBtn.disabled = disabled;
  callBtn.disabled = disabled;
  raiseBtn.disabled = disabled;
}

function prepareHeroButtons(){
  const hero = players[0];

  if(
    !handRunning ||
    hero.folded ||
    hero.allIn ||
    currentPlayer!==0
  ){
    disableActionButtons(true);
    return;
  }

  const need =
    Math.max(
      0,
      currentBet - hero.betStreet
    );

  foldBtn.disabled = false;
  raiseBtn.disabled = false;

  if(need===0){
    checkBtn.disabled = false;
    callBtn.disabled = true;
  }else{
    checkBtn.disabled = true;
    callBtn.disabled = false;
  }
}


/* =========================
   PREFLOP-STÄRKE BOT
========================= */

function preflopStrength(hand){
  const [a,b] = hand;

  const high = Math.max(a.value,b.value);
  const low = Math.min(a.value,b.value);

  let score = high;

  if(a.value===b.value){
    score += 10 + high;
  }

  if(a.suit===b.suit){
    score += 2;
  }

  const gap = Math.abs(a.value-b.value);

  if(gap===1){
    score += 2;
  }else if(gap===2){
    score += 1;
  }

  if(high===14){
    score += 3;
  }

  if(high>=12 && low>=10){
    score += 3;
  }

  return score;
}


/* =========================
   POSTFLOP GROBE STÄRKE
========================= */

function botHandStrength(player){
  if(community.length===0){
    return preflopStrength(player.hand);
  }

  const result =
    evaluateBestHand(
      [...player.hand,...community]
    );

  return result.category*10 +
    result.tiebreak[0];
}


/* =========================
   BOT ENTSCHEIDUNG
========================= */

async function botAct(i){
  const p = players[i];

  if(
    p.folded ||
    p.allIn
  ){
    return;
  }

  await sleep(550 + Math.random()*500);

  const need =
    Math.max(
      0,
      currentBet-p.betStreet
    );

  const strength =
    botHandStrength(p);

  const style =
    BOT_STYLE[i];

  let foldThreshold = 10;
  let raiseThreshold = 22;

  if(style==="careful"){
    foldThreshold = 12;
    raiseThreshold = 25;
  }

  if(style==="aggressive"){
    foldThreshold = 8;
    raiseThreshold = 18;
  }

  const randomness =
    Math.random()*6;

  const adjusted =
    strength + randomness;

  if(
    need>0 &&
    adjusted<foldThreshold &&
    need>Math.max(BIG_BLIND,p.stack*.12)
  ){
    p.folded = true;
    p.acted = true;
    setPlayerAction(i,"PASSEN");

  }else if(
    adjusted>raiseThreshold &&
    p.stack>need+BIG_BLIND*2
  ){
    const raiseTo =
      Math.max(
        currentBet+BIG_BLIND*2,
        currentBet*2
      );

    const amount =
      raiseTo-p.betStreet;

    commitChips(p,amount);

    for(const other of players){
      if(other.id!==i && !other.folded){
        other.acted = false;
      }
    }

    p.acted = true;

    setPlayerAction(
      i,
      `ERHÖHEN ${fmt(p.betStreet)}`
    );

  }else if(need>0){

    commitChips(p,need);
    p.acted = true;

    setPlayerAction(
      i,
      `MITGEHEN ${fmt(need)}`
    );

  }else{

    p.acted = true;
    setPlayerAction(i,"CHECK");
  }

  updateUI();
}


/* =========================
   HERO AKTIONEN
========================= */

async function heroFold(){
  if(currentPlayer!==0) return;

  players[0].folded = true;
  players[0].acted = true;
  heroFolded = true;

  heroAction.textContent = "PASSEN";

  raisePanel.classList.add("hidden");

  updateUI();

  await continueAction();
}

async function heroCheck(){
  if(currentPlayer!==0) return;

  const need =
    Math.max(
      0,
      currentBet-players[0].betStreet
    );

  if(need!==0) return;

  players[0].acted = true;
  heroAction.textContent = "CHECK";

  raisePanel.classList.add("hidden");

  updateUI();

  await continueAction();
}

async function heroCall(){
  if(currentPlayer!==0) return;

  const need =
    Math.max(
      0,
      currentBet-players[0].betStreet
    );

  commitChips(players[0],need);

  players[0].acted = true;

  heroAction.textContent =
    `MITGEHEN ${fmt(need)}`;

  raisePanel.classList.add("hidden");

  updateUI();

  await continueAction();
}

async function heroRaise(multiplier){
  if(currentPlayer!==0) return;

  const hero = players[0];

  let target;

  if(multiplier==="allin"){
    target =
      hero.betStreet+hero.stack;
  }else{
    target =
      Math.max(
        BIG_BLIND*Number(multiplier),
        currentBet*Number(multiplier)
      );
  }

  target =
    Math.min(
      target,
      hero.betStreet+hero.stack
    );

  if(target<=currentBet){
    return;
  }

  const amount =
    target-hero.betStreet;

  commitChips(hero,amount);

  for(const p of players){
    if(p.id!==0 && !p.folded){
      p.acted = false;
    }
  }

  hero.acted = true;

  heroAction.textContent =
    multiplier==="allin"
      ? "ALL-IN"
      : `ERHÖHEN ${fmt(target)}`;

  raisePanel.classList.add("hidden");

  updateUI();

  await continueAction();
}


/* =========================
   ACTION LOOP
========================= */

async function continueAction(){
  if(onlyOneLeft()){
    await finishByFold();
    return;
  }

  if(bettingRoundComplete()){
    await advanceStreet();
    return;
  }

  currentPlayer =
    nextActivePlayer(currentPlayer);

  if(currentPlayer===-1){
    await advanceStreet();
    return;
  }

  updateUI();

  if(currentPlayer===0){
    prepareHeroButtons();
    message.textContent = "Du bist dran.";
    return;
  }

  disableActionButtons(true);

  await botAct(currentPlayer);

  await continueAction();
}


/* =========================
   STREET WEITER
========================= */

async function advanceStreet(){
  disableActionButtons(true);

  await sleep(500);

  if(street==="preflop"){
    street = "flop";

    community.push(
      drawCard(),
      drawCard(),
      drawCard()
    );

    message.textContent = "FLOP";

  }else if(street==="flop"){
    street = "turn";

    community.push(drawCard());

    message.textContent = "TURN";

  }else if(street==="turn"){
    street = "river";

    community.push(drawCard());

    message.textContent = "RIVER";

  }else if(street==="river"){
    await showdown();
    return;
  }

  renderCommunity();

  resetStreetBets();

  const first =
    nextActivePlayer(
      persistent.dealer
    );

  currentPlayer =
    first===-1 ? 0 : first;

  updateUI();

  await sleep(450);

  if(
    activeNotAllIn().length<=1
  ){
    await runOutBoard();
    return;
  }

  if(currentPlayer===0){
    prepareHeroButtons();
    message.textContent =
      `${street.toUpperCase()} · Du bist dran.`;
  }else{
    await botAct(currentPlayer);
    await continueAction();
  }
}


/* =========================
   BOARD BIS RIVER
========================= */

async function runOutBoard(){
  disableActionButtons(true);

  while(community.length<5){
    await sleep(450);
    community.push(drawCard());
    renderCommunity();
  }

  await showdown();
}


/* =========================
   FOLD-GEWINN
========================= */

async function finishByFold(){
  const winner =
    activePlayers()[0];

  winner.stack += pot;

  const wonPot = pot;

  lastWin =
    winner.id===0
      ? wonPot
      : 0;

  persistent.stats.biggestPot =
    Math.max(
      persistent.stats.biggestPot,
      wonPot
    );

  if(winner.id===0){
    persistent.stats.wins++;
    message.textContent =
      `Du gewinnst ${fmt(wonPot)} Coins.`;
  }else{
    persistent.stats.losses++;
    message.textContent =
      `${winner.name} gewinnt ${fmt(wonPot)} Coins.`;
  }

  persistent.stats.hands++;

  pot = 0;
  handRunning = false;

  highlightWinner(winner.id);

  updateUI();

  newHandBtn.disabled = false;
}


/* =========================
   HAND EVALUATION
========================= */

function combinations(arr,k){
  const out = [];

  function rec(start,pick){
    if(pick.length===k){
      out.push([...pick]);
      return;
    }

    for(let i=start;i<arr.length;i++){
      pick.push(arr[i]);
      rec(i+1,pick);
      pick.pop();
    }
  }

  rec(0,[]);
  return out;
}

function evaluateFive(cards){
  const values =
    cards
      .map(c=>c.value)
      .sort((a,b)=>b-a);

  const suits =
    cards.map(c=>c.suit);

  const counts = {};

  for(const v of values){
    counts[v] =
      (counts[v]||0)+1;
  }

  const groups =
    Object.entries(counts)
      .map(([v,c])=>({
        value:Number(v),
        count:c
      }))
      .sort(
        (a,b)=>
          b.count-a.count ||
          b.value-a.value
      );

  const flush =
    suits.every(
      s=>s===suits[0]
    );

  const unique =
    [...new Set(values)];

  let straightHigh = 0;

  if(
    unique.includes(14) &&
    unique.includes(5) &&
    unique.includes(4) &&
    unique.includes(3) &&
    unique.includes(2)
  ){
    straightHigh = 5;
  }else{
    for(let i=0;i<=unique.length-5;i++){
      if(
        unique[i]-
        unique[i+4]===4
      ){
        straightHigh =
          unique[i];
        break;
      }
    }
  }

  if(flush && straightHigh){
    return {
      category:8,
      name:"Straight Flush",
      tiebreak:[straightHigh]
    };
  }

  if(groups[0].count===4){
    return {
      category:7,
      name:"Vierling",
      tiebreak:[
        groups[0].value,
        groups[1].value
      ]
    };
  }

  if(
    groups[0].count===3 &&
    groups[1].count===2
  ){
    return {
      category:6,
      name:"Full House",
      tiebreak:[
        groups[0].value,
        groups[1].value
      ]
    };
  }

  if(flush){
    return {
      category:5,
      name:"Flush",
      tiebreak:values
    };
  }

  if(straightHigh){
    return {
      category:4,
      name:"Straight",
      tiebreak:[straightHigh]
    };
  }

  if(groups[0].count===3){
    const kickers =
      groups
        .filter(g=>g.count===1)
        .map(g=>g.value)
        .sort((a,b)=>b-a);

    return {
      category:3,
      name:"Drilling",
      tiebreak:[
        groups[0].value,
        ...kickers
      ]
    };
  }

  if(
    groups[0].count===2 &&
    groups[1].count===2
  ){
    const pairs =
      [groups[0].value,groups[1].value]
        .sort((a,b)=>b-a);

    const kicker =
      groups.find(g=>g.count===1)?.value || 0;

    return {
      category:2,
      name:"Zwei Paare",
      tiebreak:[
        ...pairs,
        kicker
      ]
    };
  }

  if(groups[0].count===2){
    const kickers =
      groups
        .filter(g=>g.count===1)
        .map(g=>g.value)
        .sort((a,b)=>b-a);

    return {
      category:1,
      name:"Ein Paar",
      tiebreak:[
        groups[0].value,
        ...kickers
      ]
    };
  }

  return {
    category:0,
    name:"High Card",
    tiebreak:values
  };
}

function compareEval(a,b){
  if(a.category!==b.category){
    return a.category-b.category;
  }

  const len =
    Math.max(
      a.tiebreak.length,
      b.tiebreak.length
    );

  for(let i=0;i<len;i++){
    const av = a.tiebreak[i]||0;
    const bv = b.tiebreak[i]||0;

    if(av!==bv){
      return av-bv;
    }
  }

  return 0;
}

function evaluateBestHand(cards){
  const combos =
    combinations(cards,5);

  let best = null;

  for(const combo of combos){
    const ev =
      evaluateFive(combo);

    if(
      !best ||
      compareEval(ev,best)>0
    ){
      best = ev;
    }
  }

  return best;
}


/* =========================
   SHOWDOWN
========================= */

async function showdown(){
  disableActionButtons(true);

  renderHands(true);

  const contenders =
    activePlayers();

  const evaluated =
    contenders.map(p=>({
      player:p,
      eval:evaluateBestHand(
        [...p.hand,...community]
      )
    }));

  let best =
    evaluated[0];

  let winners = [best];

  for(let i=1;i<evaluated.length;i++){
    const cmp =
      compareEval(
        evaluated[i].eval,
        best.eval
      );

    if(cmp>0){
      best = evaluated[i];
      winners = [evaluated[i]];
    }else if(cmp===0){
      winners.push(evaluated[i]);
    }
  }

  const share =
    Math.floor(
      pot/winners.length
    );

  for(const w of winners){
    w.player.stack += share;
  }

  const wonPot = pot;

  persistent.stats.biggestPot =
    Math.max(
      persistent.stats.biggestPot,
      wonPot
    );

  const heroWon =
    winners.some(
      w=>w.player.id===0
    );

  lastWin =
    heroWon
      ? share
      : 0;

  if(heroWon){
    persistent.stats.wins++;
  }else{
    persistent.stats.losses++;
  }

  persistent.stats.hands++;

  const winnerNames =
    winners
      .map(w=>w.player.name)
      .join(" + ");

  message.textContent =
    `${winnerNames} gewinnt mit ${best.eval.name} · Pot ${fmt(wonPot)}`;

  for(const w of winners){
    highlightWinner(
      w.player.id
    );
  }

  pot = 0;
  handRunning = false;

  updateUI();

  newHandBtn.disabled = false;
}


/* =========================
   WINNER HIGHLIGHT
========================= */

function clearWinnerClasses(){
  for(let i=0;i<4;i++){
    playerEl(i)?.classList.remove("winner");
  }
}

function highlightWinner(i){
  playerEl(i)?.classList.add("winner");
}


/* =========================
   NEUE HAND
========================= */

async function startHand(){
  if(handRunning) return;

  clearWinnerClasses();

  for(const p of players){
    p.hand = [];
    p.folded = false;
    p.allIn = false;
    p.betStreet = 0;
    p.contributed = 0;
    p.acted = false;
  }

  heroFolded = false;
  lastWin = 0;

  pot = 0;
  community = [];

  street = "preflop";
  currentBet = 0;

  deck = shuffle(createDeck());

  dealHoleCards();

  renderHands(false);
  renderCommunity();

  for(let i=0;i<4;i++){
    setPlayerAction(i,"");
  }

  postBlinds();

  handRunning = true;

  newHandBtn.disabled = true;

  message.textContent = "Neue Hand.";

  updateUI();

  await sleep(500);

  if(currentPlayer===0){
    prepareHeroButtons();
    message.textContent = "Du bist dran.";
  }else{
    disableActionButtons(true);
    await botAct(currentPlayer);
    await continueAction();
  }
}


/* =========================
   NEUES SPIEL
========================= */

function resetGame(){
  if(
    !confirm(
      "Komplettes Pokerspiel zurücksetzen?"
    )
  ){
    return;
  }

  persistent.stacks = [
    STARTING_STACK,
    STARTING_STACK,
    STARTING_STACK,
    STARTING_STACK
  ];

  persistent.dealer = 0;
  persistent.stats = freshStats();

  buildPlayers();

  pot = 0;
  community = [];
  street = "idle";
  currentBet = 0;
  lastWin = 0;
  handRunning = false;

  renderHands(false);
  renderCommunity();

  message.textContent =
    "Drücke „NEUE RUNDE“";

  updateUI();
}


/* =========================
   STATS
========================= */

function showStats(){
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


/* =========================
   EVENTS
========================= */

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
  ()=>{
    if(
      currentPlayer===0 &&
      handRunning
    ){
      raisePanel.classList.toggle("hidden");
    }
  }
);

document
  .querySelectorAll("[data-raise]")
  .forEach(btn=>{
    btn.addEventListener(
      "click",
      ()=>heroRaise(
        btn.dataset.raise
      )
    );
  });

newHandBtn.addEventListener(
  "click",
  async ()=>{
    persistent.dealer =
      (persistent.dealer+1)%4;

    await startHand();
  }
);

statsBtn.addEventListener(
  "click",
  showStats
);

closeStatsBtn.addEventListener(
  "click",
  ()=>statsDialog.close()
);

newGameBtn.addEventListener(
  "click",
  resetGame
);


/* =========================
   START
========================= */

disableActionButtons(true);

renderHands(false);
renderCommunity();

message.textContent =
  "Drücke „NEUE RUNDE“";

updateUI();
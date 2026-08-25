"use strict";

/* =========================
   GRUNDEINSTELLUNGEN
========================= */

const BETS = [
  20e6,
  50e6,
  100e6,
  200e6,
  500e6,
  1e9,
  2e9
];

const DEFAULT_BALANCE = 10e9;
const DEFAULT_JACKPOT = 6e9;


/* =========================
   SYMBOLE
========================= */

const SYMBOLS = [
  {id:"JUG",  image:"circus_clown_v2.png",    weight:5,  pay:{3:30,4:125,5:300}},
  {id:"ELE",  image:"circus_elephant_v2.png", weight:7,  pay:{3:25,4:80,5:250}},
  {id:"BEA",  image:"circus_bear_v2.png",     weight:9,  pay:{3:15,4:60,5:175}},
  {id:"PAN",  image:"circus_seal_v2.png",     weight:11, pay:{3:12,4:50,5:125}},
  {id:"HAT",  image:"hat.png",                weight:13, pay:{3:10,4:40,5:100}},
  {id:"A",    image:"circus_A_v2.png",        weight:17, pay:{3:7,4:25,5:60}},
  {id:"K",    image:"circus_K_v2.png",        weight:18, pay:{3:7,4:25,5:60}},
  {id:"Q",    image:"circus_Q_v2.png",        weight:20, pay:{3:5,4:15,5:40}},
  {id:"J",    image:"circus_J_v2.png",        weight:22, pay:{3:5,4:15,5:40}},
  {id:"WILD", image:"circus_wild_v2.png",     weight:3,  pay:{3:40,4:200,5:0}},
  {id:"SCAT", image:"scatter.png",             weight:0,  pay:{}}
];


/* =========================
   25 GEWINNLINIEN
========================= */

const LINES = [
  [0,0,0,0,0],
  [1,1,1,1,1],
  [2,2,2,2,2],

  [0,1,2,1,0],
  [2,1,0,1,2],

  [0,0,1,2,2],
  [2,2,1,0,0],

  [0,1,1,1,0],
  [2,1,1,1,2],

  [0,1,0,1,0],
  [2,1,2,1,2],

  [1,0,0,0,1],
  [1,2,2,2,1],

  [0,0,0,1,2],
  [2,2,2,1,0],

  [1,0,1,2,1],
  [1,2,1,0,1],

  [0,1,2,2,2],
  [2,1,0,0,0],

  [0,1,2,1,2],
  [2,1,0,1,0],

  [0,0,1,0,0],
  [2,2,1,2,2],

  [1,0,1,0,1],
  [1,2,1,2,1]
];


/* =========================
   SPIELSTAND
========================= */

function freshState(){
  return {
    balance: DEFAULT_BALANCE,
    betIndex: 0,
    jackpot: DEFAULT_JACKPOT,
    freeSpins: 0,

    stats:{
      spins:0,
      wagered:0,
      paid:0,
      biggestWin:0,
      freeSpinsWon:0
    }
  };
}


function loadState(){
  try{

    const raw =
      localStorage.getItem(
        "circusChanceStateV1"
      );

    if(!raw){
      return freshState();
    }

    const saved =
      JSON.parse(raw);

    const base =
      freshState();

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


const state = loadState();

let spinning = false;


/* =========================
   HTML-ELEMENTE
========================= */

const $ = id =>
  document.getElementById(id);

let reelsEl;
let balanceValue;
let betValue;
let winValue;
let jackpotValue;
let message;
let freeSpinsEl;


/* =========================
   SPEICHERN
========================= */

function saveState(){

  localStorage.setItem(
    "circusChanceStateV1",
    JSON.stringify(state)
  );
}


/* =========================
   ZAHLEN
========================= */

function fmt(n){

  return Math
    .round(n)
    .toLocaleString("de-DE");
}


function short(n){

  if(n >= 1e12){

    return (
      n / 1e12
    )
    .toFixed(2)
    .replace(".",",") + "T";
  }


  if(n >= 1e9){

    return (
      n / 1e9
    )
    .toFixed(
      n % 1e9 ? 1 : 0
    )
    .replace(".",",") + "B";
  }


  if(n >= 1e6){

    return (
      n / 1e6
    )
    .toFixed(
      n % 1e6 ? 1 : 0
    )
    .replace(".",",") + "M";
  }


  return fmt(n);
}


/* =========================
   SCATTER NUR AUF
   WALZE 1 / 3 / 5
========================= */

function allowedSymbolsForReel(reel){

  const arr =
    SYMBOLS.filter(
      s => s.id !== "SCAT"
    );


  if(
    reel === 0 ||
    reel === 2 ||
    reel === 4
  ){

    const scatter =
      SYMBOLS.find(
        s => s.id === "SCAT"
      );


    arr.push({
      ...scatter,
      weight:4
    });
  }


  return arr;
}


/* =========================
   ZUFALLSSYMBOL
========================= */

function weightedPick(arr){

  const total =
    arr.reduce(
      (sum,s) =>
        sum + s.weight,
      0
    );


  let r =
    Math.random() * total;


  for(const s of arr){

    r -= s.weight;

    if(r <= 0){
      return s;
    }
  }


  return arr[
    arr.length - 1
  ];
}


/* =========================
   SPIELFELD ERZEUGEN
========================= */

function makeGrid(){

  const grid = [];


  for(let c=0;c<5;c++){

    grid[c] = [];


    for(let r=0;r<3;r++){

      const base =
        weightedPick(
          allowedSymbolsForReel(c)
        );


      const cell = {
        ...base,
        bonus:0
      };


      if(
        c >= 2 &&
        !["SCAT","WILD"]
          .includes(cell.id) &&
        Math.random() < 0.16
      ){

        const multipliers =
          [0.5,1,2,4,8,20];


        const mult =
          multipliers[
            Math.floor(
              Math.random() *
              multipliers.length
            )
          ];


        cell.bonus =
          BETS[state.betIndex] *
          mult;
      }


      grid[c][r] = cell;
    }
  }


  return grid;
}


/* =========================
   EINZELNE GEWINNLINIE
========================= */

function lineResult(
  grid,
  line,
  bet
){

  let baseId = null;
  let count = 0;

  const coords = [];


  for(let c=0;c<5;c++){

    const symbol =
      grid[c][
        line[c]
      ];


    if(
      symbol.id === "SCAT"
    ){
      break;
    }


    if(
      baseId === null &&
      symbol.id !== "WILD"
    ){

      baseId =
        symbol.id;
    }


    if(
      baseId === null
    ){

      count++;

      coords.push([
        c,
        line[c]
      ]);

      continue;
    }


    if(
      symbol.id === baseId ||
      symbol.id === "WILD"
    ){

      count++;

      coords.push([
        c,
        line[c]
      ]);

    }else{

      break;
    }
  }


  if(
    baseId === null
  ){

    baseId = "WILD";
  }


  if(
    count < 3
  ){

    return {
      pay:0,
      coords:[]
    };
  }


  const sym =
    SYMBOLS.find(
      s =>
        s.id === baseId
    );


  if(!sym){

    return {
      pay:0,
      coords:[]
    };
  }


  /* 5 WILD = Jackpot */

  if(
    baseId === "WILD" &&
    count === 5
  ){

    return {
      pay:state.jackpot,
      coords
    };
  }


  let pay =
    bet *
    (
      sym.pay[count] ||
      0
    );


  for(
    const [c,r]
    of coords
  ){

    pay +=
      grid[c][r].bonus ||
      0;
  }


  return {
    pay,
    coords
  };
}


/* =========================
   SPIN AUSWERTEN
========================= */

function scoreGrid(
  grid,
  bet
){

  let total = 0;

  const wins =
    new Set();


  for(
    const line
    of LINES
  ){

    const result =
      lineResult(
        grid,
        line,
        bet
      );


    total +=
      result.pay;


    result.coords
      .forEach(
        ([c,r]) =>
          wins.add(
            c + "-" + r
          )
      );
  }


  /* =====================
     10 FREISPIELE

     Scatter auf
     Walze 1
     Walze 3
     Walze 5
  ===================== */

  const scatterReels =
    [0,2,4];


  const hasScatter =
    scatterReels.map(
      c =>
        grid[c].some(
          cell =>
            cell.id ===
            "SCAT"
        )
    );


  const freeTrigger =
    hasScatter
      .every(Boolean);


  const freeAward =
    freeTrigger
      ? 10
      : 0;


  let scatters = 0;


  for(
    const c
    of scatterReels
  ){

    for(
      let r=0;
      r<3;
      r++
    ){

      if(
        grid[c][r].id ===
        "SCAT"
      ){

        scatters++;


        if(
          freeTrigger
        ){

          wins.add(
            c + "-" + r
          );
        }
      }
    }
  }


  return {
    total,
    wins,
    scatters,
    freeAward,
    freeTrigger
  };
}


/* =========================
   SPIELFELD ANZEIGEN
========================= */

function renderGrid(
  grid,
  wins=new Set()
){

  if(!reelsEl){
    return;
  }


  reelsEl.innerHTML = "";


  for(let r=0;r<3;r++){

    for(let c=0;c<5;c++){

      const cell =
        grid[c][r];


      const div =
        document
          .createElement(
            "div"
          );


      div.className =
        "cell" +
        (
          wins.has(
            c + "-" + r
          )
          ? " win"
          : ""
        );


      const icon =
        document
          .createElement(
            "img"
          );


      icon.src =
        cell.image;

      icon.alt =
        cell.id;

      icon.className =
        "symbol-img";


      /* Falls PNG fehlt */

      icon.onerror = () => {

        icon.style.display =
          "none";

        div.textContent =
          "?";
      };


      div.appendChild(
        icon
      );


      if(cell.bonus){

        const bonus =
          document
            .createElement(
              "span"
            );


        bonus.className =
          "bonus";


        bonus.textContent =
          short(
            cell.bonus
          );


        div.appendChild(
          bonus
        );
      }


      div.style.gridColumn =
        String(c+1);


      div.style.gridRow =
        String(r+1);


      reelsEl.appendChild(
        div
      );
    }
  }
}


/* =========================
   ANZEIGE
========================= */

function updateUI(){

  balanceValue.textContent =
    fmt(
      state.balance
    );


  betValue.textContent =
    fmt(
      BETS[
        state.betIndex
      ]
    );


  jackpotValue.textContent =
    fmt(
      state.jackpot
    );


  if(
    state.freeSpins > 0
  ){

    freeSpinsEl
      .classList
      .remove(
        "hidden"
      );


    const strong =
      freeSpinsEl
        .querySelector(
          "strong"
        );


    if(strong){

      strong.textContent =
        state.freeSpins;
    }

  }else{

    freeSpinsEl
      .classList
      .add(
        "hidden"
      );
  }


  saveState();
}


/* =========================
   PAUSE
========================= */

function sleep(ms){

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


/* =========================
   WALZENBEWEGUNG
========================= */

async function animateReels(
  targetGrid
){

  let shown =
    makeGrid();


  /*
    Jede Walze stoppt
    etwas später.
  */

  const stopTimes = [
    550,
    800,
    1080,
    1390,
    1740
  ];


  const start =
    performance.now();


  const stopped = [
    false,
    false,
    false,
    false,
    false
  ];


  while(true){

    const elapsed =
      performance.now() -
      start;


    for(
      let c=0;
      c<5;
      c++
    ){

      /*
        Walze soll jetzt
        stoppen
      */

      if(
        elapsed >=
        stopTimes[c]
      ){

        if(
          !stopped[c]
        ){

          shown[c] =
            targetGrid[c]
              .map(
                cell =>
                  ({...cell})
              );


          stopped[c] =
            true;
        }


        continue;
      }


      /*
        Walze läuft noch
      */

      for(
        let r=0;
        r<3;
        r++
      ){

        const base =
          weightedPick(
            allowedSymbolsForReel(c)
          );


        shown[c][r] = {
          ...base,
          bonus:0
        };
      }
    }


    renderGrid(
      shown
    );


    if(
      stopped
        .every(Boolean)
    ){

      break;
    }


    /*
      Am Anfang schnell,
      zum Ende minimal
      langsamer.
    */

    const delay =
      elapsed < 900
        ? 42
        : 58;


    await sleep(
      delay
    );
  }


  renderGrid(
    targetGrid
  );
}


/* =========================
   EIN SPIN
========================= */

async function spin(
  oneOfAuto=false
){

  if(spinning){
    return;
  }


  const bet =
    BETS[
      state.betIndex
    ];


  const isFree =
    state.freeSpins > 0;


  if(
    !isFree &&
    state.balance < bet
  ){

    message.textContent =
      "Nicht genug Coins. Tippe auf COINS +.";

    return;
  }


  spinning = true;


  const spinBtn =
    $("spinBtn");


  if(spinBtn){

    spinBtn.disabled =
      true;
  }


  if(isFree){

    state.freeSpins--;

  }else{

    state.balance -=
      bet;


    state.stats.wagered +=
      bet;
  }


  state.stats.spins++;


  state.jackpot +=
    Math.round(
      bet * 0.002
    );


  const grid =
    makeGrid();


  await animateReels(
    grid
  );


  const result =
    scoreGrid(
      grid,
      bet
    );


  state.balance +=
    result.total;


  state.stats.paid +=
    result.total;


  state.stats.biggestWin =
    Math.max(
      state.stats.biggestWin,
      result.total
    );


  if(
    result.freeAward
  ){

    state.freeSpins +=
      result.freeAward;


    state.stats
      .freeSpinsWon +=
      result.freeAward;
  }


  /*
    Gewinner werden
    mit "win" markiert.
    Das CSS vergrößert
    diese Symbole.
  */

  renderGrid(
    grid,
    result.wins
  );


  winValue.textContent =
    fmt(
      result.total
    );


  if(
    result.freeAward
  ){

    message.textContent =
      "🎪 JOKER AUF WALZE 1 · 3 · 5 — 10 FREISPIELE!";


  }else if(
    result.total >=
    bet * 50
  ){

    message.textContent =
      `🎉 HUGE WIN: ${short(result.total)}`;


  }else if(
    result.total > 0
  ){

    message.textContent =
      `Gewinn: ${short(result.total)}`;


  }else{

    message.textContent =
      isFree
      ? "Freispin ohne Gewinn."
      : "Kein Gewinn.";
  }


  updateUI();


  spinning =
    false;


  if(spinBtn){

    spinBtn.disabled =
      false;
  }


  /*
    Freispiele automatisch
    nacheinander
  */

  if(
    !oneOfAuto &&
    state.freeSpins > 0
  ){

    /*
      Gewinnsymbole bleiben
      kurz sichtbar.
    */

    await sleep(
      850
    );


    spin();
  }
}


/* =========================
   AUTO ×10
========================= */

async function autoSpins(n){

  if(spinning){
    return;
  }


  for(
    let i=0;
    i<n;
    i++
  ){

    if(
      state.balance <
      BETS[state.betIndex] &&
      state.freeSpins === 0
    ){

      break;
    }


    await spin(true);


    await sleep(
      300
    );
  }
}


/* =========================
   EINSATZ ÄNDERN
========================= */

function setBet(delta){

  if(spinning){
    return;
  }


  state.betIndex =
    Math.min(
      BETS.length - 1,

      Math.max(
        0,

        state.betIndex +
        delta
      )
    );


  updateUI();
}


/* =========================
   COINS
========================= */

function addCoins(amount){

  if(
    !Number
      .isFinite(amount) ||
    amount <= 0
  ){

    return;
  }


  state.balance +=
    Math.floor(
      amount
    );


  message.textContent =
    `${short(amount)} virtuelle Coins hinzugefügt.`;


  updateUI();
}


/* =========================
   STATISTIK
========================= */

function showStats(){

  const s =
    state.stats;


  const rtp =
    s.wagered > 0

    ? (
        s.paid /
        s.wagered *
        100
      )

    : 0;


  $("statsContent")
    .innerHTML = `

    <div class="stat-grid">

      <div class="statbox">
        <span>Spins</span>
        <strong>
          ${fmt(s.spins)}
        </strong>
      </div>

      <div class="statbox">
        <span>Gesamteinsatz</span>
        <strong>
          ${short(s.wagered)}
        </strong>
      </div>

      <div class="statbox">
        <span>Auszahlungen</span>
        <strong>
          ${short(s.paid)}
        </strong>
      </div>

      <div class="statbox">
        <span>Session-RTP</span>
        <strong>
          ${
            rtp
              .toFixed(2)
              .replace(".",",")
          } %
        </strong>
      </div>

      <div class="statbox">
        <span>Größter Gewinn</span>
        <strong>
          ${short(s.biggestWin)}
        </strong>
      </div>

      <div class="statbox">
        <span>Freispiele erhalten</span>
        <strong>
          ${fmt(s.freeSpinsWon)}
        </strong>
      </div>

    </div>
  `;


  $("statsDialog")
    .showModal();
}


/* =========================
   BUTTONS VERBINDEN
========================= */

function bindButtons(){

  $("spinBtn")
    .addEventListener(
      "click",
      () => spin()
    );


  $("auto10")
    .addEventListener(
      "click",
      () =>
        autoSpins(10)
    );


  $("betDown")
    .addEventListener(
      "click",
      () =>
        setBet(-1)
    );


  $("betUp")
    .addEventListener(
      "click",
      () =>
        setBet(1)
    );


  $("addCoinsBtn")
    .addEventListener(
      "click",
      () =>
        $("coinsDialog")
          .showModal()
    );


  $("statsBtn")
    .addEventListener(
      "click",
      showStats
    );


  $("rulesBtn")
    .addEventListener(
      "click",
      () =>
        $("rulesDialog")
          .showModal()
    );


  document
    .querySelectorAll(
      "[data-add]"
    )
    .forEach(
      btn => {

        btn.addEventListener(
          "click",
          () =>
            addCoins(
              Number(
                btn.dataset.add
              )
            )
        );
      }
    );


  $("customCoinsBtn")
    .addEventListener(
      "click",
      () => {

        addCoins(
          Number(
            $("customCoins")
              .value
          )
        );


        $("customCoins")
          .value = "";
      }
    );


  $("resetStatsBtn")
    .addEventListener(
      "click",
      () => {

        if(
          confirm(
            "Statistik wirklich zurücksetzen?"
          )
        ){

          state.stats = {
            spins:0,
            wagered:0,
            paid:0,
            biggestWin:0,
            freeSpinsWon:0
          };


          saveState();

          showStats();
        }
      }
    );
}


/* =========================
   START DER APP
========================= */

function init(){

  reelsEl =
    $("reels");

  balanceValue =
    $("balanceValue");

  betValue =
    $("betValue");

  winValue =
    $("winValue");

  jackpotValue =
    $("jackpotValue");

  message =
    $("message");

  freeSpinsEl =
    $("freeSpins");


  bindButtons();


  renderGrid(
    makeGrid()
  );


  updateUI();


  if(
    "serviceWorker"
    in navigator
  ){

    navigator
      .serviceWorker
      .register("sw.js")
      .catch(
        () => {}
      );
  }
}


/*
  Funktioniert egal,
  ob app.js oben oder
  unten in index.html steht.
*/

if(
  document.readyState ===
  "loading"
){

  document
    .addEventListener(
      "DOMContentLoaded",
      init
    );

}else{

  init();
}
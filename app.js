
"use strict";

const BETS = [20e6, 50e6, 100e6, 200e6, 500e6, 1e9, 2e9];
const DEFAULT_BALANCE = 10e9;
const DEFAULT_JACKPOT = 6e9;

const SYMBOLS = [
  {id:"JUG",  icon:"💎", weight:5,  pay:{3:30,4:125,5:300}},
  {id:"ELE",  icon:"👑", weight:7,  pay:{3:25,4:80,5:250}},
  {id:"BEA",  icon:"🦁", weight:9,  pay:{3:15,4:60,5:175}},
  {id:"PAN",  icon:"🍀", weight:11, pay:{3:12,4:50,5:125}},
  {id:"HAT",  icon:"🔔", weight:13, pay:{3:10,4:40,5:100}},
  {id:"A",    icon:"⭐", weight:17, pay:{3:7,4:25,5:60}},
  {id:"K",    icon:"❤️", weight:18, pay:{3:7,4:25,5:60}},
  {id:"Q",    icon:"🍒", weight:20, pay:{3:5,4:15,5:40}},
  {id:"J",    icon:"🍋", weight:22, pay:{3:5,4:15,5:40}},
  {id:"WILD", icon:"🎪", weight:3,  pay:{3:40,4:200,5:0}},
  {id:"SCAT", icon:"🎰", weight:0,  pay:{}}
];

// 25 fixed paylines, row indices 0..2.
const LINES = [
 [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],
 [0,1,2,1,0],[2,1,0,1,2],
 [0,0,1,2,2],[2,2,1,0,0],
 [0,1,1,1,0],[2,1,1,1,2],
 [0,1,0,1,0],[2,1,2,1,2],
 [1,0,0,0,1],[1,2,2,2,1],
 [0,0,0,1,2],[2,2,2,1,0],
 [1,0,1,2,1],[1,2,1,0,1],
 [0,1,2,2,2],[2,1,0,0,0],
 [0,1,2,1,2],[2,1,0,1,0],
 [0,0,1,0,0],[2,2,1,2,2],
 [1,0,1,0,1],[1,2,1,2,1]
];

const state = loadState();
let spinning = false;

const $ = (id) => document.getElementById(id);
const reelsEl = $("reels");
const balanceValue = $("balanceValue");
const betValue = $("betValue");
const winValue = $("winValue");
const jackpotValue = $("jackpotValue");
const message = $("message");
const freeSpinsEl = $("freeSpins");

function freshState(){
  return {
    balance: DEFAULT_BALANCE,
    jackpot: DEFAULT_JACKPOT,
    betIndex: 0,
    freeSpins: 0,
    stats: {spins:0,wagered:0,paid:0,biggestWin:0,freeSpinsWon:0}
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem("circusChanceStateV1");
    if(!raw) return freshState();
    return Object.assign(freshState(), JSON.parse(raw));
  }catch(e){ return freshState(); }
}

function saveState(){
  localStorage.setItem("circusChanceStateV1", JSON.stringify(state));
}

function fmt(n){
  return Math.round(n).toLocaleString("de-DE");
}

function short(n){
  if(n>=1e12) return (n/1e12).toFixed(2).replace(".",",")+"T";
  if(n>=1e9) return (n/1e9).toFixed(n%1e9?1:0).replace(".",",")+"B";
  if(n>=1e6) return (n/1e6).toFixed(n%1e6?1:0).replace(".",",")+"M";
  return fmt(n);
}

function allowedSymbolsForReel(reel){
  const arr = SYMBOLS.filter(s => s.id !== "SCAT");
  if(reel===0 || reel===2 || reel===4) arr.push({id:"SCAT",icon:"🤡",weight:4,pay:{}});
  return arr;
}

function weightedPick(arr){
  const total = arr.reduce((a,s)=>a+s.weight,0);
  let r = Math.random()*total;
  for(const s of arr){ r -= s.weight; if(r<=0) return s; }
  return arr[arr.length-1];
}

function makeGrid(){
  const grid=[];
  for(let c=0;c<5;c++){
    grid[c]=[];
    for(let r=0;r<3;r++){
      const base=weightedPick(allowedSymbolsForReel(c));
      const cell={...base, bonus:0};
      if(c>=2 && !["SCAT","WILD"].includes(cell.id) && Math.random()<0.16){
        const mult=[0.5,1,2,4,8,20][Math.floor(Math.random()*6)];
        cell.bonus = BETS[state.betIndex]*mult;
      }
      grid[c][r]=cell;
    }
  }
  return grid;
}

function lineResult(grid,line,bet){
  let baseId = null;
  let count = 0;
  let coords = [];
  for(let c=0;c<5;c++){
    const s=grid[c][line[c]];
    if(s.id==="SCAT") break;
    if(baseId===null && s.id!=="WILD") baseId=s.id;
    if(baseId===null){ count++; coords.push([c,line[c]]); continue; }
    if(s.id===baseId || s.id==="WILD"){ count++; coords.push([c,line[c]]); }
    else break;
  }
  if(baseId===null) baseId="WILD";
  if(count<3) return {pay:0,coords:[]};
  const sym=SYMBOLS.find(s=>s.id===baseId);
  if(!sym) return {pay:0,coords:[]};
  if(baseId==="WILD" && count===5) return {pay:state.jackpot,coords};
  let pay = bet*(sym.pay[count]||0);
  for(const [c,r] of coords) pay += grid[c][r].bonus||0;
  return {pay,coords};
}

function scoreGrid(grid,bet){
  let total=0;
  const wins=new Set();
  for(const line of LINES){
    const res=lineResult(grid,line,bet);
    total += res.pay;
    res.coords.forEach(([c,r])=>wins.add(c+"-"+r));
  }

  let scatters=0;
  for(let c=0;c<5;c++) for(let r=0;r<3;r++) if(grid[c][r].id==="SCAT") scatters++;
  let freeAward=0;
  if(scatters>=3){
    freeAward=7;
    // Small scatter payment in addition to free spins.
    total += bet*(scatters===3?2:scatters===4?5:10);
  }
  return {total,wins,scatters,freeAward};
}

function renderGrid(grid,wins=new Set()){
  reelsEl.innerHTML="";
  for(let r=0;r<3;r++){
    for(let c=0;c<5;c++){
      const cell=grid[c][r];
      const div=document.createElement("div");
      div.className="cell"+(wins.has(c+"-"+r)?" win":"");
      const icon=document.createElement("span");
      icon.textContent=cell.icon;
      div.appendChild(icon);
      if(cell.bonus){
        const b=document.createElement("span");
        b.className="bonus";
        b.textContent=short(cell.bonus);
        div.appendChild(b);
      }
      div.style.gridColumn=String(c+1);
      div.style.gridRow=String(r+1);
      reelsEl.appendChild(div);
    }
  }
}

function updateUI(){
  balanceValue.textContent=fmt(state.balance);
  betValue.textContent=fmt(BETS[state.betIndex]);
  jackpotValue.textContent=fmt(state.jackpot);
  if(state.freeSpins>0){
    freeSpinsEl.classList.remove("hidden");
    freeSpinsEl.querySelector("strong").textContent=state.freeSpins;
  } else freeSpinsEl.classList.add("hidden");
  saveState();
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function spin(oneOfAuto=false){
  if(spinning) return;
  const bet=BETS[state.betIndex];
  const isFree=state.freeSpins>0;
  if(!isFree && state.balance<bet){
    message.textContent="Nicht genug Coins. Tippe auf COINS +.";
    return;
  }
  spinning=true;
  $("spinBtn").disabled=true;

  if(isFree) state.freeSpins--;
  else {
    state.balance-=bet;
    state.stats.wagered+=bet;
  }
  state.stats.spins++;
  state.jackpot += Math.round(bet*0.002);

  for(let i=0;i<5;i++){
    renderGrid(makeGrid());
    await sleep(45);
  }

  const grid=makeGrid();
  const result=scoreGrid(grid,bet);
  state.balance+=result.total;
  state.stats.paid+=result.total;
  state.stats.biggestWin=Math.max(state.stats.biggestWin,result.total);
  if(result.freeAward){
    state.freeSpins+=result.freeAward;
    state.stats.freeSpinsWon+=result.freeAward;
  }

  renderGrid(grid,result.wins);
  winValue.textContent=fmt(result.total);

  if(result.freeAward){
    message.textContent=`🎟 ${result.scatters} Scatter: ${result.freeAward} Freispiele · Gewinn ${short(result.total)}`;
  }else if(result.total>=bet*50){
    message.textContent=`🎉 HUGE WIN: ${short(result.total)}`;
  }else if(result.total>0){
    message.textContent=`Gewinn: ${short(result.total)}`;
  }else{
    message.textContent=isFree?"Freispin ohne Gewinn.":"Kein Gewinn.";
  }

  updateUI();
  spinning=false;
  $("spinBtn").disabled=false;

  if(!oneOfAuto && state.freeSpins>0){
    await sleep(350);
    spin();
  }
}

async function autoSpins(n){
  if(spinning) return;
  for(let i=0;i<n;i++){
    if(state.balance<BETS[state.betIndex] && state.freeSpins===0) break;
    await spin(true);
    await sleep(130);
  }
}

function setBet(delta){
  if(spinning) return;
  state.betIndex=Math.min(BETS.length-1,Math.max(0,state.betIndex+delta));
  updateUI();
}

function addCoins(amount){
  if(!Number.isFinite(amount) || amount<=0) return;
  state.balance += Math.floor(amount);
  message.textContent=`${short(amount)} virtuelle Coins hinzugefügt.`;
  updateUI();
}

function showStats(){
  const s=state.stats;
  const rtp=s.wagered>0 ? (s.paid/s.wagered*100) : 0;
  $("statsContent").innerHTML=`
    <div class="stat-grid">
      <div class="statbox"><span>Spins</span><strong>${fmt(s.spins)}</strong></div>
      <div class="statbox"><span>Gesamteinsatz</span><strong>${short(s.wagered)}</strong></div>
      <div class="statbox"><span>Auszahlungen</span><strong>${short(s.paid)}</strong></div>
      <div class="statbox"><span>Session-RTP</span><strong>${rtp.toFixed(2).replace(".",",")} %</strong></div>
      <div class="statbox"><span>Größter Gewinn</span><strong>${short(s.biggestWin)}</strong></div>
      <div class="statbox"><span>Freispiele erhalten</span><strong>${fmt(s.freeSpinsWon)}</strong></div>
    </div>`;
  $("statsDialog").showModal();
}

$("spinBtn").addEventListener("click",()=>spin());
$("auto10").addEventListener("click",()=>autoSpins(10));
$("betDown").addEventListener("click",()=>setBet(-1));
$("betUp").addEventListener("click",()=>setBet(1));
$("addCoinsBtn").addEventListener("click",()=>$("coinsDialog").showModal());
$("statsBtn").addEventListener("click",showStats);
$("rulesBtn").addEventListener("click",()=>$("rulesDialog").showModal());

document.querySelectorAll("[data-add]").forEach(btn=>{
  btn.addEventListener("click",()=>addCoins(Number(btn.dataset.add)));
});

$("customCoinsBtn").addEventListener("click",()=>{
  addCoins(Number($("customCoins").value));
  $("customCoins").value="";
});

$("resetStatsBtn").addEventListener("click",()=>{
  if(confirm("Statistik wirklich zurücksetzen?")){
    state.stats={spins:0,wagered:0,paid:0,biggestWin:0,freeSpinsWon:0};
    saveState();
    showStats();
  }
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

renderGrid(makeGrid());
updateUI();

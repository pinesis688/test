// ===== 主入口: 事件绑定、初始化 =====

// 开始游戏
function doStart(){
if(State.timed===0&&State.hints===0)State.hints=1;
if(!newGame()){openSettings();return}
showGame();
}

// 事件绑定
function bindEvents(){
document.getElementById('avatarBtn').onclick=openSettings;
document.getElementById('signinBtn').onclick=doSignin;
document.getElementById('startBtn').onclick=doStart;
document.getElementById('tabBook').onclick=showLibrary;
document.getElementById('tabStats').onclick=showStats;
document.getElementById('spClose').onclick=closeSettings;
document.getElementById('spGo').onclick=()=>{closeSettings();if(newGame()){showGame()}};
document.getElementById('homeBtn').onclick=()=>{hideModal();showHome()};
document.getElementById('helpBtn').onclick=showHelp;
document.getElementById('statsBtn').onclick=showStats;
document.getElementById('hintBtn').onclick=useHint;
document.getElementById('excludeBtn').onclick=useExclude;
document.getElementById('surrenderBtn').onclick=surrender;
document.getElementById('dictBtn').onclick=showDictLookup;
document.addEventListener('keydown',e=>{if(!document.getElementById('game').classList.contains('show'))return;if(e.key==='Enter')handleKey('ENTER');else if(e.key==='Backspace')handleKey('BACKSPACE');else if(/^[a-zA-Z]$/.test(e.key))handleKey(e.key.toUpperCase())});
window.addEventListener('resize',()=>{if(document.getElementById('game').classList.contains('show')&&!State.gameOver){const size=tileSize();State.rows.forEach(row=>row.forEach(t=>{t.style.width=size+'px';t.style.height=size+'px';t.style.fontSize=(size*0.5)+'px'}))}})
}

// 初始化
function init(){buildDiffTabs();updateHomeCounts();bindEvents()}
document.addEventListener('DOMContentLoaded',init);

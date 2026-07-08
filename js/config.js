// ===== 配置与状态 =====
'use strict';

const SK='wordle_zh_v6';
const DIFFICULTIES=[{id:'gaokao',name:'高考',sub:'基础'},{id:'cet4',name:'四级',sub:'CET-4'},{id:'cet6',name:'六级',sub:'CET-6'},{id:'kaoyan',name:'考研',sub:'研究生'},{id:'ielts',name:'雅思',sub:'IELTS'}];
const DIFF_ORDER=['gaokao','cet4','cet6','kaoyan','ielts'];
const LENGTHS=[4,5,6,7];
const ATTEMPTS=[6,8,10];
const HINTS=[0,1,2,3];
const EXCLUDE_COUNTS=[0,1,2,3,4,5,6];
const TIMED=[0,60,120,180];

function loadStats(){try{return JSON.parse(localStorage.getItem(SK+'_stats')||'{}')}catch(e){return{}}}
function saveStats(){localStorage.setItem(SK+'_stats',JSON.stringify(State.stats))}

function getWordPool(diff,len){const idx=DIFF_ORDER.indexOf(diff);let pool=[];for(let i=0;i<=idx;i++){const d=DIFF_ORDER[i];if(VOCAB[d]&&VOCAB[d][len])pool=pool.concat(VOCAB[d][len])}return pool}
function rebuildValidSet(){State.validSet=new Set();for(let i=0;i<=DIFF_ORDER.indexOf(State.diff);i++){const d=DIFF_ORDER[i];if(VOCAB[d]&&VOCAB[d][State.len])VOCAB[d][State.len].forEach(w=>State.validSet.add(w))}}

// 签到存储
function dateKey(d){return d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+d.getDate().toString().padStart(2,'0')}
function loadSignin(){try{return JSON.parse(localStorage.getItem(SK+'_signin')||'{}')}catch(e){return{}}}
function saveSignin(d){localStorage.setItem(SK+'_signin',JSON.stringify(d))}

// 全局状态
window.State={
diff:'gaokao',len:5,attempts:6,hints:1,excludeCount:2,timed:0,
answer:'',wordPool:[],validSet:new Set(),
rows:[],curRow:0,curCol:0,
hintLocked:{},hintsUsed:0,hintsLeft:0,
excludeUsed:false,excludedLetters:new Set(),
gameOver:false,won:false,
keyState:{},
timer:null,startTime:0,endTime:0,timeLeft:0,
stats:loadStats()
};

// ===== UI: 首页、设置、游戏信息、弹窗、统计、词库、查词、签到 =====

// 首页难度 tab
function buildDiffTabs(){const tabs=document.getElementById('diffTabs');tabs.innerHTML='';DIFFICULTIES.forEach(d=>{const b=document.createElement('button');b.className='diff-tab'+(State.diff===d.id?' active':'');b.textContent=d.name;b.onclick=()=>{State.diff=d.id;buildDiffTabs();updateHomeCounts()};tabs.appendChild(b)})}
function updateHomeCounts(){const now=new Date();const dateStr=(now.getMonth()+1).toString().padStart(2,'0')+'/'+now.getDate().toString().padStart(2,'0')+' '+['日','一','二','三','四','五','六'][now.getDay()];const sd=document.getElementById('signinDate');if(sd)sd.textContent=dateStr;const k=State.diff+'_'+State.len+'_'+State.timed+'_'+State.excludeCount+'_'+State.hints;const s=State.stats[k];const gc=document.getElementById('gameCount');if(gc)gc.textContent=(s?s.played:0)+' 局';const sg=loadSignin();const ss=document.getElementById('signinStreak');if(ss)ss.textContent=sg.streak||0;const sub=document.getElementById('signinSub');if(sub)sub.textContent=sg.lastDate===dateKey(now)?'今日已签到':'点击签到'}

// 设置面板
function openSettings(){document.getElementById('settingsPanel').classList.add('show');buildSpOptions()}
function closeSettings(){document.getElementById('settingsPanel').classList.remove('show')}
function buildSpOptions(){buildSpOpts('spDiffOpts',DIFFICULTIES,State.diff,renderSpDiff);buildSpOpts('spLenOpts',LENGTHS,LENGTHS.indexOf(State.len),renderSpNum);buildSpOpts('spAttemptOpts',ATTEMPTS,ATTEMPTS.indexOf(State.attempts),renderSpNum);buildSpOpts('spHintOpts',HINTS,HINTS.indexOf(State.hints),renderSpNum);buildSpOpts('spExcludeOpts',EXCLUDE_COUNTS,EXCLUDE_COUNTS.indexOf(State.excludeCount),renderSpExclude);buildSpOpts('spTimedOpts',TIMED,TIMED.indexOf(State.timed),renderSpTimed);const d=DIFFICULTIES.find(x=>x.id===State.diff);const cnt=getWordPool(State.diff,State.len).length;document.getElementById('spDiffHint').textContent=`${d.name} · ${cnt}词`}
function buildSpOpts(id,items,current,render){const c=document.getElementById(id);c.innerHTML='';items.forEach((it,i)=>{const b=document.createElement('button');b.className='sp-opt'+(i===current||(typeof current==='string'&&it.id===current)?' active':'');render(b,it);b.onclick=()=>{c.querySelectorAll('.sp-opt').forEach(x=>x.classList.remove('active'));b.classList.add('active');onSpSelect(id,it)};c.appendChild(b)})}
function renderSpDiff(b,it){b.innerHTML=`${it.name}<small>${it.sub}</small>`}
function renderSpNum(b,it){b.textContent=it}
function renderSpTimed(b,it){b.textContent=it===0?'关闭':it+'s'}
function renderSpExclude(b,it){b.textContent=it===0?'无':it}
function onSpSelect(id,item){if(id==='spDiffOpts'){State.diff=item.id;const d=DIFFICULTIES.find(x=>x.id===State.diff);document.getElementById('spDiffHint').textContent=`${d.name} · ${getWordPool(State.diff,State.len).length}词`}else if(id==='spLenOpts')State.len=item;else if(id==='spAttemptOpts')State.attempts=item;else if(id==='spHintOpts')State.hints=item;else if(id==='spExcludeOpts')State.excludeCount=item;else if(id==='spTimedOpts')State.timed=item}

// 游戏信息条
function updateGameInfo(){const d=DIFFICULTIES.find(x=>x.id===State.diff);const cand=countCandidates();let html=`<span>难度<b>${d.name}</b></span><span>长度<b>${State.len}</b></span><span>提示<b>${State.hintsLeft}</b></span><span>候选<b>${cand}</b></span>`;if(State.timed>0&&State.startTime>0){const warn=State.timeLeft<=10?' warn':'';html+=`<span class="timer${warn}">⏱ ${fmtTime(State.timeLeft)}</span>`}document.getElementById('gameInfo').innerHTML=html;const hb=document.getElementById('hintBtn');if(hb){hb.disabled=State.hintsLeft<=0||State.gameOver;hb.style.display=State.hints>0?'flex':'none'}const eb=document.getElementById('excludeBtn');if(eb){eb.disabled=State.excludeUsed||State.gameOver;eb.style.display=State.excludeCount>0?'flex':'none'}}

// 统计
function statKey(){return State.diff+'_'+State.len+'_'+State.timed+'_'+State.excludeCount+'_'+State.hints}
function recordResult(won,guesses){const k=statKey();if(!State.stats[k])State.stats[k]={played:0,won:0,streak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]};const s=State.stats[k];s.played++;if(won){s.won++;s.streak++;if(s.streak>s.maxStreak)s.maxStreak=s.streak;if(guesses&&guesses<=10)s.dist[guesses-1]++}else s.streak=0;saveStats();updateHomeCounts();setTimeout(()=>showResult(won),300)}
function buildResultModal(won){const s=State.stats[statKey()]||{played:0,won:0,streak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]};const winRate=s.played?Math.round(s.won/s.played*100):0;const maxD=Math.max(1,...s.dist);const lastWin=State.rows.findIndex(r=>r&&r.every(t=>t.classList.contains('correct')));let distHtml='';for(let i=0;i<State.attempts;i++){const cnt=s.dist[i]||0;distHtml+=`<div class="dr"><div class="dn">${i+1}</div><div class="db${i===lastWin?' hl':''}" style="width:${Math.max(8,cnt/maxD*100)}%">${cnt}</div></div>`}const dict=typeof DICT!=='undefined'?DICT[State.answer]:null;const meaning=typeof MEAN!=='undefined'?(MEAN[State.answer]||'(暂无释义)'):'(暂无释义)';const elapsed=Math.floor(gameElapsed()/1000);let dictHtml='';if(dict){dictHtml=`<div class="mphon">${dict.p}</div><div class="mpos">${dict.s}</div><div class="mex">${dict.e}</div>`}const timedLabel=State.timed>0?` · 限时${State.timed}s`:'';document.getElementById('modalContent').innerHTML=`<div class="mt">${won?'恭喜!':'游戏结束'}</div><div class="mst">${won?`第${lastWin+1}次猜中`:'未能猜出答案'}${State.startTime>0?` · 用时 ${fmtTime(elapsed)}`:''}</div><div class="mw">${State.answer}</div>${dictHtml}<div class="mm">${meaning}</div><div class="dt">猜词分布 (${DIFFICULTIES.find(x=>x.id===State.diff).name} · ${State.len}字母${timedLabel})</div>${distHtml}<div class="stats"><div class="si"><div class="sn">${s.played}</div><div class="sl">总场次</div></div><div class="si"><div class="sn">${winRate}%</div><div class="sl">胜率</div></div><div class="si"><div class="sn">${s.streak}</div><div class="sl">连胜</div></div><div class="si"><div class="sn">${s.maxStreak}</div><div class="sl">最长连胜</div></div></div><div class="mb"><button class="mbtn sh" id="shareBtn">分享</button><button class="mbtn p" id="playAgain">再来一局</button><button class="mbtn s" id="backHome">首页</button></div>`;showModal();document.getElementById('playAgain').onclick=()=>{hideModal();newGame()};document.getElementById('backHome').onclick=()=>{hideModal();showHome()};document.getElementById('shareBtn').onclick=shareResult}
function showResult(won){buildResultModal(won)}
function shareResult(){let text=`Wordle ${DIFFICULTIES.find(x=>x.id===State.diff).name} ${State.len}字母`;if(State.won){text+=` ${State.curRow+1}/${State.attempts}\n`}else{text+=` X/${State.attempts}\n`}const rowsToShow=State.gameOver?State.curRow+1:State.curRow;for(let r=0;r<rowsToShow;r++){if(!State.rows[r])break;const row=State.rows[r];let line='';let hasContent=false;for(let c=0;c<State.len;c++){const t=row[c];if(t.classList.contains('correct')){line+='🟩';hasContent=true}else if(t.classList.contains('present')){line+='🟨';hasContent=true}else if(t.classList.contains('locked')&&!t.classList.contains('correct')&&!t.classList.contains('present')&&!t.classList.contains('absent')){line+='🟦';hasContent=true}else if(t.classList.contains('absent')){line+='⬛';hasContent=true}else if(t.textContent){line+='⬛';hasContent=true}}if(hasContent)text+=line+'\n'}const finalText=text.trim();if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(finalText).then(()=>toast('已复制到剪贴板')).catch(()=>toast('复制失败'))}else{const ta=document.createElement('textarea');ta.value=finalText;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('已复制到剪贴板')}catch(e){toast('复制失败')}document.body.removeChild(ta)}}
function showStats(){const s=State.stats[statKey()]||{played:0,won:0,streak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]};const winRate=s.played?Math.round(s.won/s.played*100):0;const maxD=Math.max(1,...s.dist);let distHtml='';for(let i=0;i<10;i++){const cnt=s.dist[i]||0;distHtml+=`<div class="dr"><div class="dn">${i+1}</div><div class="db" style="width:${Math.max(8,cnt/maxD*100)}%">${cnt}</div></div>`}const timedLabel=State.timed>0?` · 限时${State.timed}s`:'';document.getElementById('modalContent').innerHTML=`<div class="mt">统计</div><div class="mst">${DIFFICULTIES.find(x=>x.id===State.diff).name} · ${State.len}字母${timedLabel}</div><div class="stats"><div class="si"><div class="sn">${s.played}</div><div class="sl">总场次</div></div><div class="si"><div class="sn">${winRate}%</div><div class="sl">胜率</div></div><div class="si"><div class="sn">${s.streak}</div><div class="sl">连胜</div></div><div class="si"><div class="sn">${s.maxStreak}</div><div class="sl">最长连胜</div></div></div><div class="dt">猜词分布</div>${distHtml}<div class="mb"><button class="mbtn p" id="closeStats">关闭</button></div>`;showModal();document.getElementById('closeStats').onclick=hideModal}
function showHelp(){document.getElementById('modalContent').innerHTML=`<div class="mt">玩法</div><div class="mst">在 ${State.attempts} 次内猜出 ${State.len} 字母单词</div><div class="help-list"><div class="hi"><div class="hts"><div class="hti correct">W</div></div><div>字母正确且位置正确</div></div><div class="hi"><div class="hts"><div class="hti present">O</div></div><div>字母正确但位置错误</div></div><div class="hi"><div class="hts"><div class="hti absent">D</div></div><div>字母不在单词中</div></div><div class="hi"><div class="hts"><div class="hti locked">?</div></div><div>提示锁定某位置字母(跨行持久)</div></div><div class="hi"><div class="hts"><div class="hti excluded">E</div></div><div>排除:确认不在答案中的字母</div></div></div><div class="dt">辅助功能</div><div class="help-list"><div class="hi">💡 <b>提示</b>:锁定一个正确字母位置,跨行持久(数量首页可选 0-3)</div><div class="hi">🚫 <b>排除</b>:自动排除不在答案中的字母(数量首页可选 0-6,每局1次)</div><div class="hi">🏳️ <b>放弃</b>:结束本局并显示答案</div><div class="hi">⏱ <b>限时</b>:倒计时模式,时间到自动判负</div><div class="hi">📊 <b>候选</b>:实时显示剩余可能词数</div></div><button class="hclose" id="closeHelp">明白了</button>`;showModal();document.getElementById('closeHelp').onclick=hideModal}

// 弹窗与 toast
function showModal(){document.getElementById('modal').classList.add('show')}
function hideModal(){document.getElementById('modal').classList.remove('show')}
let toastTimer;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1600)}
function toggleTheme(){toast('主题切换开发中')}

// 签到
function doSignin(){
const today=dateKey(new Date());
const data=loadSignin();
if(data.lastDate===today){toast(`今天已签到 · 连续${data.streak}天`);return}
const yesterday=dateKey(new Date(Date.now()-86400000));
if(data.lastDate===yesterday)data.streak++;else data.streak=1;
data.lastDate=today;data.totalDays=(data.totalDays||0)+1;
saveSignin(data);
updateHomeCounts();
toast(`签到成功!连续${data.streak}天`);
showSigninResult(data);
}
function showSigninResult(d){
const exp=d.streak>=7?'本周全勤奖励':d.streak>=3?'连续3天+':d.streak>=1?'坚持就是胜利':'开始你的签到';
document.getElementById('modalContent').innerHTML=`<div class="mt">签到成功</div><div class="mst">${dateKey(new Date())}</div><div class="stats" style="margin:18px 0"><div class="si"><div class="sn" style="color:#ff6b1a">${d.streak}</div><div class="sl">连续天数</div></div><div class="si"><div class="sn">${d.totalDays}</div><div class="sl">累计签到</div></div></div><div class="mex" style="font-style:normal;text-align:center">${exp}</div><div class="mb"><button class="mbtn p" id="signinGo">开始游戏</button><button class="mbtn s" id="signinClose">关闭</button></div>`;
showModal();
document.getElementById('signinGo').onclick=()=>{hideModal();doStart()};
document.getElementById('signinClose').onclick=hideModal;
}

// 词库 (tabBook)
function showLibrary(){
document.getElementById('modalContent').innerHTML=`<div class="mt">词库</div><div class="mst">对照牛津词典 · 5难度×4长度</div><div class="lib-search"><input type="text" id="libInput" placeholder="输入单词查词..." maxlength="10" autocomplete="off"><button class="lib-btn" id="libSearch">查询</button></div><div class="lib-list" id="libList"></div><div class="lib-stats" id="libStats"></div><div class="mb"><button class="mbtn s" id="closeLib">关闭</button></div>`;
showModal();
const input=document.getElementById('libInput');
const list=document.getElementById('libList');
const stats=document.getElementById('libStats');
let cnt=0;for(const d in VOCAB)for(const l in VOCAB[d])cnt+=VOCAB[d][l].length;
stats.innerHTML=`<div style="font-size:11px;opacity:.7;margin:6px 0">共 ${cnt} 词 · ${Object.keys(DICT).length}+ 词有牛津释义</div>`;
function render(words){
if(!words.length){list.innerHTML='<div style="text-align:center;opacity:.6;padding:20px">未找到该词</div>';return}
let html='';
words.slice(0,100).forEach(w=>{
const hasDict=!!DICT[w];
const mean=MEAN[w]||'';
html+=`<div class="lib-item ${hasDict?'has-dict':''}" data-word="${w}"><span class="lw">${w}</span>${hasDict?'<span class="ld">📖</span>':'<span class="ld" style="opacity:.3">·</span>'}<span class="lm">${mean}</span></div>`;
});
if(words.length>100)html+=`<div style="text-align:center;opacity:.5;padding:8px;font-size:11px">...还有 ${words.length-100} 个</div>`;
list.innerHTML=html;
list.querySelectorAll('.lib-item').forEach(el=>{el.onclick=()=>showWordDetail(el.dataset.word)});
}
const allWords=[];for(const d in VOCAB)for(const l in VOCAB[d])allWords.push(...VOCAB[d][l]);
const uniqueWords=[...new Set(allWords)].sort();
render(uniqueWords.slice(0,100));
function doSearch(){
const q=input.value.trim().toUpperCase();
if(!q)return render(uniqueWords.slice(0,100));
const filtered=uniqueWords.filter(w=>w.includes(q));
render(filtered);
}
document.getElementById('libSearch').onclick=doSearch;
input.onkeydown=e=>{if(e.key==='Enter')doSearch()};
document.getElementById('closeLib').onclick=hideModal;
}
function showWordDetail(word){
const dict=DICT[word];
let mean=MEAN[word]||'';
if(!mean&&dict){
  const firstE = (dict.e||'').split('\n')[0].replace(/\[[^\]]+\]/g,'').trim();
  if(firstE)mean=firstE.length>40?firstE.substring(0,40)+'...':firstE;
}
if(!mean)mean='(暂无释义)';
let dictHtml='';
if(dict){
dictHtml=`<div class="dw"><div class="dwp">${dict.p||''}</div><div class="dws">${dict.s||''}</div>${dict.e?`<div class="dwe">${dict.e}</div>`:''}${dict.ex?`<div class="dwex">例: ${dict.ex}</div>`:''}</div>`;
}else{
dictHtml=`<div class="dw" style="opacity:.7;text-align:center;padding:12px">该词暂无牛津释义<br><span style="font-size:11px;opacity:.6">${mean}</span></div>`;
}
document.getElementById('modalContent').innerHTML=`<div class="mt" style="letter-spacing:6px">${word}</div><div class="mst">${mean}</div>${dictHtml}<div class="mb"><button class="mbtn s" id="backLib">返回词库</button><button class="mbtn p" id="closeWord">关闭</button></div>`;
document.getElementById('backLib').onclick=showLibrary;
document.getElementById('closeWord').onclick=hideModal;
}

// 游戏中查词
function showDictLookup(){
const w=State.answer;
if(!w){toast('请先开始一局');return}
const dict=DICT[w];
let mean=MEAN[w]||'';
if(!mean&&dict){
  const firstE = (dict.e||'').split('\n')[0].replace(/\[[^\]]+\]/g,'').trim();
  if(firstE)mean=firstE.length>40?firstE.substring(0,40)+'...':firstE;
}
if(!mean)mean='(暂无释义)';
let dictHtml='';
if(dict){
dictHtml=`<div class="dw"><div class="dwp">${dict.p||''}</div><div class="dws">${dict.s||''}</div>${dict.e?`<div class="dwe">${dict.e}</div>`:''}${dict.ex?`<div class="dwex">例: ${dict.ex}</div>`:''}</div>`;
}else{
dictHtml=`<div class="dw" style="opacity:.7;text-align:center;padding:10px">该词暂无牛津释义<br><span style="font-size:11px;opacity:.6">${mean}</span></div>`;
}
document.getElementById('modalContent').innerHTML=`<div class="mt" style="letter-spacing:6px">${w}</div><div class="mst">${mean}</div>${dictHtml}<div class="mb"><button class="mbtn s" id="closeDict">关闭</button></div>`;
showModal();
document.getElementById('closeDict').onclick=hideModal;
}

// 页面切换
function showHome(){stopTimer();document.getElementById('home').classList.remove('hidden');document.getElementById('game').classList.remove('show');buildDiffTabs();updateHomeCounts()}
function showGame(){document.getElementById('home').classList.add('hidden');document.getElementById('game').classList.add('show')}

'use strict';
// 端到端测试 - 基于 jsdom,覆盖核心游戏逻辑与词库完整性
// 运行: npm install jsdom && node tests/run.js
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/'
});
const w = dom.window;
['data/vocab.js', 'data/mean.js', 'data/dict.js', 'data/idiom.js',
 'js/config.js', 'js/game.js', 'js/ui.js', 'js/main.js'].forEach(f => {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(root, f), 'utf8');
  w.document.body.appendChild(s);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};
const E = x => w.eval(x);

(async () => {
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await sleep(10);

  // --- 词库完整性 ---
  ok('VOCAB 5 难度存在', E('Object.keys(VOCAB).length') === 5);
  ok('gaokao 4-7 字母均存在', E('Object.keys(VOCAB.gaokao).sort().join()') === '4,5,6,7');
  const gaokaoTotal = E('VOCAB.gaokao[4].length+VOCAB.gaokao[5].length+VOCAB.gaokao[6].length+VOCAB.gaokao[7].length');
  ok('gaokao 词数 > 2000', gaokaoTotal > 2000, gaokaoTotal);
  ok('MEAN 覆盖全部 gaokao 词', E('[4,5,6,7].every(l=>VOCAB.gaokao[l].every(w=>MEAN[w]))'));
  ok('IDIOM 非空', E('Object.keys(IDIOM).length') > 50);
  ok('非考纲生僻词已剔除', !['ABHOR', 'ACRID', 'BEZEL', 'ARDOR'].some(x =>
    [4, 5, 6, 7].some(l => E('VOCAB.gaokao[' + l + '].includes("' + x + '")'))));

  // --- 游戏初始化 ---
  E('State.diff="gaokao";State.len=5;State.attempts=6;State.hints=1;State.excludeCount=2;State.timed=0');
  ok('newGame 返回 true', E('newGame()') === true);
  const ans = w.State.answer;
  ok('答案 5 字母', ans.length === 5, ans);
  ok('答案在词池', w.State.wordPool.includes(ans));
  ok('答案有释义', !!E('MEAN["' + ans + '"]'));
  ok('evaluating 初始 false', w.State.evaluating === false);

  // --- 猜中流程 ---
  if (w.State.validSet.has(ans)) {
    for (let i = 0; i < 5; i++) E('handleKey("' + ans[i] + '")');
    ok('填满当前行 curCol=5', w.State.curCol === 5);
    E('submitGuess()');
    ok('动画期间 evaluating=true', w.State.evaluating === true);
    E('submitGuess()'); // 应被锁忽略
    await sleep(5 * 100 + 250 + 300 + 150);
    ok('猜中后 won=true', w.State.won === true);
    ok('gameOver 已设置', w.State.gameOver === true);
    ok('动画后 evaluating 清除', w.State.evaluating === false);
    ok('lastWin = curRow (0)', w.State.curRow === 0);
    const modal = w.document.getElementById('modalContent').innerHTML;
    ok('结果弹窗含答案', modal.includes(ans));
    ok('结果弹窗含释义', modal.includes(E('MEAN["' + ans + '"]')));
  }

  // --- countCandidates yellow/gray 冲突 ---
  E('newGame()');
  E('State.answer="APPLE";State.wordPool=["APPLE","APPLY","AMPLE","AGILE","AZURE"];State.curRow=2');
  E('State.rows[0][0].textContent="P";State.rows[0][0].classList.add("present")');
  E('State.rows[1][0].textContent="P";State.rows[1][0].classList.add("absent")');
  ok('countCandidates yellow/gray 修复(应=3 含答案)', E('countCandidates()') === 3, E('countCandidates()'));

  // --- candidateTier 模糊档位(不泄露精确数) ---
  E('newGame()');
  ok('candidateTier 初始为广(>100)', E('candidateTier()') === '广', E('candidateTier()'));
  E('State.answer="APPLE";State.wordPool=["APPLE","APPLY","AMPLE","AGILE","AZURE"];State.curRow=2');
  E('State.rows[0][0].textContent="P";State.rows[0][0].classList.add("present")');
  E('State.rows[1][0].textContent="P";State.rows[1][1].classList.add("absent");State.rows[1][1].textContent="X"');
  ok('candidateTier 窄范围返回窄(<20)', E('candidateTier()') === '窄', E('candidateTier()'));

  // --- useExclude 不泄露答案 ---
  E('newGame()');
  E('State.answer="APPLE";State.excludeCount=6');
  let hit = 0;
  for (let i = 0; i < 100; i++) {
    E('State.excludeUsed=false;State.excludedLetters=new Set();State.keyState={}');
    E('useExclude()');
    if ([...w.State.excludedLetters].some(l => 'APPLE'.includes(l))) hit++;
  }
  ok('useExclude 不泄露(部分运行命中答案字母)', hit > 0, { hit });
  ok('useExclude 排除数=6', (() => {
    E('State.excludeUsed=false;State.excludedLetters=new Set();State.keyState={}');
    E('useExclude()');
    return w.State.excludedLetters.size === 6;
  })());

  // --- 全错判负 ---
  E('newGame()');
  E('State.attempts=2;State.answer="WORLD";State.validSet=new Set(["WORLD","ZZZZZ"])');
  for (let i = 0; i < 5; i++) E('handleKey("Z")');
  E('submitGuess()');
  await sleep(5 * 200 + 400 + 300);
  ok('错猜后进入下一行 curRow=1', w.State.curRow === 1);
  for (let i = 0; i < 5; i++) E('handleKey("Z")');
  E('submitGuess()');
  await sleep(5 * 200 + 400 + 300);
  ok('用尽次数判负', w.State.gameOver === true && w.State.won === false);

  // --- 词库 UI ---
  E('showLibrary()');
  ok('词库默认词汇模式', E('libState.mode') === 'word');
  ok('词库第1页 40 条', w.document.querySelectorAll('#libList .lib-item').length === 40);
  w.document.querySelector('.lib-tab[data-mode="idiom"]').click();
  ok('切换成语模式', E('libState.mode') === 'idiom');
  ok('成语列表非空', w.document.querySelectorAll('#libList .lib-item').length > 0);
  ok('成语项有橙色标识', !!w.document.querySelector('.lib-item.idiom'));

  // --- 签到日期 key 跨时区一致性(UTC+8) ---
  // 同一北京时间瞬间,不同本地时区应得到相同 dateKey
  const bjNoon = Date.UTC(2026, 6, 9, 4, 0, 0); // UTC 04:00 = 北京 12:00
  const k1 = E('dateKey(new Date(' + bjNoon + '))');
  E('Date.prototype.getTimezoneOffset = function(){return 300}'); // 模拟 UTC-5
  const k2 = E('dateKey(new Date(' + bjNoon + '))');
  ok('跨时区签到 key 一致(UTC+8)', k1 === k2, { k1, k2 });

  // --- 游戏状态持久化(误刷新可恢复) ---
  E('State.diff="gaokao";State.len=5;State.attempts=6;State.hints=1;State.excludeCount=2;State.timed=0');
  E('newGame()');
  const ans2 = w.State.answer;
  E('handleKey("' + ans2[0] + '")');
  E('handleKey("' + ans2[1] + '")');
  E('useHint()'); // 锁定一位 + 持久化
  const savedRaw = w.localStorage.getItem('wordle_zh_v6_game');
  ok('存档已写入 localStorage', !!savedRaw);
  const saved2 = JSON.parse(savedRaw);
  ok('存档含答案与已猜行', saved2.answer === ans2 && saved2.rows.length === 1);
  ok('存档含 hintLocked', Object.keys(saved2.hintLocked).length === 1);
  // 模拟刷新:清空当前状态后从存档恢复
  E('State.answer="";State.curRow=99;State.rows=[]');
  E('restoreGameState(' + JSON.stringify(saved2).replace(/</g,'\\u003c') + ')');
  ok('恢复后答案正确', w.State.answer === ans2);
  ok('恢复后 curRow 正确', w.State.curRow === 0);
  ok('恢复后 hintLocked 保留', Object.keys(w.State.hintLocked).length === 1);
  ok('恢复后已猜行回填', w.State.rows[0] && w.State.rows[0][0].textContent === ans2[0]);
  // newGame 应清除存档
  E('newGame()');
  ok('newGame 清除存档', !w.localStorage.getItem('wordle_zh_v6_game'));
  // 已结束对局刷新不应恢复
  E('State.gameOver=true;saveGameState()');
  E('clearGameSave()'); // 模拟 DOMContentLoaded 中 gameOver 分支

  // --- 错词本 + 间隔复习(SRS) ---
  try { w.localStorage.removeItem('wordle_zh_v6_srs'); } catch (e) {}
  ok('SRS 初始为空', E('srsTotalCount()') === 0);
  E('srsAddWord("APPLE")');
  E('srsAddWord("WORLD")');
  ok('SRS 加入2词后总数=2', E('srsTotalCount()') === 2, E('srsTotalCount()'));
  ok('SRS 新词立即到期', E('srsDueCount()') === 2, E('srsDueCount()'));
  const iv1 = E('srsReview("APPLE", true)');
  ok('SRS 记得一次间隔=1天', iv1 === 1, iv1);
  ok('SRS 记得后该词不再到期', E('srsDueCount()') === 1, E('srsDueCount()'));
  const iv2 = E('srsReview("APPLE", true)');
  ok('SRS 记得二次间隔=3天', iv2 === 3, iv2);
  const iv3 = E('srsReview("APPLE", true)');
  ok('SRS 记得三次间隔=7天', iv3 === 7, iv3);
  E('srsReview("WORLD", false)');
  ok('SRS 不记得后间隔=1天', E('loadSRS()["WORLD"].interval') === 1);
  E('srsAddWord("APPLE")'); // 再次失败:重置为到期,lapses+1
  ok('SRS 重复加入重置为到期', E('srsDueWords().includes("APPLE")') === true);
  ok('SRS lapses 累计>=1', E('loadSRS()["APPLE"].lapses') >= 1);
  E('srsRemoveWord("APPLE")'); E('srsRemoveWord("WORLD")');
  ok('SRS 移除后为空', E('srsTotalCount()') === 0);

  // --- 输局路径自动加入错词本 ---
  try { w.localStorage.removeItem('wordle_zh_v6_srs'); } catch (e) {}
  E('State.diff="gaokao";State.len=5;State.attempts=2;State.hints=1;State.excludeCount=0;State.timed=0');
  E('newGame()');
  const ansLoss = w.State.answer;
  E('State.validSet=new Set([State.answer,"ZZZZZ"])');
  for (let i = 0; i < 2; i++) {
    for (let c = 0; c < 5; c++) E('handleKey("Z")');
    E('submitGuess()');
    await sleep(5 * 100 + 250 + 250);
  }
  ok('输局后答案进错词本', !!E('loadSRS()["' + ansLoss + '"]'), ansLoss);

  // --- 签到与学习行为挂钩 ---
  try { w.localStorage.removeItem('wordle_zh_v6_signin'); } catch (e) {}
  ok('签到初始为空', E('loadSignin().streak || 0') === 0);
  ok('markSigninToday 首次返回 true', E('markSigninToday()') === true);
  ok('首次签到 streak=1', E('loadSignin().streak') === 1);
  ok('markSigninToday 同日再调用返回 false', E('markSigninToday()') === false);
  ok('同日 streak 不变(仍为1)', E('loadSignin().streak') === 1);
  // 完成一局自动签到
  try { w.localStorage.removeItem('wordle_zh_v6_signin'); } catch (e) {}
  E('State.diff="gaokao";State.len=4;State.attempts=2;State.hints=0;State.excludeCount=0;State.timed=0');
  E('newGame()');
  E('State.validSet=new Set([State.answer,"ZZZZ"])');
  for (let i = 0; i < 2; i++) {
    for (let c = 0; c < 4; c++) E('handleKey("Z")');
    E('submitGuess()');
    await sleep(4 * 100 + 250 + 250);
  }
  ok('完成一局后自动签到', E('loadSignin().lastDate') === E('dateKey(new Date())'));
  ok('完成一局后 streak=1', E('loadSignin().streak') === 1);
  // 复习完成自动签到
  try { w.localStorage.removeItem('wordle_zh_v6_signin'); } catch (e) {}
  try { w.localStorage.removeItem('wordle_zh_v6_srs'); } catch (e) {}
  E('srsAddWord("APPLE")');
  E('showReview()');
  E('document.getElementById("revealBtn").click()');
  // HC 适配:不记得按钮用 class mbtn danger(非内联样式),便于 HC 覆盖
  const unkBtn = w.document.getElementById('unknownBtn');
  ok('复习卡揭示后出现不记得按钮', !!unkBtn);
  ok('不记得按钮用 mbtn danger class', unkBtn && unkBtn.classList.contains('danger'));
  ok('不记得按钮无内联 background 样式', unkBtn && !unkBtn.style.background);
  E('document.getElementById("knownBtn").click()'); // 进入完成态,触发 markSigninToday
  ok('完成一轮复习后自动签到', E('loadSignin().lastDate') === E('dateKey(new Date())'));
  try { w.localStorage.removeItem('wordle_zh_v6_srs'); } catch (e) {}
  try { w.localStorage.removeItem('wordle_zh_v6_signin'); } catch (e) {}

  // --- 词库标记:收藏 / 已掌握 ---
  try { w.localStorage.removeItem('wordle_zh_v6_marks'); } catch (e) {}
  ok('marks 初始无收藏', E('isFav("APPLE")') === false);
  E('toggleFav("APPLE")');
  ok('toggleFav 后为收藏', E('isFav("APPLE")') === true);
  E('toggleMaster("APPLE")');
  ok('toggleMaster 后为已掌握', E('isMastered("APPLE")') === true);
  E('toggleFav("APPLE")');
  ok('再次 toggleFav 取消收藏', E('isFav("APPLE")') === false);
  E('showLibrary()');
  ok('词库每项含2个标记按钮', w.document.querySelectorAll('#libList .lib-mark').length === 80);
  const firstFav = w.document.querySelector('#libList .lib-mark.fav');
  const targetWord = firstFav.dataset.word;
  firstFav.click();
  ok('点击收藏按钮后 isFav 生效', E('isFav("' + targetWord + '")') === true, targetWord);
  w.document.querySelector('.lib-f[data-status="fav"]').click();
  const favItems = w.document.querySelectorAll('#libList .lib-item');
  ok('收藏筛选只显示收藏项', favItems.length > 0 && [...favItems].every(el => E('isFav("' + el.dataset.word + '")')), { cnt: favItems.length });
  try { w.localStorage.removeItem('wordle_zh_v6_marks'); } catch (e) {}

  // --- 词典懒加载 + 词池缓存 ---
  ok('dictLoaded 已加载(测试环境同步加载)', E('dictLoaded()') === true);
  ok('getDictEntry 已知词返回条目', !!E('getDictEntry("ABODE")'));
  ok('getDictEntry 未知词返回 null', E('getDictEntry("ZZZZZ")') === null);
  ok('getDictEntry 条目含音标 p', typeof E('getDictEntry("ABODE").p') === 'string');
  ok('renderDictBlock 已知词含释义块', E('renderDictBlock("ABODE").html.indexOf("dwp")') >= 0);
  ok('dictFailed 默认 false', E('dictFailed()') === false);
  ok('dictLoading 已加载后为 false', E('dictLoading()') === false);
  // 失败/加载兜底渲染:mock 三个状态函数,验证不同分支文案
  E('window._ge=getDictEntry;window._dl=dictLoaded;window._df=dictFailed;');
  E('window.getDictEntry=()=>null;window.dictLoaded=()=>false;');
  E('window.dictFailed=()=>true;');
  ok('失败态显示"加载失败"(非转圈)', E('renderDictBlock("ABODE").html.indexOf("加载失败")') >= 0);
  ok('失败态 resultDictMeanHtml 也显示失败', E('resultDictMeanHtml("ABODE").indexOf("加载失败")') >= 0);
  E('window.dictFailed=()=>false;');
  ok('加载态显示"加载释义…"', E('renderDictBlock("ABODE").html.indexOf("加载释义")') >= 0);
  E('window.getDictEntry=window._ge;window.dictLoaded=window._dl;window.dictFailed=window._df;');
  ok('恢复后 renderDictBlock 正常', E('renderDictBlock("ABODE").html.indexOf("dwp")') >= 0);
  w.__dictResolved = false;
  E('loadDict().then(() => { window.__dictResolved = true; })');
  await sleep(20);
  ok('loadDict 返回 Promise 并 resolve', w.__dictResolved === true);
  // 词池缓存:同 diff/len 返回同一引用(只读遍历,共享安全)
  E('window.__p1 = getWordPool("gaokao",5)');
  E('window.__p2 = getWordPool("gaokao",5)');
  ok('词池缓存命中(同一引用)', E('window.__p1 === window.__p2') === true);
  ok('词池缓存内容非空', E('window.__p1.length') > 100, E('window.__p1.length'));
  ok('不同维度不共享缓存', E('getWordPool("gaokao",5) === getWordPool("cet4",5)') === false);

  // --- 正反馈:评价文案 + 里程碑 ---
  ok('一击命中评价', E('praiseWin(1,6,0).title') === '\u4e00\u51fb\u547d\u4e2d!');
  ok('2-3次猜中评价漂亮', E('praiseWin(3,6,0).title') === '\u6f02\u4eae!');
  ok('4-5次猜中评价稳打', E('praiseWin(5,6,0).title') === '\u731c\u4e2d\u4e86');
  ok('6+次猜中评价逆转', E('praiseWin(8,8,0).title') === '\u9006\u8f6c\u80dc\u5229');
  ok('限时快速猜中加速通', (function(){ E('State.timed=60'); const s=E('praiseWin(1,6,10).sub'); E('State.timed=0'); return s; })() === '\u795e\u6765\u4e4b\u7b14 \u00b7 \u901f\u901a');
  E('State.timed=0');
  ok('连胜里程碑5场有文案', E('streakMilestone(5)') !== null);
  ok('连胜里程碑10场有文案', E('streakMilestone(10)') !== null);
  ok('非里程碑连胜返回null', E('streakMilestone(7)') === null);
  ok('复习全对满分评价', E('reviewPraise(5,5)') === '\u5168\u90e8\u8bb0\u5f97 \u00b7 \u6ee1\u5206');
  ok('复习80%记得很牢', E('reviewPraise(4,5)') === '\u8bb0\u5f97\u5f88\u7262');
  ok('复习<50%加油', E('reviewPraise(1,5)') === '\u52a0\u6cb9,\u4e0b\u6b21\u66f4\u597d');
  // 掌握词数里程碑 + markMastered
  try { w.localStorage.removeItem('wordle_zh_v6_marks'); } catch (e) {}
  ok('masteredCount 初始0', E('masteredCount()') === 0);
  ok('markMastered 首次返回true', E('markMastered("AAA")') === true);
  ok('markMastered 重复返回false', E('markMastered("AAA")') === false);
  ok('masteredCount 增为1', E('masteredCount()') === 1);
  for (let i = 0; i < 4; i++) E('markMastered("W' + i + '")');
  ok('掌握5词触发里程碑', E('masteredMilestone(masteredCount())') !== null, E('masteredCount()'));
  try { w.localStorage.removeItem('wordle_zh_v6_marks'); } catch (e) {}

  // --- 首页成长条显示掌握/收藏/待复习 ---
  E('markMastered("APPLE")');
  E('toggleFav("BANANA")');
  E('srsAddWord("CHERRY")');
  E('updateHomeCounts()');
  ok('成长条显示已掌握数', w.document.getElementById('gMastered').textContent === '1');
  ok('成长条显示收藏数', w.document.getElementById('gFav').textContent === '1');
  ok('成长条显示待复习数', w.document.getElementById('gSrs').textContent === '1');
  try { w.localStorage.removeItem('wordle_zh_v6_marks'); } catch (e) {}
  try { w.localStorage.removeItem('wordle_zh_v6_srs'); } catch (e) {}

  // --- 结果弹窗使用评价文案 + 连胜里程碑徽章 ---
  try { w.localStorage.removeItem('wordle_zh_v6_stats'); } catch (e) {}
  E('State.diff="gaokao";State.len=4;State.attempts=2;State.hints=0;State.excludeCount=0;State.timed=0');
  E('newGame()');
  E('State.validSet=new Set([State.answer,"ZZZZ"])');
  // 故意猜中:先填错一次触发再修正?直接猜中需知道答案,用 answer
  const winAns = E('State.answer');
  for (let c = 0; c < 4; c++) E('handleKey("' + winAns[c] + '")');
  E('submitGuess()');
  await sleep(4 * 100 + 250 + 350);
  ok('猜中后弹窗标题为评价文案(非"恭喜")', /(\u4e00\u51fb\u547d\u4e2d|\u6f02\u4eae|\u731c\u4e2d\u4e86|\u9006\u8f6c\u80dc\u5229)/.test(w.document.getElementById('modalContent').textContent));
  try { w.localStorage.removeItem('wordle_zh_v6_stats'); } catch (e) {}

  // --- 设置瘦身:3 核心可见 + 高级折叠 ---
  E('openSettings()');
  ok('高级选项默认折叠', w.document.getElementById('spAdvanced').hasAttribute('hidden') === true);
  ok('核心项(难度/长度/尝试)始终可见', w.document.querySelectorAll('.sp-list > .sp-item').length === 3);
  ok('折叠态显示当前值摘要', /排除/.test(w.document.getElementById('spAdvToggle').textContent));
  w.document.getElementById('spAdvToggle').click();
  ok('点击展开高级选项', w.document.getElementById('spAdvanced').hasAttribute('hidden') === false);
  ok('展开后 toggle 标记 open', w.document.getElementById('spAdvToggle').classList.contains('open') === true);
  w.document.getElementById('spAdvToggle').click();
  ok('再次点击折叠', w.document.getElementById('spAdvanced').hasAttribute('hidden') === true);
  // 修改高级项后摘要更新
  E('State.timed=120;updateSpAdvLabel()');
  ok('摘要反映限时值', /限时120s/.test(w.document.getElementById('spAdvToggle').textContent));
  E('State.timed=0');
  E('closeSettings()');

  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });

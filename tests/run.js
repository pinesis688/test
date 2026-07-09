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
    await sleep(5 * 200 + 400 + 600 + 300 + 100);
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

  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });

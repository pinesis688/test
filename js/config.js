'use strict';
const SK = 'wordle_zh_v6';
const DIFFICULTIES = [
  {id:'gaokao',name:'高考',sub:'基础'},
  {id:'cet4',name:'四级',sub:'CET-4'},
  {id:'cet6',name:'六级',sub:'CET-6'},
  {id:'kaoyan',name:'考研',sub:'研究生'},
  {id:'ielts',name:'雅思',sub:'IELTS'}
];
const DIFF_ORDER = ['gaokao','cet4','cet6','kaoyan','ielts'];
const LENGTHS = [4,5,6,7];
const ATTEMPTS = [6,8,10];
const HINTS = [0,1,2,3];
const EXCLUDE_COUNTS = [0,1,2,3,4,5,6];
const TIMED = [0,60,120,180];

function loadStats() {
  try { return JSON.parse(localStorage.getItem(SK + '_stats') || '{}'); }
  catch (e) { return {}; }
}
function saveStats() {
  try { localStorage.setItem(SK + '_stats', JSON.stringify(State.stats)); }
  catch (e) {}
}

function getWordPool(diff, len) {
  // 缓存词池:同一 diff/len 的词池只构建一次(只读遍历,共享引用安全)
  const key = diff + '|' + len;
  if (key in _poolCache) return _poolCache[key];
  const idx = DIFF_ORDER.indexOf(diff);
  let pool = [];
  for (let i = 0; i <= idx; i++) {
    const d = DIFF_ORDER[i];
    if (VOCAB[d] && VOCAB[d][len]) pool = pool.concat(VOCAB[d][len]);
  }
  _poolCache[key] = pool;
  return pool;
}
const _poolCache = {};

function rebuildValidSet() {
  State.validSet = new Set();
  for (let i = 0; i <= DIFF_ORDER.indexOf(State.diff); i++) {
    const d = DIFF_ORDER[i];
    if (VOCAB[d] && VOCAB[d][State.len]) {
      VOCAB[d][State.len].forEach(w => State.validSet.add(w));
    }
  }
}

// 用 UTC+8(北京时间)计算日期 key,避免跨时区用户连续签到中断
function dateKey(d) {
  const utc8 = new Date(d.getTime() + (8 * 60 - d.getTimezoneOffset()) * 60000);
  return utc8.getFullYear() + '-' +
    (utc8.getMonth() + 1).toString().padStart(2, '0') + '-' +
    utc8.getDate().toString().padStart(2, '0');
}

function loadSignin() {
  try { return JSON.parse(localStorage.getItem(SK + '_signin') || '{}'); }
  catch (e) { return {}; }
}

function saveSignin(d) {
  try { localStorage.setItem(SK + '_signin', JSON.stringify(d)); }
  catch (e) {}
}

// 标记今日已签到(学习行为:完成一局/一轮复习,或手动点击)
// 返回 true 表示今天是首次签到(新的一天),false 表示今日已签到过
function markSigninToday() {
  const today = dateKey(new Date());
  const data = loadSignin();
  if (data.lastDate === today) return false;
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  if (data.lastDate === yesterday) data.streak = (data.streak || 0) + 1;
  else data.streak = 1;
  data.lastDate = today;
  data.totalDays = (data.totalDays || 0) + 1;
  saveSignin(data);
  return true;
}

function loadGameSave() {
  try { return JSON.parse(localStorage.getItem(SK + '_game') || 'null'); }
  catch (e) { return null; }
}

function saveGameSave(state) {
  try { localStorage.setItem(SK + '_game', JSON.stringify(state)); }
  catch (e) {}
}

function clearGameSave() {
  try { localStorage.removeItem(SK + '_game'); }
  catch (e) {}
}

// ===== 错词本 + 间隔复习(SRS, SM-2 简化版) =====
// 结构: { word: { interval(天), due(时间戳ms), reps, lapses, last } }
function loadSRS() {
  try { return JSON.parse(localStorage.getItem(SK + '_srs') || '{}'); }
  catch (e) { return {}; }
}
function saveSRS(d) {
  try { localStorage.setItem(SK + '_srs', JSON.stringify(d)); }
  catch (e) {}
}
function srsNow() { return Date.now(); }
function srsDayMs() { return 86400000; }
// 加入错词:已存在则重置为立即复习并记一次 lapses
function srsAddWord(word) {
  const data = loadSRS();
  const existing = data[word];
  if (existing) {
    existing.lapses = (existing.lapses || 0) + 1;
    existing.reps = 0;
    existing.interval = 0;
    existing.due = srsNow();
    existing.last = srsNow();
  } else {
    data[word] = { interval: 0, due: srsNow(), reps: 0, lapses: 0, last: srsNow() };
  }
  saveSRS(data);
}
// 到期需复习的词(按 due 升序)
function srsDueWords() {
  const data = loadSRS();
  const now = srsNow();
  return Object.keys(data)
    .filter(w => data[w].due <= now)
    .sort((a, b) => data[a].due - data[b].due);
}
function srsDueCount() { return srsDueWords().length; }
function srsTotalCount() { return Object.keys(loadSRS()).length; }
// 复习一次:known=true 记得, false 不记得; 返回新间隔
function srsReview(word, known) {
  const data = loadSRS();
  const e = data[word];
  if (!e) return 0;
  if (known) {
    e.reps = (e.reps || 0) + 1;
    if (e.reps === 1) e.interval = 1;
    else if (e.reps === 2) e.interval = 3;
    else e.interval = Math.max(1, Math.round((e.interval || 1) * 2.2));
  } else {
    e.lapses = (e.lapses || 0) + 1;
    e.reps = 0;
    e.interval = 1;
  }
  e.due = srsNow() + e.interval * srsDayMs();
  e.last = srsNow();
  saveSRS(data);
  return e.interval;
}
function srsRemoveWord(word) {
  const data = loadSRS();
  if (data[word]) { delete data[word]; saveSRS(data); }
}
// 标记已掌握:从错词本移除
function srsMasterWord(word) { srsRemoveWord(word); }

// ===== 词库标记:收藏 / 已掌握 =====
function loadMarks() {
  try {
    const m = JSON.parse(localStorage.getItem(SK + '_marks') || 'null');
    return m && m.fav && m.master ? m : { fav: {}, master: {} };
  } catch (e) { return { fav: {}, master: {} }; }
}
function saveMarks(m) {
  try { localStorage.setItem(SK + '_marks', JSON.stringify(m)); }
  catch (e) {}
}
function isFav(word) { return !!loadMarks().fav[word]; }
function isMastered(word) { return !!loadMarks().master[word]; }
function toggleFav(word) {
  const m = loadMarks();
  if (m.fav[word]) delete m.fav[word]; else m.fav[word] = 1;
  saveMarks(m);
  return !!m.fav[word];
}
function toggleMaster(word) {
  const m = loadMarks();
  if (m.master[word]) delete m.master[word]; else m.master[word] = 1;
  saveMarks(m);
  return !!m.master[word];
}

// ===== 词典懒加载:dict.js ~1.5MB,首屏不需要,按需注入 =====
// 首屏只加载 vocab/mean/idiom(小),游戏开始/查词/词库时再注入 dict.js
let _dictPromise = null;
let _dictLoaded = false;
function loadDict() {
  if (typeof DICT !== 'undefined') { _dictLoaded = true; return Promise.resolve(DICT); }
  if (_dictPromise) return _dictPromise;
  _dictPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'data/dict.js';
    s.async = true;
    s.onload = () => {
      if (typeof DICT !== 'undefined') { _dictLoaded = true; resolve(DICT); }
      else reject(new Error('DICT 未定义'));
    };
    s.onerror = () => reject(new Error('dict.js 加载失败'));
    document.body.appendChild(s);
  });
  return _dictPromise;
}
// 安全读取词典条目(未加载时返回 null,不抛错)
function getDictEntry(word) {
  return (typeof DICT !== 'undefined' && DICT) ? (DICT[word] || null) : null;
}
function dictLoaded() { return _dictLoaded; }
// 词典加载完成后回调一次;若已加载则同步执行
function ensureDict(cb) {
  if (_dictLoaded) { cb(); return; }
  loadDict().then(cb).catch(() => {});
}

window.State = {
  diff: 'gaokao', len: 5, attempts: 6, hints: 1, excludeCount: 2, timed: 0,
  answer: '', wordPool: [], validSet: new Set(),
  rows: [], curRow: 0, curCol: 0,
  hintLocked: {}, hintsUsed: 0, hintsLeft: 0,
  excludeUsed: false, excludedLetters: new Set(),
  gameOver: false, won: false, evaluating: false,
  keyState: {},
  timer: null, startTime: 0, endTime: 0, timeLeft: 0,
  stats: loadStats()
};
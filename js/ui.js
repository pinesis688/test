'use strict';

let allWordsCache = null;
function getAllWords() {
  if (allWordsCache) return allWordsCache;
  const all = [];
  for (const d in VOCAB) for (const l in VOCAB[d]) all.push(...VOCAB[d][l]);
  allWordsCache = [...new Set(all)].sort();
  return allWordsCache;
}

function buildDiffTabs() {
  const tabs = document.getElementById('diffTabs');
  tabs.innerHTML = '';
  DIFFICULTIES.forEach(d => {
    const b = document.createElement('button');
    b.className = 'diff-tab' + (State.diff === d.id ? ' active' : '');
    b.textContent = d.name;
    b.onclick = () => { State.diff = d.id; buildDiffTabs(); updateHomeCounts(); };
    tabs.appendChild(b);
  });
}

function updateHomeCounts() {
  const now = new Date();
  const dateStr = (now.getMonth() + 1).toString().padStart(2, '0') + '/' +
    now.getDate().toString().padStart(2, '0') + ' ' +
    ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  const sd = document.getElementById('signinDate');
  if (sd) sd.textContent = dateStr;
  const k = State.diff + '_' + State.len + '_' + State.timed + '_' + State.excludeCount + '_' + State.hints;
  const s = State.stats[k];
  const gc = document.getElementById('gameCount');
  if (gc) gc.textContent = (s ? s.played : 0) + ' 局';
  const sg = loadSignin();
  const ss = document.getElementById('signinStreak');
  if (ss) ss.textContent = sg.streak || 0;
  const sub = document.getElementById('signinSub');
  if (sub) sub.textContent = sg.lastDate === dateKey(now) ? '\u4eca\u65e5\u5df2\u5b66\u4e60 \u2713' : '\u70b9\u51fb\u7b7e\u5230 \u00b7 \u73a9\u4e00\u5c40\u4e5f\u7b97';
  const rv = document.getElementById('tabReview');
  if (rv) {
    const due = srsDueCount();
    rv.textContent = due > 0 ? '复习 ' + due : '复习';
  }
  // 成长条:已掌握 / 收藏 / 待复习
  const gm = document.getElementById('gMastered');
  const gf = document.getElementById('gFav');
  const gs = document.getElementById('gSrs');
  if (gm) gm.textContent = masteredCount();
  if (gf) gf.textContent = Object.keys(loadMarks().fav).length;
  if (gs) gs.textContent = srsTotalCount();
}

function openSettings() {
  document.getElementById('settingsPanel').classList.add('show');
  buildSpOptions();
  // 每次打开默认折叠高级选项
  const adv = document.getElementById('spAdvanced');
  const tg = document.getElementById('spAdvToggle');
  if (adv) adv.setAttribute('hidden', '');
  if (tg) { tg.classList.remove('open'); tg.setAttribute('aria-expanded', 'false'); }
}

function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('show');
}

// 高级选项折叠态下的当前值摘要,无需展开即可查看
function updateSpAdvLabel() {
  const t = document.getElementById('spAdvToggle');
  if (!t) return;
  const timedTxt = State.timed > 0 ? State.timed + 's' : '关';
  t.innerHTML = '高级选项 <span class="sp-adv-sum">提示' + State.hints + '/排除' + State.excludeCount + '/限时' + timedTxt + '</span> <span class="sp-adv-caret">▾</span>';
}

function buildSpOptions() {
  buildSpOpts('spDiffOpts', DIFFICULTIES, State.diff, renderSpDiff);
  buildSpOpts('spLenOpts', LENGTHS, LENGTHS.indexOf(State.len), renderSpNum);
  buildSpOpts('spAttemptOpts', ATTEMPTS, ATTEMPTS.indexOf(State.attempts), renderSpNum);
  buildSpOpts('spHintOpts', HINTS, HINTS.indexOf(State.hints), renderSpNum);
  buildSpOpts('spExcludeOpts', EXCLUDE_COUNTS, EXCLUDE_COUNTS.indexOf(State.excludeCount), renderSpExclude);
  buildSpOpts('spTimedOpts', TIMED, TIMED.indexOf(State.timed), renderSpTimed);
  const d = DIFFICULTIES.find(x => x.id === State.diff);
  const cnt = getWordPool(State.diff, State.len).length;
  document.getElementById('spDiffHint').textContent = d.name + ' \u00b7 ' + cnt + '\u8bcd';
  updateSpAdvLabel();
}

function buildSpOpts(id, items, current, render) {
  const c = document.getElementById(id);
  c.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'sp-opt' + (i === current || (typeof current === 'string' && it.id === current) ? ' active' : '');
    render(b, it);
    b.onclick = () => {
      c.querySelectorAll('.sp-opt').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onSpSelect(id, it);
    };
    c.appendChild(b);
  });
}

function renderSpDiff(b, it) { b.innerHTML = it.name + '<small>' + it.sub + '</small>'; }
function renderSpNum(b, it) { b.textContent = it; }
function renderSpTimed(b, it) { b.textContent = it === 0 ? '\u5173\u95ed' : it + 's'; }
function renderSpExclude(b, it) { b.textContent = it === 0 ? '\u65e0' : it; }

function onSpSelect(id, item) {
  if (id === 'spDiffOpts') {
    State.diff = item.id;
    const d = DIFFICULTIES.find(x => x.id === State.diff);
    document.getElementById('spDiffHint').textContent = d.name + ' \u00b7 ' + getWordPool(State.diff, State.len).length + '\u8bcd';
  } else if (id === 'spLenOpts') {
    State.len = item;
    const d = DIFFICULTIES.find(x => x.id === State.diff);
    document.getElementById('spDiffHint').textContent = d.name + ' \u00b7 ' + getWordPool(State.diff, State.len).length + '\u8bcd';
  } else if (id === 'spAttemptOpts') State.attempts = item;
  else if (id === 'spHintOpts') State.hints = item;
  else if (id === 'spExcludeOpts') State.excludeCount = item;
  else if (id === 'spTimedOpts') State.timed = item;
  if (id === 'spHintOpts' || id === 'spExcludeOpts' || id === 'spTimedOpts') updateSpAdvLabel();
}

function updateGameInfo() {
  const d = DIFFICULTIES.find(x => x.id === State.diff);
  const tier = candidateTier();
  let html = '<span>\u96be\u5ea6<b>' + d.name + '</b></span><span>\u957f\u5ea6<b>' + State.len + '</b></span><span>\u63d0\u793a<b>' + State.hintsLeft + '</b></span><span>\u8303\u56f4<b>' + tier + '</b></span>';
  if (State.timed > 0 && State.startTime > 0) {
    const warn = State.timeLeft <= 10 ? ' warn' : '';
    html += '<span class="timer' + warn + '">' + fmtTime(State.timeLeft) + '</span>';
  }
  document.getElementById('gameInfo').innerHTML = html;
  const hb = document.getElementById('hintBtn');
  if (hb) { hb.disabled = State.hintsLeft <= 0 || State.gameOver; hb.style.display = State.hints > 0 ? 'flex' : 'none'; }
  const eb = document.getElementById('excludeBtn');
  if (eb) { eb.disabled = State.excludeUsed || State.gameOver; eb.style.display = State.excludeCount > 0 ? 'flex' : 'none'; }
}

function statKey() {
  return State.diff + '_' + State.len + '_' + State.timed + '_' + State.excludeCount + '_' + State.hints;
}

function recordResult(won, guesses) {
  const k = statKey();
  if (!State.stats[k]) State.stats[k] = { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const s = State.stats[k];
  s.played++;
  if (won) {
    s.won++;
    s.streak++;
    if (s.streak > s.maxStreak) s.maxStreak = s.streak;
    if (guesses && guesses <= 10) s.dist[guesses - 1]++;
  } else {
    s.streak = 0;
  }
  saveStats();
  // 完成一局即视为今日学习,自动签到(连续学习天数与学习行为挂钩)
  markSigninToday();
  updateHomeCounts();
  setTimeout(() => showResult(won), 300);
}

function emptyStat() { return { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }; }

function buildDistHtml(s, maxRows, lastWin) {
  const maxD = Math.max(1, ...s.dist);
  let html = '';
  for (let i = 0; i < maxRows; i++) {
    const cnt = s.dist[i] || 0;
    const hl = i === lastWin ? ' hl' : '';
    html += '<div class="dr"><div class="dn">' + (i + 1) + '</div><div class="db' + hl + '" style="width:' + Math.max(8, cnt / maxD * 100) + '%">' + cnt + '</div></div>';
  }
  return html;
}

function buildStatsHtml(s) {
  const winRate = s.played ? Math.round(s.won / s.played * 100) : 0;
  return '<div class="stats"><div class="si"><div class="sn">' + s.played + '</div><div class="sl">\u603b\u573a\u6b21</div></div><div class="si"><div class="sn">' + winRate + '%</div><div class="sl">\u80dc\u7387</div></div><div class="si"><div class="sn">' + s.streak + '</div><div class="sl">\u8fde\u80dc</div></div><div class="si"><div class="sn">' + s.maxStreak + '</div><div class="sl">\u6700\u957f\u8fde\u80dc</div></div></div>';
}

function buildResultModal(won) {
  const s = State.stats[statKey()] || emptyStat();
  const lastWin = State.won ? State.curRow : -1;
  const distHtml = buildDistHtml(s, State.attempts, lastWin);
  const elapsed = Math.floor(gameElapsed() / 1000);
  const diffName = DIFFICULTIES.find(x => x.id === State.diff).name;
  const timedLabel = State.timed > 0 ? ' \u00b7 \u9650\u65f6' + State.timed + 's' : '';
  let title, sub;
  if (won) {
    const p = praiseWin(lastWin + 1, State.attempts, elapsed);
    title = p.title; sub = p.sub;
  } else {
    title = '\u6e38\u620f\u7ed3\u675f'; sub = '\u672a\u80fd\u731c\u51fa\u7b54\u6848';
  }
  if (State.startTime > 0) sub += ' \u00b7 \u7528\u65f6 ' + fmtTime(elapsed);
  // 连胜里程碑徽章(仅猜中时)
  const ms = won ? streakMilestone(s.streak) : null;
  const msHtml = ms ? '<div class="ms-badge">\u2605 ' + ms + '</div>' : '';
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">' + title + '</div>' +
    '<div class="mst">' + sub + '</div>' + msHtml +
    '<div class="mw">' + State.answer + '</div>' +
    '<div id="resultDict">' + resultDictMeanHtml(State.answer) + '</div>' +
    '<div class="dt">\u731c\u8bcd\u5206\u5e03 (' + diffName + ' \u00b7 ' + State.len + '\u5b57\u6bcd' + timedLabel + ')</div>' + distHtml +
    buildStatsHtml(s) +
    '<div class="mb"><button class="mbtn sh" id="shareBtn">\u5206\u4eab</button><button class="mbtn p" id="playAgain">\u518d\u6765\u4e00\u5c40</button><button class="mbtn s" id="backHome">\u9996\u9875</button></div>';
  showModal();
  document.getElementById('playAgain').onclick = () => { hideModal(); newGame(); };
  document.getElementById('backHome').onclick = () => { hideModal(); showHome(); };
  document.getElementById('shareBtn').onclick = shareResult;
}

// 结果弹窗的词典+释义片段(可独立刷新,避免重渲染整个弹窗)
function resultDictMeanHtml(word) {
  const dict = getDictEntry(word);
  let meaning = (typeof MEAN !== 'undefined' ? (MEAN[word] || '') : '');
  let dictHtml = '';
  if (dict) dictHtml = '<div class="mphon">' + (dict.p || '') + '</div><div class="mpos">' + (dict.s || '') + '</div>' + (dict.e ? '<div class="mex">' + dict.e + '</div>' : '');
  if (!meaning && dict) {
    const firstE = (dict.e || '').split('\n')[0].replace(/\[[^\]]+\]/g, '').trim();
    if (firstE) meaning = firstE.length > 60 ? firstE.substring(0, 60) + '...' : firstE;
  }
  if (!dictHtml && !dictLoaded()) {
    if (dictFailed()) dictHtml = '<div class="mphon" style="opacity:.5;font-size:11px">\u8bcd\u5178\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25</div>';
    else dictHtml = '<div class="mphon" style="opacity:.5">\u52a0\u8f7d\u91ca\u4e49\u2026</div>';
  }
  return dictHtml + '<div class="mm">' + (meaning || '\u6682\u65e0\u91ca\u4e49') + '</div>';
}

function showResult(won) {
  buildResultModal(won);
  ensureDict(() => {
    const el = document.getElementById('resultDict');
    if (el) el.innerHTML = resultDictMeanHtml(State.answer);
  });
}

function shareResult() {
  let text = 'Wordle ' + DIFFICULTIES.find(x => x.id === State.diff).name + ' ' + State.len + '\u5b57\u6bcd';
  if (State.won) { text += ' ' + (State.curRow + 1) + '/' + State.attempts + '\n'; }
  else { text += ' X/' + State.attempts + '\n'; }
  const rowsToShow = State.gameOver ? State.curRow + 1 : State.curRow;
  for (let r = 0; r < rowsToShow; r++) {
    if (!State.rows[r]) break;
    const row = State.rows[r];
    let line = '';
    let hasContent = false;
    for (let c = 0; c < State.len; c++) {
      const t = row[c];
      if (t.classList.contains('correct')) { line += '\ud83d\udfe9'; hasContent = true; }
      else if (t.classList.contains('present')) { line += '\ud83d\udfe8'; hasContent = true; }
      else if (t.classList.contains('locked') && !t.classList.contains('correct') && !t.classList.contains('present') && !t.classList.contains('absent')) { line += '\ud83d\udfe6'; hasContent = true; }
      else if (t.classList.contains('absent')) { line += '\u2b1b'; hasContent = true; }
      else if (t.textContent) { line += '\u2b1b'; hasContent = true; }
    }
    if (hasContent) text += line + '\n';
  }
  const finalText = text.trim();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(finalText).then(() => toast('\u5df2\u590d\u5236')).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = finalText; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('\u5df2\u590d\u5236'); } catch (e) {}
    document.body.removeChild(ta);
  }
}

function showStats() {
  const s = State.stats[statKey()] || emptyStat();
  const distHtml = buildDistHtml(s, 10, -1);
  const diffName = DIFFICULTIES.find(x => x.id === State.diff).name;
  const timedLabel = State.timed > 0 ? ' \u00b7 \u9650\u65f6' + State.timed + 's' : '';
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u7edf\u8ba1</div>' +
    '<div class="mst">' + diffName + ' \u00b7 ' + State.len + '\u5b57\u6bcd' + timedLabel + '</div>' +
    buildStatsHtml(s) +
    '<div class="dt">\u731c\u8bcd\u5206\u5e03</div>' + distHtml +
    '<div class="mb"><button class="mbtn p" id="closeStats">\u5173\u95ed</button></div>';
  showModal();
  document.getElementById('closeStats').onclick = hideModal;
}

function showHelp() {
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u73a9\u6cd5</div>' +
    '<div class="mst">\u5728 ' + State.attempts + ' \u6b21\u5185\u731c\u51fa ' + State.len + ' \u5b57\u6bcd\u5355\u8bcd</div>' +
    '<div class="help-list">' +
    '<div class="hi"><div class="hts"><div class="hti correct">W</div></div><div>\u5b57\u6bcd\u6b63\u786e\u4e14\u4f4d\u7f6e\u6b63\u786e</div></div>' +
    '<div class="hi"><div class="hts"><div class="hti present">O</div></div><div>\u5b57\u6bcd\u6b63\u786e\u4f46\u4f4d\u7f6e\u9519\u8bef</div></div>' +
    '<div class="hi"><div class="hts"><div class="hti absent">D</div></div><div>\u5b57\u6bcd\u4e0d\u5728\u5355\u8bcd\u4e2d</div></div>' +
    '<div class="hi"><div class="hts"><div class="hti locked">?</div></div><div>\u63d0\u793a\u9501\u5b9a\u67d0\u4f4d\u7f6e\u5b57\u6bcd</div></div>' +
    '<div class="hi"><div class="hts"><div class="hti excluded">E</div></div><div>\u6392\u9664:\u6807\u8bb0\u4e3a\u5df2\u6392\u9664(\u53ef\u80fd\u8bef\u5224)</div></div>' +
    '</div>' +
    '<div class="dt">\u8f85\u52a9\u529f\u80fd</div>' +
    '<div class="help-list">' +
    '<div class="hi">\u63d0\u793a:\u9501\u5b9a\u4e00\u4e2a\u6b63\u786e\u5b57\u6bcd\u4f4d\u7f6e(\u6570\u91cf\u9996\u9875\u53ef\u9009 0-3)</div>' +
    '<div class="hi">\u6392\u9664:\u968f\u673a\u6392\u9664\u672a\u4f7f\u7528\u5b57\u6bcd,\u6709\u8bef\u4e2d\u7b54\u6848\u98ce\u9669(\u6570\u91cf\u9996\u9875\u53ef\u9009 0-6)</div>' +
    '<div class="hi">\u653e\u5f03:\u7ed3\u675f\u672c\u5c40\u5e76\u663e\u793a\u7b54\u6848</div>' +
    '<div class="hi">\u9650\u65f6:\u5012\u8ba1\u65f6\u6a21\u5f0f,\u65f6\u95f4\u5230\u81ea\u52a8\u5224\u8d1f</div>' +
    '<div class="hi">\u8303\u56f4:\u7c97\u7565\u63d0\u793a\u5269\u4f59\u5019\u9009\u8bcd\u8303\u56f4(\u5e7f/\u4e2d/\u7a84/\u9501),\u907f\u514d\u7cbe\u786e\u6cc4\u9732</div>' +
    '</div>' +
    '<button class="hclose" id="closeHelp">\u660e\u767d\u4e86</button>';
  showModal();
  document.getElementById('closeHelp').onclick = hideModal;
}

function showModal() { document.getElementById('modal').classList.add('show'); }
function hideModal() { document.getElementById('modal').classList.remove('show'); }

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function doSignin() {
  const data = loadSignin();
  const today = dateKey(new Date());
  if (data.lastDate === today) { toast('\u4eca\u5929\u5df2\u7b7e\u5230 \u00b7 \u8fde\u7eed' + (data.streak || 0) + '\u5929'); return; }
  markSigninToday();
  const fresh = loadSignin();
  updateHomeCounts();
  toast('\u7b7e\u5230\u6210\u529f!\u8fde\u7eed' + fresh.streak + '\u5929');
  showSigninResult(fresh);
}

function showSigninResult(d) {
  const exp = d.streak >= 7 ? '\u672c\u5468\u5168\u52e4\u5956\u52b1' : d.streak >= 3 ? '\u8fde\u7eed3\u5929+' : d.streak >= 1 ? '\u575a\u6301\u5c31\u662f\u80dc\u5229' : '\u5f00\u59cb\u4f60\u7684\u7b7e\u5230';
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u7b7e\u5230\u6210\u529f</div>' +
    '<div class="mst">' + dateKey(new Date()) + '</div>' +
    '<div class="stats" style="margin:18px 0"><div class="si"><div class="sn" style="color:#ff6b1a">' + d.streak + '</div><div class="sl">\u8fde\u7eed\u5929\u6570</div></div><div class="si"><div class="sn">' + d.totalDays + '</div><div class="sl">\u7d2f\u8ba1\u7b7e\u5230</div></div></div>' +
    '<div class="mex" style="font-style:normal;text-align:center">' + exp + '</div>' +
    '<div class="mb"><button class="mbtn p" id="signinGo">\u5f00\u59cb\u6e38\u620f</button><button class="mbtn s" id="signinClose">\u5173\u95ed</button></div>';
  showModal();
  document.getElementById('signinGo').onclick = () => { hideModal(); doStart(); };
  document.getElementById('signinClose').onclick = hideModal;
}

function renderDictBlock(word) {
  const dict = getDictEntry(word);
  let mean = MEAN[word] || '';
  if (!mean && dict) {
    const firstE = (dict.e || '').split('\n')[0].replace(/\[[^\]]+\]/g, '').trim();
    if (firstE) mean = firstE.length > 40 ? firstE.substring(0, 40) + '...' : firstE;
  }
  if (!mean) mean = '';
  let dictHtml;
  if (dict) {
    dictHtml = '<div class="dw"><div class="dwp">' + (dict.p || '') + '</div><div class="dws">' + (dict.s || '') + '</div>' + (dict.e ? '<div class="dwe">' + dict.e + '</div>' : '') + (dict.ex ? '<div class="dwex">\u4f8b: ' + dict.ex + '</div>' : '') + '</div>';
  } else if (dictLoaded()) {
    dictHtml = '<div class="dw" style="opacity:.7;text-align:center;padding:12px">\u8be5\u8bcd\u6682\u65e0\u91ca\u4e49<br><span style="font-size:11px;opacity:.6">' + (mean || '\u6682\u65e0\u91ca\u4e49') + '</span></div>';
  } else if (dictFailed()) {
    // 加载失败:不显示转圈,仅提示失败(中文释义仍由 mean 提供),重开弹窗即重试
    dictHtml = '<div class="dw" style="opacity:.5;text-align:center;padding:8px;font-size:11px">\u8bcd\u5178\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25</div>';
  } else {
    dictHtml = '<div class="dw" style="opacity:.5;text-align:center;padding:12px"><span class="dict-loading">\u52a0\u8f7d\u91ca\u4e49\u2026</span></div>';
  }
  return { mean: mean || '\u6682\u65e0\u91ca\u4e49', html: dictHtml };
}

function showWordDetail(word) {
  const r = renderDictBlock(word);
  const fav = isFav(word);
  const master = isMastered(word);
  document.getElementById('modalContent').innerHTML =
    '<div class="mt" style="letter-spacing:6px">' + word + '</div>' +
    '<div id="wordDictWrap"><div class="mst">' + r.mean + '</div>' + r.html + '</div>' +
    '<div class="mb"><button class="mbtn' + (fav ? ' sh' : ' s') + '" id="detailFav">' + (fav ? '\u2605 \u5df2\u6536\u85cf' : '\u2606 \u6536\u85cf') + '</button><button class="mbtn' + (master ? ' p' : ' s') + '" id="detailMaster">' + (master ? '\u2713 \u5df2\u638c\u63e1' : '\u25cb \u638c\u63e1') + '</button></div>' +
    '<div class="mb"><button class="mbtn s" id="backLib">\u8fd4\u56de\u8bcd\u5e93</button><button class="mbtn p" id="closeWord">\u5173\u95ed</button></div>';
  document.getElementById('backLib').onclick = showLibrary;
  document.getElementById('closeWord').onclick = hideModal;
  document.getElementById('detailFav').onclick = () => { toggleFav(word); showWordDetail(word); };
  document.getElementById('detailMaster').onclick = () => {
    const before = isMastered(word);
    toggleMaster(word);
    if (!before && isMastered(word)) {
      const ms = masteredMilestone(masteredCount());
      toast(ms || '\u5df2\u638c\u63e1 \u2713');
    }
    showWordDetail(word);
  };
  ensureDict(() => {
    const el = document.getElementById('wordDictWrap');
    if (el) { const r2 = renderDictBlock(word); el.innerHTML = '<div class="mst">' + r2.mean + '</div>' + r2.html; }
  });
}

function showDictLookup() {
  const w = State.answer;
  if (!w) { toast('\u8bf7\u5148\u5f00\u59cb\u4e00\u5c40'); return; }
  const r = renderDictBlock(w);
  document.getElementById('modalContent').innerHTML =
    '<div class="mt" style="letter-spacing:6px">' + w + '</div>' +
    '<div id="lookupDictWrap"><div class="mst">' + r.mean + '</div>' + r.html + '</div>' +
    '<div class="mb"><button class="mbtn s" id="closeDict">\u5173\u95ed</button></div>';
  showModal();
  document.getElementById('closeDict').onclick = hideModal;
  ensureDict(() => {
    const el = document.getElementById('lookupDictWrap');
    if (el) { const r2 = renderDictBlock(w); el.innerHTML = '<div class="mst">' + r2.mean + '</div>' + r2.html; }
  });
}

// 词库浏览状态
const LIB_PAGE_SIZE = 40;
let libState = { mode: 'word', diff: 'all', len: 'all', status: 'all', page: 0, query: '', list: [] };

function getLibWordList() {
  let words = [];
  if (libState.diff === 'all') {
    for (const d in VOCAB) for (const l in VOCAB[d]) words.push(...VOCAB[d][l]);
  } else {
    const d = libState.diff;
    if (libState.len === 'all') {
      for (const l in VOCAB[d]) words.push(...VOCAB[d][l]);
    } else {
      words = VOCAB[d][libState.len] ? VOCAB[d][libState.len].slice() : [];
    }
  }
  return [...new Set(words)].sort();
}

function getLibIdiomList() {
  return Object.keys(IDIOM || {}).sort((a, b) => a.localeCompare(b, 'zh'));
}

function libFilterWords(list) {
  const q = libState.query;
  if (!q) return list;
  return list.filter(w => w.includes(q) || (MEAN[w] && MEAN[w].indexOf(q) >= 0));
}

function showLibrary() {
  libState.mode = 'word';
  libState.diff = 'all';
  libState.len = 'all';
  libState.status = 'all';
  libState.page = 0;
  libState.query = '';
  libState.list = getLibWordList();
  renderLibrary();
  // 词典懒加载:加载完成后刷新"详"标记(仅在词库仍打开时)
  if (!dictLoaded()) {
    ensureDict(() => { if (document.getElementById('libList')) renderLibList(); });
  }
}

function renderLibrary() {
  let filterHtml = '<div class="lib-tabs">';
  filterHtml += '<button class="lib-tab' + (libState.mode === 'word' ? ' active' : '') + '" data-mode="word">\u8bcd\u6c47</button>';
  filterHtml += '<button class="lib-tab' + (libState.mode === 'idiom' ? ' active' : '') + '" data-mode="idiom">\u6210\u8bed</button>';
  filterHtml += '</div>';
  if (libState.mode === 'word') {
    filterHtml += '<div class="lib-filters"><div class="lib-fgroup">';
    filterHtml += '<button class="lib-f' + (libState.diff === 'all' ? ' active' : '') + '" data-diff="all">\u5168\u90e8</button>';
    DIFFICULTIES.forEach(d => {
      filterHtml += '<button class="lib-f' + (libState.diff === d.id ? ' active' : '') + '" data-diff="' + d.id + '">' + d.name + '</button>';
    });
    filterHtml += '</div><div class="lib-fgroup">';
    filterHtml += '<button class="lib-f' + (libState.len === 'all' ? ' active' : '') + '" data-len="all">\u5168\u957f</button>';
    LENGTHS.forEach(l => {
      filterHtml += '<button class="lib-f' + (libState.len == l ? ' active' : '') + '" data-len="' + l + '">' + l + '\u5b57</button>';
    });
    filterHtml += '</div><div class="lib-fgroup">';
    filterHtml += '<button class="lib-f' + (libState.status === 'all' ? ' active' : '') + '" data-status="all">\u5168\u90e8</button>';
    filterHtml += '<button class="lib-f' + (libState.status === 'fav' ? ' active' : '') + '" data-status="fav">\u2606 \u6536\u85cf</button>';
    filterHtml += '<button class="lib-f' + (libState.status === 'master' ? ' active' : '') + '" data-status="master">\u2713 \u5df2\u638c\u63e1</button>';
    filterHtml += '</div></div>';
    filterHtml += '<div class="lib-search"><input type="text" id="libInput" placeholder="\u8f93\u5165\u5355\u8bcd\u6216\u91ca\u4e49..." maxlength="20" autocomplete="off"><button class="lib-btn" id="libSearch">\u67e5\u8be2</button></div>';
  } else {
    filterHtml += '<div class="lib-search"><input type="text" id="libInput" placeholder="\u8f93\u5165\u6210\u8bed..." maxlength="20" autocomplete="off"><button class="lib-btn" id="libSearch">\u67e5\u8be2</button></div>';
  }
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u8bcd\u5e93</div>' +
    '<div class="mst">\u5bf9\u7167\u725b\u6d25\u8bcd\u5178 \u00b7 \u70b9\u51fb\u67e5\u770b\u91ca\u4e49</div>' +
    filterHtml +
    '<div class="lib-list" id="libList"></div>' +
    '<div class="lib-page" id="libPage"></div>' +
    '<div class="mb"><button class="mbtn s" id="closeLib">\u5173\u95ed</button></div>';
  showModal();
  document.getElementById('closeLib').onclick = hideModal;
  // 绑定筛选
  document.querySelectorAll('.lib-tab').forEach(b => {
    b.onclick = () => {
      libState.mode = b.dataset.mode;
      libState.page = 0;
      libState.query = '';
      libState.list = libState.mode === 'word' ? getLibWordList() : getLibIdiomList();
      renderLibrary();
    };
  });
  document.querySelectorAll('.lib-f').forEach(b => {
    b.onclick = () => {
      if (b.dataset.diff !== undefined) libState.diff = b.dataset.diff;
      if (b.dataset.len !== undefined) libState.len = b.dataset.len === 'all' ? 'all' : parseInt(b.dataset.len);
      if (b.dataset.status !== undefined) libState.status = b.dataset.status;
      libState.page = 0;
      libState.list = getLibWordList();
      renderLibrary();
    };
  });
  // 搜索
  const input = document.getElementById('libInput');
  if (input) {
    const doSearch = () => {
      libState.query = input.value.trim().toUpperCase();
      libState.page = 0;
      renderLibList();
    };
    document.getElementById('libSearch').onclick = doSearch;
    input.onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  }
  renderLibList();
}

function renderLibList() {
  const list = document.getElementById('libList');
  const pageBox = document.getElementById('libPage');
  let filtered;
  if (libState.mode === 'word') {
    filtered = libFilterWords(libState.list);
    if (libState.status === 'fav') filtered = filtered.filter(w => isFav(w));
    else if (libState.status === 'master') filtered = filtered.filter(w => isMastered(w));
  } else {
    const q = libState.query.toLowerCase();
    filtered = q ? libState.list.filter(w => w.indexOf(q) >= 0 || (IDIOM[w] && IDIOM[w].indexOf(q) >= 0)) : libState.list;
  }
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / LIB_PAGE_SIZE));
  if (libState.page >= totalPages) libState.page = totalPages - 1;
  if (libState.page < 0) libState.page = 0;
  const start = libState.page * LIB_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + LIB_PAGE_SIZE);
  let html = '';
  if (!total) {
    html = '<div style="text-align:center;opacity:.6;padding:20px">\u672a\u627e\u5230</div>';
  } else if (libState.mode === 'word') {
    pageItems.forEach(w => {
      const hasDict = !!getDictEntry(w);
      const mean = MEAN[w] || '';
      const fav = isFav(w);
      const master = isMastered(w);
      const cls = (hasDict ? 'has-dict' : '') + (master ? ' mastered' : '') + (fav ? ' fav' : '');
      html += '<div class="lib-item ' + cls.trim() + '" data-word="' + w + '">' +
        '<span class="lw">' + w + '</span>' +
        (hasDict ? '<span class="ld">\u8be6</span>' : '<span class="ld" style="opacity:.3">\u00b7</span>') +
        '<span class="lm">' + mean + '</span>' +
        '<button class="lib-mark fav' + (fav ? ' on' : '') + '" data-mark="fav" data-word="' + w + '" title="\u6536\u85cf" aria-label="\u6536\u85cf" aria-pressed="' + (fav ? 'true' : 'false') + '">' + (fav ? '\u2605' : '\u2606') + '</button>' +
        '<button class="lib-mark master' + (master ? ' on' : '') + '" data-mark="master" data-word="' + w + '" title="\u6807\u8bb0\u5df2\u638c\u63e1" aria-label="\u5df2\u638c\u63e1" aria-pressed="' + (master ? 'true' : 'false') + '">' + (master ? '\u2713' : '\u25cb') + '</button>' +
        '</div>';
    });
  } else {
    pageItems.forEach(w => {
      const mean = IDIOM[w] || '';
      html += '<div class="lib-item idiom" data-idiom="' + w + '"><span class="lw zhi">' + w + '</span><span class="lm">' + mean + '</span></div>';
    });
  }
  list.innerHTML = html;
  // 分页控件
  let ph = '';
  if (totalPages > 1) {
    ph += '<button class="lib-pg" id="libPrev"' + (libState.page <= 0 ? ' disabled' : '') + '>\u4e0a\u4e00\u9875</button>';
    ph += '<span class="lib-pginfo">' + (libState.page + 1) + '/' + totalPages + ' \u00b7 ' + total + '\u6761</span>';
    ph += '<button class="lib-pg" id="libNext"' + (libState.page >= totalPages - 1 ? ' disabled' : '') + '>\u4e0b\u4e00\u9875</button>';
  } else {
    ph = '<span class="lib-pginfo">' + total + ' \u6761</span>';
  }
  pageBox.innerHTML = ph;
  const prev = document.getElementById('libPrev');
  const next = document.getElementById('libNext');
  if (prev) prev.onclick = () => { if (libState.page > 0) { libState.page--; renderLibList(); } };
  if (next) next.onclick = () => { if (libState.page < totalPages - 1) { libState.page++; renderLibList(); } };
  // 标记按钮(收藏/掌握):阻止冒泡,避免触发详情
  list.querySelectorAll('.lib-mark').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      const w = b.dataset.word;
      let on;
      if (b.dataset.mark === 'fav') {
        on = toggleFav(w);
      } else {
        const before = isMastered(w);
        on = toggleMaster(w);
        if (!before && on) {
          const ms = masteredMilestone(masteredCount());
          toast(ms || '\u5df2\u638c\u63e1 \u2713');
        }
      }
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      // 若当前在收藏/已掌握筛选下,移除标记后需重渲染列表
      if (!on && ((b.dataset.mark === 'fav' && libState.status === 'fav') || (b.dataset.mark === 'master' && libState.status === 'master'))) {
        renderLibList();
      } else {
        // 仅更新该按钮与项样式
        b.classList.toggle('on', on);
        b.textContent = b.dataset.mark === 'fav' ? (on ? '\u2605' : '\u2606') : (on ? '\u2713' : '\u25cb');
        const item = b.closest('.lib-item');
        if (item) {
          item.classList.toggle('fav', b.dataset.mark === 'fav' && on);
          item.classList.toggle('mastered', b.dataset.mark === 'master' && on);
        }
      }
    };
  });
  // 绑定点击(详情)
  list.querySelectorAll('.lib-item').forEach(el => {
    el.onclick = () => {
      if (libState.mode === 'word') showWordDetail(el.dataset.word);
      else showIdiomDetail(el.dataset.idiom);
    };
  });
}

function showIdiomDetail(idiom) {
  const mean = IDIOM[idiom] || '';
  document.getElementById('modalContent').innerHTML =
    '<div class="mt" style="letter-spacing:2px;font-size:22px">' + idiom + '</div>' +
    '<div class="mst" style="text-align:left;max-width:300px;line-height:1.7">' + mean + '</div>' +
    '<div class="mb"><button class="mbtn s" id="backLib">\u8fd4\u56de\u8bcd\u5e93</button><button class="mbtn p" id="closeWord">\u5173\u95ed</button></div>';
  showModal();
  document.getElementById('backLib').onclick = renderLibrary;
  document.getElementById('closeWord').onclick = hideModal;
}

function showHome() {
  stopTimer();
  document.getElementById('home').classList.remove('hidden');
  document.getElementById('game').classList.remove('show');
  buildDiffTabs();
  updateHomeCounts();
}

// ===== 错词本复习流程(SRS) =====
let reviewState = { queue: [], idx: 0, revealed: false, known: 0, unknown: 0 };

function showReview() {
  const due = srsDueWords();
  if (due.length === 0) {
    document.getElementById('modalContent').innerHTML =
      '<div class="mt">\u590d\u4e60</div>' +
      '<div class="mst">\u5f53\u524d\u6ca1\u6709\u5230\u671f\u9700\u590d\u4e60\u7684\u9519\u8bcd</div>' +
      '<div class="mex" style="font-style:normal;text-align:center">\u9519\u8bcd\u672c\u5171 ' + srsTotalCount() + ' \u8bcd</div>' +
      '<div class="mb"><button class="mbtn p" id="closeReview">\u5173\u95ed</button></div>';
    showModal();
    document.getElementById('closeReview').onclick = hideModal;
    return;
  }
  reviewState = { queue: due, idx: 0, revealed: false, known: 0, unknown: 0 };
  renderReviewCard();
}

function renderReviewCard() {
  if (reviewState.idx >= reviewState.queue.length) {
    // 完成一轮复习即视为今日学习,自动签到
    markSigninToday();
    const praise = reviewPraise(reviewState.known, reviewState.queue.length);
    document.getElementById('modalContent').innerHTML =
      '<div class="mt">\u590d\u4e60\u5b8c\u6210</div>' +
      (praise ? '<div class="mst" style="color:#4a9d54">' + praise + '</div>' : '<div class="mst">\u672c\u8f6e ' + reviewState.queue.length + ' \u8bcd</div>') +
      '<div class="stats" style="margin:18px 0"><div class="si"><div class="sn" style="color:#4a9d54">' + reviewState.known + '</div><div class="sl">\u8bb0\u5f97</div></div><div class="si"><div class="sn" style="color:#e7534b">' + reviewState.unknown + '</div><div class="sl">\u4e0d\u8bb0\u5f97</div></div></div>' +
      '<div class="mb"><button class="mbtn p" id="reviewDone">\u5b8c\u6210</button></div>';
    showModal();
    document.getElementById('reviewDone').onclick = () => { hideModal(); updateHomeCounts(); };
    return;
  }
  const word = reviewState.queue[reviewState.idx];
  const r = renderDictBlock(word);
  const progress = (reviewState.idx + 1) + '/' + reviewState.queue.length;
  let body;
  if (!reviewState.revealed) {
    body = '<div style="font-size:13px;color:#8a8a92;margin:10px 0">\u60f3\u60f3\u8fd9\u4e2a\u8bcd\u7684\u610f\u601d,\u51c6\u5907\u597d\u540e\u67e5\u770b</div>' +
      '<div class="mw" style="letter-spacing:6px">' + word + '</div>' +
      '<div class="mb"><button class="mbtn p" id="revealBtn">\u663e\u793a\u91ca\u4e49</button></div>';
  } else {
    body = '<div class="mw" style="letter-spacing:6px">' + word + '</div>' +
      '<div id="reviewDictWrap"><div class="mst">' + r.mean + '</div>' + r.html + '</div>' +
      '<div class="mb"><button class="mbtn danger" id="unknownBtn">\u4e0d\u8bb0\u5f97</button><button class="mbtn p" id="knownBtn">\u8bb0\u5f97</button></div>';
  }
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u590d\u4e60 <span style="font-size:13px;color:#8a8a92;font-weight:400">' + progress + '</span></div>' +
    body +
    '<div style="margin-top:8px"><button class="mbtn" id="removeWordBtn" style="background:transparent;color:#8a8a92;font-size:11px;width:100%;min-width:0">\u5df2\u638c\u63e1,\u4ece\u9519\u8bcd\u672c\u79fb\u9664</button></div>';
  showModal();
  const reveal = document.getElementById('revealBtn');
  if (reveal) reveal.onclick = () => { reviewState.revealed = true; renderReviewCard(); };
  const known = document.getElementById('knownBtn');
  if (known) known.onclick = () => {
    srsReview(word, true);
    reviewState.known++;
    reviewState.idx++;
    reviewState.revealed = false;
    renderReviewCard();
  };
  const unknown = document.getElementById('unknownBtn');
  if (unknown) unknown.onclick = () => {
    srsReview(word, false);
    reviewState.unknown++;
    reviewState.idx++;
    reviewState.revealed = false;
    renderReviewCard();
  };
  const remove = document.getElementById('removeWordBtn');
  if (remove) remove.onclick = () => {
    const became = markMastered(word); // 同步标记为已掌握(单向),返回是否首次
    srsRemoveWord(word);
    if (became) {
      const ms = masteredMilestone(masteredCount());
      toast(ms || '\u5df2\u638c\u63e1 \u2713');
    }
    reviewState.idx++;
    reviewState.revealed = false;
    renderReviewCard();
  };
  // 词典懒加载:仅刷新当前揭示卡片(切卡后旧回调作废)
  if (reviewState.revealed) {
    ensureDict(() => {
      if (reviewState.queue[reviewState.idx] === word && reviewState.revealed) {
        const el = document.getElementById('reviewDictWrap');
        if (el) { const r2 = renderDictBlock(word); el.innerHTML = '<div class="mst">' + r2.mean + '</div>' + r2.html; }
      }
    });
  }
}

function showGame() {
  document.getElementById('home').classList.add('hidden');
  document.getElementById('game').classList.add('show');
}
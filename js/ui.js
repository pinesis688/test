'use strict';

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
  if (sub) sub.textContent = sg.lastDate === dateKey(now) ? '今日已签到' : '点击签到';
}

function openSettings() {
  document.getElementById('settingsPanel').classList.add('show');
  buildSpOptions();
}

function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('show');
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
  } else if (id === 'spLenOpts') State.len = item;
  else if (id === 'spAttemptOpts') State.attempts = item;
  else if (id === 'spHintOpts') State.hints = item;
  else if (id === 'spExcludeOpts') State.excludeCount = item;
  else if (id === 'spTimedOpts') State.timed = item;
}

function updateGameInfo() {
  const d = DIFFICULTIES.find(x => x.id === State.diff);
  const cand = countCandidates();
  let html = '<span>\u96be\u5ea6<b>' + d.name + '</b></span><span>\u957f\u5ea6<b>' + State.len + '</b></span><span>\u63d0\u793a<b>' + State.hintsLeft + '</b></span><span>\u5019\u9009<b>' + cand + '</b></span>';
  if (State.timed > 0 && State.startTime > 0) {
    const warn = State.timeLeft <= 10 ? ' warn' : '';
    html += '<span class="timer' + warn + '">\u23f1 ' + fmtTime(State.timeLeft) + '</span>';
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
  updateHomeCounts();
  setTimeout(() => showResult(won), 300);
}

function buildResultModal(won) {
  const s = State.stats[statKey()] || { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const winRate = s.played ? Math.round(s.won / s.played * 100) : 0;
  const maxD = Math.max(1, ...s.dist);
  const lastWin = State.rows.findIndex(r => r && r.every(t => t.classList.contains('correct')));
  let distHtml = '';
  for (let i = 0; i < State.attempts; i++) {
    const cnt = s.dist[i] || 0;
    distHtml += '<div class="dr"><div class="dn">' + (i + 1) + '</div><div class="db' + (i === lastWin ? ' hl' : '') + '" style="width:' + Math.max(8, cnt / maxD * 100) + '%">' + cnt + '</div></div>';
  }
  const dict = typeof DICT !== 'undefined' ? DICT[State.answer] : null;
  const meaning = typeof MEAN !== 'undefined' ? (MEAN[State.answer] || '') : '';
  const elapsed = Math.floor(gameElapsed() / 1000);
  const diffName = DIFFICULTIES.find(x => x.id === State.diff).name;
  let dictHtml = '';
  if (dict) dictHtml = '<div class="mphon">' + dict.p + '</div><div class="mpos">' + dict.s + '</div><div class="mex">' + dict.e + '</div>';
  const timedLabel = State.timed > 0 ? ' \u00b7 \u9650\u65f6' + State.timed + 's' : '';
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">' + (won ? '\u606d\u559c!' : '\u6e38\u620f\u7ed3\u675f') + '</div>' +
    '<div class="mst">' + (won ? '\u7b2c' + (lastWin + 1) + '\u6b21\u731c\u4e2d' : '\u672a\u80fd\u731c\u51fa\u7b54\u6848') + (State.startTime > 0 ? ' \u00b7 \u7528\u65f6 ' + fmtTime(elapsed) : '') + '</div>' +
    '<div class="mw">' + State.answer + '</div>' + dictHtml +
    '<div class="mm">' + (meaning || '\u6682\u65e0\u91ca\u4e49') + '</div>' +
    '<div class="dt">\u731c\u8bcd\u5206\u5e03 (' + diffName + ' \u00b7 ' + State.len + '\u5b57\u6bcd' + timedLabel + ')</div>' + distHtml +
    '<div class="stats"><div class="si"><div class="sn">' + s.played + '</div><div class="sl">\u603b\u573a\u6b21</div></div><div class="si"><div class="sn">' + winRate + '%</div><div class="sl">\u80dc\u7387</div></div><div class="si"><div class="sn">' + s.streak + '</div><div class="sl">\u8fde\u80dc</div></div><div class="si"><div class="sn">' + s.maxStreak + '</div><div class="sl">\u6700\u957f\u8fde\u80dc</div></div></div>' +
    '<div class="mb"><button class="mbtn sh" id="shareBtn">\u5206\u4eab</button><button class="mbtn p" id="playAgain">\u518d\u6765\u4e00\u5c40</button><button class="mbtn s" id="backHome">\u9996\u9875</button></div>';
  showModal();
  document.getElementById('playAgain').onclick = () => { hideModal(); newGame(); };
  document.getElementById('backHome').onclick = () => { hideModal(); showHome(); };
  document.getElementById('shareBtn').onclick = shareResult;
}

function showResult(won) { buildResultModal(won); }

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
  const s = State.stats[statKey()] || { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const winRate = s.played ? Math.round(s.won / s.played * 100) : 0;
  const maxD = Math.max(1, ...s.dist);
  let distHtml = '';
  for (let i = 0; i < 10; i++) {
    const cnt = s.dist[i] || 0;
    distHtml += '<div class="dr"><div class="dn">' + (i + 1) + '</div><div class="db" style="width:' + Math.max(8, cnt / maxD * 100) + '%">' + cnt + '</div></div>';
  }
  const diffName = DIFFICULTIES.find(x => x.id === State.diff).name;
  const timedLabel = State.timed > 0 ? ' \u00b7 \u9650\u65f6' + State.timed + 's' : '';
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u7edf\u8ba1</div>' +
    '<div class="mst">' + diffName + ' \u00b7 ' + State.len + '\u5b57\u6bcd' + timedLabel + '</div>' +
    '<div class="stats"><div class="si"><div class="sn">' + s.played + '</div><div class="sl">\u603b\u573a\u6b21</div></div><div class="si"><div class="sn">' + winRate + '%</div><div class="sl">\u80dc\u7387</div></div><div class="si"><div class="sn">' + s.streak + '</div><div class="sl">\u8fde\u80dc</div></div><div class="si"><div class="sn">' + s.maxStreak + '</div><div class="sl">\u6700\u957f\u8fde\u80dc</div></div></div>' +
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
    '<div class="hi"><div class="hts"><div class="hti excluded">E</div></div><div>\u6392\u9664:\u786e\u8ba4\u4e0d\u5728\u7b54\u6848\u4e2d</div></div>' +
    '</div>' +
    '<div class="dt">\u8f85\u52a9\u529f\u80fd</div>' +
    '<div class="help-list">' +
    '<div class="hi">\u63d0\u793a:\u9501\u5b9a\u4e00\u4e2a\u6b63\u786e\u5b57\u6bcd\u4f4d\u7f6e(\u6570\u91cf\u9996\u9875\u53ef\u9009 0-3)</div>' +
    '<div class="hi">\u6392\u9664:\u81ea\u52a8\u6392\u9664\u4e0d\u5728\u7b54\u6848\u4e2d\u7684\u5b57\u6bcd(\u6570\u91cf\u9996\u9875\u53ef\u9009 0-6)</div>' +
    '<div class="hi">\u653e\u5f03:\u7ed3\u675f\u672c\u5c40\u5e76\u663e\u793a\u7b54\u6848</div>' +
    '<div class="hi">\u9650\u65f6:\u5012\u8ba1\u65f6\u6a21\u5f0f,\u65f6\u95f4\u5230\u81ea\u52a8\u5224\u8d1f</div>' +
    '<div class="hi">\u5019\u9009:\u5b9e\u65f6\u663e\u793a\u5269\u4f59\u53ef\u80fd\u8bcd\u6570</div>' +
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
  const today = dateKey(new Date());
  const data = loadSignin();
  if (data.lastDate === today) { toast('\u4eca\u5929\u5df2\u7b7e\u5230 \u00b7 \u8fde\u7eed' + data.streak + '\u5929'); return; }
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  if (data.lastDate === yesterday) data.streak++; else data.streak = 1;
  data.lastDate = today;
  data.totalDays = (data.totalDays || 0) + 1;
  saveSignin(data);
  updateHomeCounts();
  toast('\u7b7e\u5230\u6210\u529f!\u8fde\u7eed' + data.streak + '\u5929');
  showSigninResult(data);
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
  const dict = DICT[word];
  let mean = MEAN[word] || '';
  if (!mean && dict) {
    const firstE = (dict.e || '').split('\n')[0].replace(/\[[^\]]+\]/g, '').trim();
    if (firstE) mean = firstE.length > 40 ? firstE.substring(0, 40) + '...' : firstE;
  }
  if (!mean) mean = '';
  let dictHtml = '';
  if (dict) {
    dictHtml = '<div class="dw"><div class="dwp">' + (dict.p || '') + '</div><div class="dws">' + (dict.s || '') + '</div>' + (dict.e ? '<div class="dwe">' + dict.e + '</div>' : '') + (dict.ex ? '<div class="dwex">\u4f8b: ' + dict.ex + '</div>' : '') + '</div>';
  } else {
    dictHtml = '<div class="dw" style="opacity:.7;text-align:center;padding:12px">\u8be5\u8bcd\u6682\u65e0\u91ca\u4e49<br><span style="font-size:11px;opacity:.6">' + (mean || '\u6682\u65e0\u91ca\u4e49') + '</span></div>';
  }
  return { mean: mean || '\u6682\u65e0\u91ca\u4e49', html: dictHtml };
}

function showWordDetail(word) {
  const { mean, html: dictHtml } = renderDictBlock(word);
  document.getElementById('modalContent').innerHTML =
    '<div class="mt" style="letter-spacing:6px">' + word + '</div>' +
    '<div class="mst">' + mean + '</div>' + dictHtml +
    '<div class="mb"><button class="mbtn s" id="backLib">\u8fd4\u56de\u8bcd\u5e93</button><button class="mbtn p" id="closeWord">\u5173\u95ed</button></div>';
  document.getElementById('backLib').onclick = showLibrary;
  document.getElementById('closeWord').onclick = hideModal;
}

function showDictLookup() {
  const w = State.answer;
  if (!w) { toast('\u8bf7\u5148\u5f00\u59cb\u4e00\u5c40'); return; }
  const { mean, html: dictHtml } = renderDictBlock(w);
  document.getElementById('modalContent').innerHTML =
    '<div class="mt" style="letter-spacing:6px">' + w + '</div>' +
    '<div class="mst">' + mean + '</div>' + dictHtml +
    '<div class="mb"><button class="mbtn s" id="closeDict">\u5173\u95ed</button></div>';
  showModal();
  document.getElementById('closeDict').onclick = hideModal;
}

function showLibrary() {
  document.getElementById('modalContent').innerHTML =
    '<div class="mt">\u8bcd\u5e93</div>' +
    '<div class="mst">\u5bf9\u7167\u725b\u6d25\u8bcd\u5178 \u00b7 5\u96be\u5ea6\u00d74\u957f\u5ea6</div>' +
    '<div class="lib-search"><input type="text" id="libInput" placeholder="\u8f93\u5165\u5355\u8bcd\u67e5\u8bcd..." maxlength="10" autocomplete="off"><button class="lib-btn" id="libSearch">\u67e5\u8be2</button></div>' +
    '<div class="lib-list" id="libList"></div>' +
    '<div class="lib-stats" id="libStats"></div>' +
    '<div class="mb"><button class="mbtn s" id="closeLib">\u5173\u95ed</button></div>';
  showModal();
  const input = document.getElementById('libInput');
  const list = document.getElementById('libList');
  const stats = document.getElementById('libStats');
  let cnt = 0;
  for (const d in VOCAB) for (const l in VOCAB[d]) cnt += VOCAB[d][l].length;
  stats.innerHTML = '<div style="font-size:11px;opacity:.7;margin:6px 0">\u5171 ' + cnt + ' \u8bcd \u00b7 ' + Object.keys(DICT).length + '+ \u8bcd\u6709\u91ca\u4e49</div>';
  function render(words) {
    if (!words.length) { list.innerHTML = '<div style="text-align:center;opacity:.6;padding:20px">\u672a\u627e\u5230\u8be5\u8bcd</div>'; return; }
    let html = '';
    words.slice(0, 100).forEach(w => {
      const hasDict = !!DICT[w];
      const mean = MEAN[w] || '';
      html += '<div class="lib-item ' + (hasDict ? 'has-dict' : '') + '" data-word="' + w + '"><span class="lw">' + w + '</span>' + (hasDict ? '<span class="ld">\ud83d\udcd6</span>' : '<span class="ld" style="opacity:.3">\u00b7</span>') + '<span class="lm">' + mean + '</span></div>';
    });
    if (words.length > 100) html += '<div style="text-align:center;opacity:.5;padding:8px;font-size:11px">...\u8fd8\u6709 ' + (words.length - 100) + ' \u4e2a</div>';
    list.innerHTML = html;
    list.querySelectorAll('.lib-item').forEach(el => { el.onclick = () => showWordDetail(el.dataset.word); });
  }
  const allWords = [];
  for (const d in VOCAB) for (const l in VOCAB[d]) allWords.push(...VOCAB[d][l]);
  const uniqueWords = [...new Set(allWords)].sort();
  render(uniqueWords.slice(0, 100));
  function doSearch() {
    const q = input.value.trim().toUpperCase();
    if (!q) return render(uniqueWords.slice(0, 100));
    render(uniqueWords.filter(w => w.includes(q)));
  }
  document.getElementById('libSearch').onclick = doSearch;
  input.onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  document.getElementById('closeLib').onclick = hideModal;
}

function showHome() {
  stopTimer();
  document.getElementById('home').classList.remove('hidden');
  document.getElementById('game').classList.remove('show');
  buildDiffTabs();
  updateHomeCounts();
}

function showGame() {
  document.getElementById('home').classList.add('hidden');
  document.getElementById('game').classList.add('show');
}
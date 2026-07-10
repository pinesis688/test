'use strict';

function buildKeyboard() {
  const kb = document.getElementById('kb');
  kb.innerHTML = '';
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  rows.forEach((r, ri) => {
    const row = document.createElement('div');
    row.className = 'kr';
    if (ri === 2) {
      const ent = document.createElement('button');
      ent.className = 'key wide';
      ent.textContent = '确认';
      ent.onclick = () => handleKey('ENTER');
      row.appendChild(ent);
    }
    r.split('').forEach(k => {
      const key = document.createElement('button');
      key.className = 'key';
      key.textContent = k;
      key.onclick = () => handleKey(k);
      row.appendChild(key);
    });
    if (ri === 2) {
      const del = document.createElement('button');
      del.className = 'key wide';
      del.textContent = '删除';
      del.onclick = () => handleKey('BACKSPACE');
      row.appendChild(del);
    }
    kb.appendChild(row);
  });
  for (const letter in State.keyState) {
    const state = State.keyState[letter];
    document.querySelectorAll('#kb .key').forEach(k => {
      if (k.textContent === letter) {
        k.classList.remove('correct', 'present', 'absent', 'excluded');
        k.classList.add(state);
      }
    });
  }
}

function updateKeyState(letter, state) {
  const cur = State.keyState[letter];
  if (cur === 'correct') return;
  if (cur === 'present' && state !== 'correct') return;
  if (cur === 'excluded' && state === 'absent') return;
  State.keyState[letter] = state;
  document.querySelectorAll('#kb .key').forEach(k => {
    if (k.textContent === letter) {
      k.classList.remove('correct', 'present', 'absent', 'excluded');
      k.classList.add(state);
    }
  });
}

function refreshAllKeys() {
  const states = State.keyState;
  document.querySelectorAll('#kb .key').forEach(k => {
    const letter = k.textContent;
    if (letter.length === 1 && states[letter]) {
      k.classList.remove('correct', 'present', 'absent', 'excluded');
      k.classList.add(states[letter]);
    }
  });
}

function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  board.style.gridTemplateRows = `repeat(${State.attempts},1fr)`;
  const size = tileSize();
  State.rows = [];
  for (let r = 0; r < State.attempts; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gridTemplateColumns = `repeat(${State.len},1fr)`;
    const tiles = [];
    for (let c = 0; c < State.len; c++) {
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.width = size + 'px';
      t.style.height = size + 'px';
      t.style.fontSize = (size * 0.5) + 'px';
      row.appendChild(t);
      tiles.push(t);
    }
    board.appendChild(row);
    State.rows.push(tiles);
  }
  applyHintLockedToBoard();
}

function tileSize() {
  const w = Math.min(window.innerWidth - 20, 500);
  const cols = State.len;
  const gap = 5, pad = 16;
  return Math.floor((w - pad - gap * (cols - 1)) / cols);
}

function applyHintLockedToBoard() {
  for (let r = State.curRow; r < State.attempts; r++) {
    const row = State.rows[r];
    if (!row) continue;
    for (let c = 0; c < State.len; c++) {
      if (State.hintLocked[c]) {
        const tile = row[c];
        if (!tile.textContent) {
          tile.textContent = State.answer[c];
          tile.classList.add('locked', 'filled');
        }
      }
    }
  }
}

function startTimer() {
  if (State.timed <= 0) return;
  State.startTime = Date.now();
  State.endTime = 0;
  State.timeLeft = State.timed;
  State.timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - State.startTime) / 1000);
    State.timeLeft = Math.max(0, State.timed - elapsed);
    if (State.timeLeft <= 0) {
      State.timeLeft = 0;
      stopTimer();
      timeUp();
    }
    updateGameInfo();
  }, 500);
}

function stopTimer() {
  if (State.timer) { clearInterval(State.timer); State.timer = null; }
  if (State.startTime > 0 && State.endTime === 0) State.endTime = Date.now();
}

function resumeTimer() {
  if (State.timed <= 0 || State.gameOver) return;
  State.endTime = 0;
  State.startTime = Date.now() - (State.timed - State.timeLeft) * 1000;
  State.timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - State.startTime) / 1000);
    State.timeLeft = Math.max(0, State.timed - elapsed);
    if (State.timeLeft <= 0) {
      State.timeLeft = 0;
      stopTimer();
      timeUp();
    }
    updateGameInfo();
  }, 500);
}

function timeUp() {
  if (State.gameOver) return;
  State.gameOver = true;
  State.won = false;
  toast('时间到');
  saveGameState();
  srsAddWord(State.answer);
  recordResult(false);
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function gameElapsed() {
  return State.startTime ? ((State.endTime > 0 ? State.endTime : Date.now()) - State.startTime) : 0;
}

function countCandidates() {
  const greens = {}, yellows = {}, grays = new Set();
  const yellowSet = new Set();
  for (let r = 0; r < State.curRow; r++) {
    const row = State.rows[r];
    for (let c = 0; c < State.len; c++) {
      const t = row[c];
      const letter = t.textContent;
      if (t.classList.contains('correct')) {
        greens[c] = letter;
      } else if (t.classList.contains('present')) {
        if (!yellows[letter]) yellows[letter] = 0;
        yellows[letter]++;
        yellowSet.add(letter);
      }
    }
  }
  for (let r = 0; r < State.curRow; r++) {
    const row = State.rows[r];
    for (let c = 0; c < State.len; c++) {
      const t = row[c];
      const letter = t.textContent;
      if (t.classList.contains('absent') && !yellowSet.has(letter) && !Object.values(greens).includes(letter)) {
        grays.add(letter);
      }
    }
  }
  for (const c in State.hintLocked) greens[+c] = State.answer[+c];
  State.excludedLetters.forEach(l => { if (!yellowSet.has(l) && !Object.values(greens).includes(l)) grays.add(l); });
  let count = 0;
  State.wordPool.forEach(w => {
    let ok = true;
    for (const c in greens) { if (w[+c] !== greens[c]) { ok = false; break; } }
    if (!ok) return;
    for (const l in yellows) {
      let cnt = 0;
      for (const c in greens) { if (greens[c] === l) cnt++; }
      for (let i = 0; i < w.length; i++) { if (w[i] === l) cnt++; }
      if (cnt < yellows[l]) { ok = false; break; }
    }
    if (!ok) return;
    grays.forEach(l => { if (w.includes(l)) ok = false; });
    if (!ok) return;
    count++;
  });
  return count;
}

// 模糊档位:避免精确泄露候选数,仅给粗略范围感知
function candidateTier() {
  const c = countCandidates();
  if (c > 100) return '广';
  if (c > 20) return '中';
  if (c > 1) return '窄';
  return '锁';
}

function serializeGame() {
  const rows = [];
  for (let r = 0; r <= State.curRow && r < State.attempts; r++) {
    const row = State.rows[r];
    if (!row) break;
    const cells = [];
    for (let c = 0; c < State.len; c++) {
      const t = row[c];
      const cls = ['correct', 'present', 'absent', 'excluded', 'locked', 'filled']
        .filter(x => t.classList.contains(x));
      cells.push({ t: t.textContent, c: cls });
    }
    rows.push(cells);
  }
  return {
    diff: State.diff, len: State.len, attempts: State.attempts,
    hints: State.hints, hintsLeft: State.hintsLeft, hintsUsed: State.hintsUsed,
    excludeCount: State.excludeCount, excludeUsed: State.excludeUsed,
    excludedLetters: [...State.excludedLetters],
    timed: State.timed, timeLeft: State.timeLeft,
    answer: State.answer, curRow: State.curRow, curCol: State.curCol,
    hintLocked: { ...State.hintLocked },
    keyState: { ...State.keyState },
    gameOver: State.gameOver, won: State.won,
    rows
  };
}

function saveGameState() {
  if (!State.answer) return;
  saveGameSave(serializeGame());
}

function restoreGameState(saved) {
  loadDict(); // 恢复对局时也预加载词典
  State.diff = saved.diff;
  State.len = saved.len;
  State.attempts = saved.attempts;
  State.hints = saved.hints;
  State.hintsLeft = saved.hintsLeft;
  State.hintsUsed = saved.hintsUsed;
  State.excludeCount = saved.excludeCount;
  State.excludeUsed = saved.excludeUsed;
  State.excludedLetters = new Set(saved.excludedLetters);
  State.timed = saved.timed;
  State.timeLeft = saved.timeLeft;
  State.answer = saved.answer;
  State.curRow = saved.curRow;
  State.curCol = saved.curCol;
  State.hintLocked = saved.hintLocked;
  State.keyState = saved.keyState;
  State.gameOver = saved.gameOver;
  State.won = saved.won;
  State.evaluating = false;
  State.startTime = 0;
  State.endTime = 0;
  State.wordPool = getWordPool(State.diff, State.len);
  rebuildValidSet();
  buildBoard();
  buildKeyboard();
  // 回填已提交行
  for (let r = 0; r < saved.rows.length; r++) {
    const cells = saved.rows[r];
    if (!State.rows[r]) break;
    for (let c = 0; c < State.len; c++) {
      const t = State.rows[r][c];
      t.textContent = cells[c].t;
      cells[c].c.forEach(cls => t.classList.add(cls));
    }
  }
  refreshAllKeys();
  updateGameInfo();
  if (!State.gameOver) resumeTimer();
}

function newGame() {
  clearGameSave();
  loadDict(); // 后台预加载词典(1.5MB),用户游玩期间加载完成,结果弹窗立即可用
  const pool = getWordPool(State.diff, State.len);
  if (pool.length === 0) {
    toast('该难度下无此长度的词汇');
    return false;
  }
  State.wordPool = pool;
  rebuildValidSet();
  State.answer = pool[Math.floor(Math.random() * pool.length)];
  State.curRow = 0;
  State.curCol = 0;
  State.gameOver = false;
  State.won = false;
  State.evaluating = false;
  State.keyState = {};
  State.hintLocked = {};
  State.hintsUsed = 0;
  State.hintsLeft = State.hints;
  State.excludeUsed = false;
  State.excludedLetters = new Set();
  State.startTime = 0;
  State.endTime = 0;
  State.timeLeft = 0;
  buildBoard();
  buildKeyboard();
  updateGameInfo();
  startTimer();
  return true;
}

function handleKey(key) {
  if (State.evaluating || State.gameOver) return;
  if (key === 'ENTER') return submitGuess();
  if (key === 'BACKSPACE') return deleteLetter();
  if (/^[A-Z]$/.test(key)) {
    let c = State.curCol;
    while (c < State.len && State.hintLocked[c]) c++;
    if (c >= State.len) return;
    const tile = State.rows[State.curRow][c];
    tile.textContent = key;
    tile.classList.add('filled');
    State.curCol = c + 1;
    while (State.curCol < State.len && State.hintLocked[State.curCol]) State.curCol++;
  }
}

function deleteLetter() {
  for (let c = State.curCol - 1; c >= 0; c--) {
    if (State.hintLocked[c]) continue;
    const tile = State.rows[State.curRow][c];
    tile.textContent = '';
    tile.classList.remove('filled');
    State.curCol = c;
    while (State.curCol > 0 && State.hintLocked[State.curCol - 1]) State.curCol--;
    return;
  }
}

function useHint() {
  if (State.evaluating || State.gameOver) return;
  if (State.hintsLeft <= 0) return toast('没有可用提示');
  const avail = [];
  for (let c = 0; c < State.len; c++) { if (!State.hintLocked[c]) avail.push(c); }
  if (avail.length === 0) return toast('所有位置已锁定');
  const c = avail[Math.floor(Math.random() * avail.length)];
  State.hintLocked[c] = true;
  State.hintsLeft--;
  State.hintsUsed++;
  const curTile = State.rows[State.curRow][c];
  curTile.textContent = State.answer[c];
  curTile.classList.add('locked', 'filled');
  curTile.classList.remove('correct', 'present', 'absent');
  State.curCol = 0;
  while (State.curCol < State.len && (State.hintLocked[State.curCol] || State.rows[State.curRow][State.curCol].textContent)) {
    State.curCol++;
  }
  toast(`第 ${c + 1} 位: ${State.answer[c]}`);
  updateGameInfo();
  saveGameState();
}

function useExclude() {
  if (State.excludeCount <= 0) return toast('未启用排除');
  if (State.evaluating || State.excludeUsed || State.gameOver) return toast('已使用排除');
  const n = State.excludeCount;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const used = new Set();
  for (let r = 0; r < State.curRow; r++) {
    const row = State.rows[r];
    for (let c = 0; c < State.len; c++) {
      const t = row[c];
      if (t.classList.contains('correct') || t.classList.contains('present') || t.classList.contains('absent')) {
        used.add(t.textContent);
      }
    }
  }
  // 随机排除未使用字母,不预知是否在答案中:排除有风险,可能误排到答案字母
  const candidates = alphabet.filter(l =>
    !used.has(l) && State.keyState[l] !== 'correct' && State.keyState[l] !== 'present' && State.keyState[l] !== 'excluded'
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const excluded = candidates.slice(0, Math.min(n, candidates.length));
  excluded.forEach(l => {
    State.keyState[l] = 'excluded';
    State.excludedLetters.add(l);
  });
  State.excludeUsed = true;
  refreshAllKeys();
  toast(`已排除 ${excluded.join(' ')}`);
  updateGameInfo();
  saveGameState();
}

function surrender() {
  if (State.evaluating || State.gameOver) return;
  State.gameOver = true;
  State.won = false;
  stopTimer();
  saveGameState();
  srsAddWord(State.answer);
  recordResult(false);
}

function submitGuess() {
  if (State.evaluating || State.gameOver) return;
  if (State.curCol < State.len) { shakeRow(); toast('字母不足'); return; }
  let guess = '';
  for (let c = 0; c < State.len; c++) guess += State.rows[State.curRow][c].textContent;
  if (!State.validSet.has(guess)) { shakeRow(); toast('不在词库中'); return; }
  evaluateGuess(guess);
}

function evaluateGuess(guess) {
  State.evaluating = true;
  const result = new Array(State.len).fill('absent');
  const ans = State.answer.split('');
  const g = guess.split('');
  for (let i = 0; i < State.len; i++) {
    if (g[i] === ans[i]) { result[i] = 'correct'; ans[i] = null; g[i] = null; }
  }
  for (let i = 0; i < State.len; i++) {
    if (g[i] && ans.includes(g[i])) { result[i] = 'present'; ans[ans.indexOf(g[i])] = null; }
  }
  const tiles = State.rows[State.curRow];
  const won = result.every(r => r === 'correct');
  tiles.forEach((t, i) => {
    setTimeout(() => {
      t.classList.add('flip');
      setTimeout(() => {
        t.classList.add(result[i]);
        updateKeyState(guess[i], result[i]);
        if (result[i] === 'absent' && State.excludedLetters.has(guess[i])) {
          State.keyState[guess[i]] = 'excluded';
          t.classList.remove('absent');
          t.classList.add('excluded');
        }
      }, 250);
    }, i * 100);
  });
  const finishedRow = State.curRow;
  const delay = State.len * 100 + 250;
  setTimeout(() => {
    State.evaluating = false;
    if (won) {
      State.gameOver = true;
      State.won = true;
      stopTimer();
      tiles.forEach((t, i) => setTimeout(() => t.classList.add('win'), i * 100));
      saveGameState();
      recordResult(true, finishedRow + 1);
    } else if (finishedRow + 1 >= State.attempts) {
      State.gameOver = true;
      State.won = false;
      stopTimer();
      saveGameState();
      srsAddWord(State.answer);
      recordResult(false);
    } else {
      State.curRow++;
      State.curCol = 0;
      applyHintLockedToBoard();
      for (let c = 0; c < State.len; c++) {
        if (State.hintLocked[c] || State.rows[State.curRow][c].textContent) State.curCol++;
      }
      updateGameInfo();
      saveGameState();
    }
  }, delay);
}

function shakeRow() {
  const row = document.getElementById('board').children[State.curRow];
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 400);
}
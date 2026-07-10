'use strict';

function doStart() {
  if (State.timed === 0 && State.hints === 0) State.hints = 1;
  if (!newGame()) { openSettings(); return; }
  showGame();
}

function bindEvents() {
  document.getElementById('avatarBtn').onclick = openSettings;
  document.getElementById('signinBtn').onclick = doSignin;
  document.getElementById('startBtn').onclick = doStart;
  document.getElementById('tabBook').onclick = showLibrary;
  document.getElementById('tabReview').onclick = showReview;
  document.getElementById('tabStats').onclick = showStats;
  document.getElementById('spClose').onclick = closeSettings;
  document.getElementById('spGo').onclick = () => { closeSettings(); if (newGame()) showGame(); };
  const advToggle = document.getElementById('spAdvToggle');
  if (advToggle) {
    advToggle.onclick = () => {
      const adv = document.getElementById('spAdvanced');
      const open = adv.hasAttribute('hidden');
      if (open) adv.removeAttribute('hidden'); else adv.setAttribute('hidden', '');
      advToggle.classList.toggle('open', open);
      advToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
  }
  document.getElementById('homeBtn').onclick = () => { hideModal(); showHome(); };
  document.getElementById('helpBtn').onclick = showHelp;
  document.getElementById('statsBtn').onclick = showStats;
  document.getElementById('hintBtn').onclick = useHint;
  document.getElementById('excludeBtn').onclick = useExclude;
  document.getElementById('surrenderBtn').onclick = surrender;
  document.getElementById('dictBtn').onclick = showDictLookup;

  const a11yBtn = document.getElementById('a11yBtn');
  if (a11yBtn) {
    a11yBtn.onclick = () => {
      const on = document.body.classList.toggle('hc');
      a11yBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      try { localStorage.setItem(SK + '_hc', on ? '1' : '0'); } catch (e) {}
      toast(on ? '\u9ad8\u5bf9\u6bd4\u6a21\u5f0f\u5df2\u5f00\u542f' : '\u9ad8\u5bf9\u6bd4\u6a21\u5f0f\u5df2\u5173\u95ed');
    };
  }

  document.addEventListener('keydown', e => {
    if (!document.getElementById('game').classList.contains('show')) return;
    if (e.key === 'Enter') handleKey('ENTER');
    else if (e.key === 'Backspace') handleKey('BACKSPACE');
    else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    if (!document.getElementById('game').classList.contains('show') || State.gameOver) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const size = tileSize();
      State.rows.forEach(row => row.forEach(t => {
        t.style.width = size + 'px';
        t.style.height = size + 'px';
        t.style.fontSize = (size * 0.5) + 'px';
      }));
    }, 150);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    if (localStorage.getItem(SK + '_hc') === '1') {
      document.body.classList.add('hc');
      const b = document.getElementById('a11yBtn');
      if (b) b.setAttribute('aria-pressed', 'true');
    }
  } catch (e) {}
  buildDiffTabs();
  updateHomeCounts();
  bindEvents();
  const saved = loadGameSave();
  if (saved && saved.answer && !saved.gameOver) {
    restoreGameState(saved);
    showGame();
    toast('已恢复未完成的对局');
  } else if (saved && saved.gameOver) {
    clearGameSave();
  }
});
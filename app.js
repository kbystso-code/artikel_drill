'use strict';

const DEFAULT_SESSION_SIZE = 20;

// State
let allQuestions = [];
let sessionQuestions = [];
let idx = 0;
let score = 0;
let streak = 0;

// Session-only stats (シンプルに。永続化は後で追加)
let sessionStats = {
  akkAnswered: 0,
  akkCorrect: 0,
  datAnswered: 0,
  datCorrect: 0,
  mistakes: [] // {text, chosen, correct}
};

// DOM
const elProgress = document.getElementById('progress');
const elQuestion = document.getElementById('questionText');
const elFeedback = document.getElementById('feedback');

const elBtnStart = document.getElementById('btnStart');
const elBtnNext = document.getElementById('btnNext');
const elBtnReset = document.getElementById('btnReset');

const elScore = document.getElementById('statScore');
const elStreak = document.getElementById('statStreak');
const elAkk = document.getElementById('statAkk');
const elDat = document.getElementById('statDat');
const elMistakeList = document.getElementById('mistakeList');

const choiceButtons = Array.from(document.querySelectorAll('.choice'));

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setFeedback(type, text) {
  elFeedback.className = 'feedback ' + (type || '');
  elFeedback.textContent = text || '';
}

function resetSessionStats() {
  idx = 0;
  score = 0;
  streak = 0;
  sessionStats = {
    akkAnswered: 0,
    akkCorrect: 0,
    datAnswered: 0,
    datCorrect: 0,
    mistakes: []
  };

  elScore.textContent = `0/${DEFAULT_SESSION_SIZE}`;
  elStreak.textContent = '0';
  elAkk.textContent = '-';
  elDat.textContent = '-';
  renderMistakes();
}

function updateProgress() {
  elProgress.textContent = `${Math.min(idx + 1, sessionQuestions.length)}/${sessionQuestions.length}`;
}

function renderMistakes() {
  elMistakeList.innerHTML = '';
  for (const m of sessionStats.mistakes) {
    const li = document.createElement('li');
    li.textContent = `${m.text}  (du: ${m.chosen} / richtig: ${m.correct})`;
    elMistakeList.appendChild(li);
  }
}

function buildSession(sessionSize) {
  // poolからランダムにsessionSize問選ぶ
  const pool = shuffle(allQuestions);
  sessionQuestions = pool.slice(0, Math.min(sessionSize, pool.length));

  resetSessionStats();
  setFeedback('', '');
  elBtnNext.disabled = true;

  updateProgress();
  renderQuestion();
}

function renderQuestion() {
  if (idx >= sessionQuestions.length) {
    finishSession();
    return;
  }
  const q = sessionQuestions[idx];
  elQuestion.textContent = q.text;
  setFeedback('', '');
  elBtnNext.disabled = true;
  updateProgress();
}

function applyCaseStats(q, isCorrect) {
  if (q.targetCase === 'akk') {
    sessionStats.akkAnswered += 1;
    if (isCorrect) sessionStats.akkCorrect += 1;
  } else if (q.targetCase === 'dat') {
    sessionStats.datAnswered += 1;
    if (isCorrect) sessionStats.datCorrect += 1;
  }
}

function handleChoice(chosen) {
  if (idx >= sessionQuestions.length) return;

  const q = sessionQuestions[idx];
  const correct = q.answer;
  const isCorrect = chosen === correct;

  applyCaseStats(q, isCorrect);

  if (isCorrect) {
    score += 1;
    streak += 1;
    setFeedback('ok', '✅ Richtig');
  } else {
    streak = 0;
    setFeedback('ng', `❌ Tipp: ${q.hint}`);
    sessionStats.mistakes.push({ text: q.text, chosen, correct });
  }

  elBtnNext.disabled = false;
}

function finishSession() {
  elQuestion.textContent = 'Fertig! 👍';
  elBtnNext.disabled = true;

  // Score
  elScore.textContent = `${score}/${sessionQuestions.length}`;
  elStreak.textContent = String(streak);

  // Rates
  const akkRate = sessionStats.akkAnswered
    ? Math.round((sessionStats.akkCorrect / sessionStats.akkAnswered) * 100)
    : null;
  const datRate = sessionStats.datAnswered
    ? Math.round((sessionStats.datCorrect / sessionStats.datAnswered) * 100)
    : null;

  elAkk.textContent = akkRate === null ? '-' : `${akkRate}%`;
  elDat.textContent = datRate === null ? '-' : `${datRate}%`;

  renderMistakes();
  setFeedback('', 'Noch einmal? Start drücken.');
}

// Events
choiceButtons.forEach(btn => {
  btn.addEventListener('click', () => handleChoice(btn.dataset.choice));
});

elBtnStart.addEventListener('click', () => {
  buildSession(DEFAULT_SESSION_SIZE);
});

elBtnNext.addEventListener('click', () => {
  idx += 1;
  renderQuestion();
});

elBtnReset.addEventListener('click', () => {
  // セッションをリセット（データ永続化なしなので簡単）
  sessionQuestions = [];
  resetSessionStats();
  elQuestion.textContent = 'Start drücken';
  setFeedback('', '');
  elProgress.textContent = `0/${DEFAULT_SESSION_SIZE}`;
  elBtnNext.disabled = true;
});

// Init
async function init() {
  try {
    const res = await fetch('questions.json', { cache: 'no-store' });
    const data = await res.json();
    allQuestions = data.questions || [];
  } catch (e) {
    elQuestion.textContent = 'questions.json を読み込めませんでした';
    return;
  }

  // initial UI
  elProgress.textContent = `0/${DEFAULT_SESSION_SIZE}`;
  resetSessionStats();
}
init();

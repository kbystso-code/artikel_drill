'use strict';

const DEFAULT_SESSION_SIZE = 20;
const GENDER_KEY = 'artikel_drill_gender_v1';

const QUESTION_FILES = {
  masc: 'questions_masc.json',
  fem: 'questions_fem.json',
  neut: 'questions_neut.json'
};

// ボタン表示ラベル（定冠詞のみ）
const CHOICE_LABELS = {
  masc: { nom: 'der', akk: 'den', dat: 'dem' },
  fem:  { nom: 'die', akk: 'die', dat: 'der' },
  neut: { nom: 'das', akk: 'das', dat: 'dem' }
};

// State
let allQuestions = [];
let sessionQuestions = [];
let idx = 0;
let score = 0;
let streak = 0;
let currentGender = 'masc';

// Session-only stats
let sessionStats = {
  akkAnswered: 0,
  akkCorrect: 0,
  datAnswered: 0,
  datCorrect: 0,
  mistakes: []
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
const elChoice1 = document.getElementById('btnChoice1');
const elChoice2 = document.getElementById('btnChoice2');
const elChoice3 = document.getElementById('btnChoice3');

// Gender buttons（index.htmlに追加済み前提）
const elBtnMasc = document.getElementById('btnMasc');
const elBtnFem  = document.getElementById('btnFem');
const elBtnNeut = document.getElementById('btnNeut');

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
    li.textContent = `${m.text}  (du: ${m.chosenLabel} / richtig: ${m.correctLabel})`;
    elMistakeList.appendChild(li);
  }
}

function setActiveGenderButton() {
  [elBtnMasc, elBtnFem, elBtnNeut].forEach(b => b.classList.remove('active'));
  if (currentGender === 'masc') elBtnMasc.classList.add('active');
  if (currentGender === 'fem') elBtnFem.classList.add('active');
  if (currentGender === 'neut') elBtnNeut.classList.add('active');
}

function applyChoiceLabels() {
  const labels = CHOICE_LABELS[currentGender] || CHOICE_LABELS.masc;
  elChoice1.textContent = labels.nom;
  elChoice2.textContent = labels.akk;
  elChoice3.textContent = labels.dat;
}

function labelOf(choiceKey) {
  const labels = CHOICE_LABELS[currentGender] || CHOICE_LABELS.masc;
  return labels[choiceKey] || choiceKey;
}

async function loadQuestionsForGender(gender) {
  const file = QUESTION_FILES[gender] || QUESTION_FILES.masc;
  const res = await fetch(file, { cache: 'no-store' });
  const data = await res.json();
  allQuestions = data.questions || [];
}

function buildSession(sessionSize) {
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

function handleChoice(choiceKey) {
  if (idx >= sessionQuestions.length) return;

  const q = sessionQuestions[idx];
  const correctKey = q.answer; // "nom" | "akk" | "dat"
  const isCorrect = choiceKey === correctKey;

  applyCaseStats(q, isCorrect);

  const chosenLabel = labelOf(choiceKey);
  const correctLabel = labelOf(correctKey);

  if (isCorrect) {
    score += 1;
    streak += 1;
    setFeedback('ok', `✅ Richtig (${correctLabel})`);
  } else {
  streak = 0;
  setFeedback('ng', `❌ Tipp: ${q.hint}  |  Richtig: ${correctLabel}`);
  sessionStats.mistakes.push({
    text: q.text,
    chosenLabel,
    correctLabel
  });
}


  elBtnNext.disabled = false;
}

function finishSession() {
  elQuestion.textContent = 'Fertig! 👍';
  elBtnNext.disabled = true;

  elScore.textContent = `${score}/${sessionQuestions.length}`;
  elStreak.textContent = String(streak);

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

// Gender switching
async function changeGender(gender) {
  currentGender = gender;
  localStorage.setItem(GENDER_KEY, currentGender);

  setActiveGenderButton();
  applyChoiceLabels();

  // セッションをリセット
  sessionQuestions = [];
  resetSessionStats();
  elQuestion.textContent = 'Start drücken';
  setFeedback('', '');
  elProgress.textContent = `0/${DEFAULT_SESSION_SIZE}`;
  elBtnNext.disabled = true;

  try {
    await loadQuestionsForGender(currentGender);
  } catch (e) {
    elQuestion.textContent = `${QUESTION_FILES[currentGender]} を読み込めませんでした`;
  }
}

// Events
choiceButtons.forEach(btn => {
  btn.addEventListener('click', () => handleChoice(btn.dataset.choice)); // nom/akk/dat
});

elBtnStart.addEventListener('click', () => {
  if (!allQuestions.length) {
    setFeedback('ng', 'Keine Fragen geladen.');
    return;
  }
  buildSession(DEFAULT_SESSION_SIZE);
});

elBtnNext.addEventListener('click', () => {
  idx += 1;
  renderQuestion();
});

elBtnReset.addEventListener('click', () => {
  sessionQuestions = [];
  resetSessionStats();
  elQuestion.textContent = 'Start drücken';
  setFeedback('', '');
  elProgress.textContent = `0/${DEFAULT_SESSION_SIZE}`;
  elBtnNext.disabled = true;
});

elBtnMasc.addEventListener('click', () => changeGender('masc'));
elBtnFem.addEventListener('click', () => changeGender('fem'));
elBtnNeut.addEventListener('click', () => changeGender('neut'));

// Init
async function init() {
  const saved = localStorage.getItem(GENDER_KEY);
  if (saved && QUESTION_FILES[saved]) currentGender = saved;

  setActiveGenderButton();
  applyChoiceLabels();

  try {
    await loadQuestionsForGender(currentGender);
  } catch (e) {
    elQuestion.textContent = `${QUESTION_FILES[currentGender]} を読み込めませんでした`;
    return;
  }

  elProgress.textContent = `0/${DEFAULT_SESSION_SIZE}`;
  resetSessionStats();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

init();

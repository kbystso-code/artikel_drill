'use strict';

const DEFAULT_SESSION_SIZE = 20;
const GENDER_KEY = 'artikel_drill_gender_v1';
const KIDS_APP_PROGRESS_KEY = 'kids-app-study-progress-v1';
const KIDS_APP_APP_ID = 'artikel';

const QUESTION_FILES = {
  masc: 'questions_masc.json',
  fem: 'questions_fem.json',
  neut: 'questions_neut.json',
  mix: null
};

// ボタン表示ラベル（定冠詞のみ）
const CHOICE_LABELS = {
  masc: { nom: 'der (Nom)', akk: 'den (Akk)', dat: 'dem (Dat)' },
  fem:  { nom: 'die (Nom)', akk: 'die (Akk)', dat: 'der (Dat)' },
  neut: { nom: 'das (Nom)', akk: 'das (Akk)', dat: 'dem (Dat)' }
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
const elBtnMix = document.getElementById('btnMix');

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
  reportKidsAppProgress(score);
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
  [elBtnMasc, elBtnFem, elBtnNeut, elBtnMix]
    .filter(Boolean)
    .forEach(b => b.classList.remove('active'));

  if (currentGender === 'masc' && elBtnMasc) elBtnMasc.classList.add('active');
  if (currentGender === 'fem' && elBtnFem) elBtnFem.classList.add('active');
  if (currentGender === 'neut' && elBtnNeut) elBtnNeut.classList.add('active');
  if (currentGender === 'mix' && elBtnMix) elBtnMix.classList.add('active');
}

function applyChoiceLabels(gender = currentGender) {
  const labels = CHOICE_LABELS[gender] || CHOICE_LABELS.masc;
  elChoice1.textContent = labels.nom;
  elChoice2.textContent = labels.akk;
  elChoice3.textContent = labels.dat;
}

function labelOf(choiceKey, gender = currentGender) {
  const labels = CHOICE_LABELS[gender] || CHOICE_LABELS.masc;
  return labels[choiceKey] || choiceKey;
}

async function loadQuestionsForGender(gender) {
  if (gender === 'mix') {
    const files = [
      QUESTION_FILES.masc,
      QUESTION_FILES.fem,
      QUESTION_FILES.neut
    ];

    const results = await Promise.all(
      files.map(file => fetch(file, { cache: 'no-store' }).then(res => res.json()))
    );

    allQuestions = results.flatMap(data => data.questions || []);
    return;
  }

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

  // ★ Mixでは問題ごとのgenderで表示切替
  const effectiveGender = q.gender || currentGender;
  applyChoiceLabels(effectiveGender);

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

  const effectiveGender = q.gender || currentGender;
  const chosenLabel = labelOf(choiceKey, effectiveGender);
  const correctLabel = labelOf(correctKey, effectiveGender);

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
  reportKidsAppProgress(score);
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
  reportKidsAppProgress(score);
}

function getKidsAppTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reportKidsAppProgress(correctCount) {
  try {
    const today = getKidsAppTodayKey();
    const raw = JSON.parse(localStorage.getItem(KIDS_APP_PROGRESS_KEY) || '{}');
    raw[today] ??= {};

    const prev = Number(raw[today][KIDS_APP_APP_ID]?.correct) || 0;
    raw[today][KIDS_APP_APP_ID] = {
      correct: Math.max(prev, Math.max(0, Math.floor(Number(correctCount) || 0))),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(KIDS_APP_PROGRESS_KEY, JSON.stringify(raw));
  } catch {}
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
if (elBtnMix) {
  elBtnMix.addEventListener('click', () => changeGender('mix'));
}

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

async function cleanupServiceWorkerCaches() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (e) {
    console.warn('Service worker unregister failed:', e);
  }

  if (!('caches' in window)) return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (e) {
    console.warn('Cache cleanup failed:', e);
  }
}

cleanupServiceWorkerCaches().finally(init);

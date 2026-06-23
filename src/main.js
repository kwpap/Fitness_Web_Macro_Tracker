import './style.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { parseLog } from './utils/parser';
import ApexCharts from 'apexcharts';

// --- State ---
let currentUser = null;
let macroChart = null;
let calWeightChart = null;
let proteinMuscleChart = null;
let compositionChart = null;
let userSettings = {
  avgKcalTarget: 2500,
  suggestedKcalTarget: 2000,
  proteinFloor: 150,
  carbsCeiling: 20
};

// --- DOM Elements ---
const authScreen = document.getElementById('auth-screen');
const dashboardShell = document.getElementById('dashboard-shell');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');
const authError = document.getElementById('auth-error');

const rawLogInput = document.getElementById('raw-log-input');
const parseLogBtn = document.getElementById('parse-log-btn');
const parserModal = document.getElementById('parser-modal');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const confirmCommitBtn = document.getElementById('confirm-commit-btn');

const modalDate = document.getElementById('modal-date');
const modalDayId = document.getElementById('modal-day-id');
const modalCalories = document.getElementById('modal-calories');
const modalProtein = document.getElementById('modal-protein');
const modalFat = document.getElementById('modal-fat');
const modalNetCarbs = document.getElementById('modal-net-carbs');
const modalFiber = document.getElementById('modal-fiber');
const modalFoods = document.getElementById('modal-foods');

const dietologistModal = document.getElementById('dietologist-modal');
const openDietologistBtn = document.getElementById('open-dietologist-btn');
const closeDietologistBtn = document.getElementById('close-dietologist-btn');
const dietologistForm = document.getElementById('dietologist-form');

const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsForm = document.getElementById('settings-form');

const snapshotContent = document.getElementById('snapshot-content');

// --- Auth Logic ---
if (auth) {
  setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      userDisplay.textContent = user.email.split('@')[0];
      authScreen.classList.add('hidden');
      dashboardShell.classList.remove('hidden');
      initCharts();
      loadUserSettings();
      loadLogs();
    } else {
      currentUser = null;
      authScreen.classList.remove('hidden');
      dashboardShell.classList.add('hidden');
    }
  });
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    authError.textContent = '';
  } catch (error) {
    authError.textContent = 'Invalid credentials.';
    console.error(error);
  }
});

logoutBtn?.addEventListener('click', () => signOut(auth));

// --- Settings Logic ---
settingsBtn?.addEventListener('click', () => {
  document.getElementById('setting-avg-kcal').value = userSettings.avgKcalTarget;
  document.getElementById('setting-suggested-kcal').value = userSettings.suggestedKcalTarget;
  document.getElementById('setting-protein-floor').value = userSettings.proteinFloor;
  document.getElementById('setting-carbs-ceiling').value = userSettings.carbsCeiling;
  settingsModal.classList.remove('hidden');
});

closeSettingsBtn?.addEventListener('click', () => settingsModal.classList.add('hidden'));

settingsForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newSettings = {
    avgKcalTarget: parseInt(document.getElementById('setting-avg-kcal').value),
    suggestedKcalTarget: parseInt(document.getElementById('setting-suggested-kcal').value),
    proteinFloor: parseInt(document.getElementById('setting-protein-floor').value),
    carbsCeiling: parseInt(document.getElementById('setting-carbs-ceiling').value)
  };

  try {
    await setDoc(doc(db, 'user_settings', currentUser.uid), newSettings);
    userSettings = newSettings;
    settingsModal.classList.add('hidden');
    // Refresh UI/Charts
    loadLogs(); 
  } catch (err) {
    console.error("Error saving settings:", err);
  }
});

async function loadUserSettings() {
  const docRef = doc(db, 'user_settings', currentUser.uid);
  onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      userSettings = docSnap.data();
    }
  });
}

// --- Parser Logic ---
parseLogBtn?.addEventListener('click', () => {
  const text = rawLogInput.value;
  if (!text.trim()) return;
  const parsed = parseLog(text);
  
  if (parsed.date) {
    modalDate.value = parsed.date.toISOString().split('T')[0];
  } else {
    modalDate.value = new Date().toISOString().split('T')[0];
  }
  
  modalDayId.value = parsed.dayId;
  modalCalories.value = parsed.calories;
  modalProtein.value = parsed.protein;
  modalFat.value = parsed.fat;
  modalNetCarbs.value = parsed.netCarbs;
  modalFiber.value = parsed.fiber;
  modalFoods.value = parsed.foodsTracked;
  
  parserModal.classList.remove('hidden');
});

cancelModalBtn?.addEventListener('click', () => parserModal.classList.add('hidden'));

confirmCommitBtn?.addEventListener('click', async () => {
  const selectedDate = new Date(modalDate.value);
  const logData = {
    dayId: modalDayId.value,
    date: selectedDate,
    calories: parseInt(modalCalories.value) || 0,
    protein: parseFloat(modalProtein.value) || 0,
    fat: parseFloat(modalFat.value) || 0,
    netCarbs: parseFloat(modalNetCarbs.value) || 0,
    fiber: parseFloat(modalFiber.value) || 0,
    foodsTracked: modalFoods.value,
    timestamp: serverTimestamp(),
    userId: currentUser.uid
  };

  try {
    const docId = `log_${selectedDate.toISOString().split('T')[0]}`;
    await setDoc(doc(db, 'daily_logs', docId), logData);
    parserModal.classList.add('hidden');
    rawLogInput.value = '';
  } catch (err) {
    console.error("Error adding log:", err);
    alert("Failed to save log.");
  }
});

// --- Dietologist Logic ---
openDietologistBtn?.addEventListener('click', () => {
  document.getElementById('diet-date').value = new Date().toISOString().split('T')[0];
  dietologistModal.classList.remove('hidden');
});
closeDietologistBtn?.addEventListener('click', () => dietologistModal.classList.add('hidden'));

dietologistForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectedDate = new Date(document.getElementById('diet-date').value);
  const dData = {
    date: selectedDate,
    weight: parseFloat(document.getElementById('weight').value),
    leanMuscle: parseFloat(document.getElementById('lean-muscle').value),
    totalMuscle: parseFloat(document.getElementById('total-muscle').value),
    fatMass: parseFloat(document.getElementById('fat-mass').value),
    fatPercent: parseFloat(document.getElementById('fat-percent').value),
    bmr: parseInt(document.getElementById('bmr').value),
    timestamp: serverTimestamp(),
    userId: currentUser.uid
  };

  try {
    const docId = `d_${selectedDate.toISOString().split('T')[0]}`;
    await setDoc(doc(db, 'dietologist_logs', docId), dData);
    dietologistModal.classList.add('hidden');
    dietologistForm.reset();
  } catch (err) {
    console.error("Error saving dietologist metrics:", err);
  }
});

// --- Charts & Data Logic ---
function initCharts() {
  const chartCommon = {
    chart: { height: 350, toolbar: { show: true }, background: 'transparent' },
    theme: { mode: 'dark' },
    xaxis: { type: 'datetime' },
    grid: { borderColor: '#374151' },
    legend: { position: 'top', onItemClick: { toggleDataSeries: true } }
  };

  if (macroChart) macroChart.destroy();
  macroChart = new ApexCharts(document.querySelector("#macro-chart"), {
    ...chartCommon,
    chart: { ...chartCommon.chart, type: 'line' },
    series: [],
    yaxis: [
      { title: { text: "Calories (kcal)", style: { color: '#818cf8' } } },
      { opposite: true, title: { text: "Macros (g)", style: { color: '#34d399' } } }
    ],
    colors: ['#818cf8', '#34d399', '#fbbf24', '#f87171'],
    stroke: { width: [3, 2, 2, 2], curve: 'smooth' }
  });
  macroChart.render();

  if (calWeightChart) calWeightChart.destroy();
  calWeightChart = new ApexCharts(document.querySelector("#cal-weight-chart"), {
    ...chartCommon,
    chart: { ...chartCommon.chart, type: 'line' },
    series: [],
    yaxis: [
      { title: { text: "Calories (kcal)", style: { color: '#818cf8' } } },
      { opposite: true, title: { text: "Weight (kg)", style: { color: '#60a5fa' } } }
    ],
    colors: ['#818cf8', '#60a5fa'],
    annotations: {
      yaxis: [
        { y: 2500, borderColor: '#ef4444', label: { text: 'Avg Target', style: { color: '#fff', background: '#ef4444' } } },
        { y: 2000, borderColor: '#10b981', label: { text: 'Nutritionist', style: { color: '#fff', background: '#10b981' } } }
      ]
    }
  });
  calWeightChart.render();

  if (proteinMuscleChart) proteinMuscleChart.destroy();
  proteinMuscleChart = new ApexCharts(document.querySelector("#protein-muscle-chart"), {
    ...chartCommon,
    chart: { ...chartCommon.chart, type: 'area' },
    series: [],
    yaxis: [
      { title: { text: "Protein (g)", style: { color: '#34d399' } } },
      { opposite: true, title: { text: "Lean Muscle (kg)", style: { color: '#a78bfa' } } }
    ],
    colors: ['#34d399', '#a78bfa'],
    annotations: {
      yaxis: [{ y: 150, borderColor: '#f59e0b', label: { text: 'Min Protein', style: { color: '#fff', background: '#f59e0b' } } }]
    }
  });
  proteinMuscleChart.render();

  if (compositionChart) compositionChart.destroy();
  compositionChart = new ApexCharts(document.querySelector("#composition-chart"), {
    ...chartCommon,
    chart: { ...chartCommon.chart, type: 'line' },
    series: [],
    yaxis: [
      { title: { text: "Mass (kg)", style: { color: '#9ca3af' } } },
      { opposite: true, title: { text: "Fat %", style: { color: '#fb7185' } } }
    ],
    colors: ['#60a5fa', '#a78bfa', '#fb7185'],
    stroke: { width: [2, 2, 3] }
  });
  compositionChart.render();
}

function loadLogs() {
  // Sync state for logs
  const logsRef = collection(db, 'daily_logs');
  const dLogsRef = collection(db, 'dietologist_logs');

  const qLogs = query(logsRef, orderBy('date', 'asc'));
  const qDLogs = query(dLogsRef, orderBy('date', 'asc'));

  onSnapshot(qLogs, (snapLogs) => {
    const logs = snapLogs.docs.map(d => d.data()).filter(l => l.userId === currentUser.uid);
    onSnapshot(qDLogs, (snapDLogs) => {
      const dLogs = snapDLogs.docs.map(d => d.data()).filter(l => l.userId === currentUser.uid);
      updateAllVisuals(logs, dLogs);
    });
  });
}

function updateAllVisuals(logs, dLogs) {
  updateMacroChart(logs);
  updateCalWeightChart(logs, dLogs);
  updateProteinMuscleChart(logs, dLogs);
  updateCompChart(dLogs);
  updateSnapshot(logs);
}

function updateMacroChart(logs) {
  if (!macroChart) return;
  macroChart.updateSeries([
    { name: 'Kcal', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.calories })) },
    { name: 'Protein', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.protein })) },
    { name: 'Net Carbs', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.netCarbs })) },
    { name: 'Fat', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.fat })) }
  ]);
}

function updateCalWeightChart(logs, dLogs) {
  if (!calWeightChart) return;
  const calData = logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.calories }));
  const weightData = dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.weight }));
  
  calWeightChart.updateOptions({
    annotations: {
      yaxis: [
        { y: userSettings.avgKcalTarget, borderColor: '#ef4444', label: { text: `Target ${userSettings.avgKcalTarget}`, style: { color: '#fff', background: '#ef4444' } } },
        { y: userSettings.suggestedKcalTarget, borderColor: '#10b981', label: { text: `Suggested ${userSettings.suggestedKcalTarget}`, style: { color: '#fff', background: '#10b981' } } }
      ]
    }
  });
  calWeightChart.updateSeries([
    { name: 'Calories', data: calData },
    { name: 'Weight', data: weightData }
  ]);
}

function updateProteinMuscleChart(logs, dLogs) {
  if (!proteinMuscleChart) return;
  const proteinData = logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.protein }));
  const muscleData = dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.leanMuscle }));

  proteinMuscleChart.updateOptions({
    annotations: {
      yaxis: [{ y: userSettings.proteinFloor, borderColor: '#f59e0b', label: { text: `Floor ${userSettings.proteinFloor}g`, style: { color: '#fff', background: '#f59e0b' } } }]
    }
  });
  proteinMuscleChart.updateSeries([
    { name: 'Protein (g)', data: proteinData },
    { name: 'Lean Muscle (kg)', data: muscleData }
  ]);
}

function updateCompChart(dLogs) {
  if (!compositionChart) return;
  compositionChart.updateSeries([
    { name: 'Weight', data: dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.weight })) },
    { name: 'Muscle', data: dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.totalMuscle })) },
    { name: 'Body Fat %', data: dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.fatPercent })) }
  ]);
}

function updateSnapshot(logs) {
  if (logs.length === 0) return;
  const last = logs[logs.length - 1];
  
  const proteinOk = last.protein >= userSettings.proteinFloor;
  const carbsOk = last.netCarbs <= userSettings.carbsCeiling;

  if (snapshotContent) {
    snapshotContent.innerHTML = `
      <div class="flex justify-between items-center py-2 border-b border-slate-800">
        <span class="text-slate-400 font-medium">Calories</span>
        <span class="text-xl font-bold text-indigo-400">${last.calories} <small class="text-slate-500 font-normal">kcal</small></span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-slate-800">
        <span class="text-slate-400 font-medium">Protein</span>
        <span class="font-bold ${proteinOk ? 'text-emerald-400' : 'text-amber-500'}">${last.protein}g / ${userSettings.proteinFloor}g</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-slate-800">
        <span class="text-slate-400 font-medium">Net Carbs</span>
        <span class="font-bold ${carbsOk ? 'text-emerald-400' : 'text-rose-500'}">${last.netCarbs}g / ${userSettings.carbsCeiling}g</span>
      </div>
      <div class="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400">
        <div class="font-bold mb-1 uppercase tracking-widest text-[10px] text-slate-500">Last Meal Log</div>
        ${last.foodsTracked || 'No foods listed'}
      </div>
    `;
  }
}

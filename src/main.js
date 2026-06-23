import './style.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { parseLog } from './utils/parser';
import ApexCharts from 'apexcharts';

// --- State ---
let currentUser = null;
let macroChart = null;
let compositionChart = null;

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
  if (macroChart) macroChart.destroy();
  if (compositionChart) compositionChart.destroy();

  const macroOptions = {
    chart: { 
      type: 'area', 
      height: 350, 
      toolbar: { show: true }, 
      zoom: { enabled: true },
      background: 'transparent'
    },
    theme: { mode: 'dark' },
    series: [],
    xaxis: { type: 'datetime' },
    stroke: { curve: 'smooth', width: 2 },
    colors: ['#818cf8', '#34d399', '#fbbf24', '#f87171'],
    legend: { 
      position: 'top',
      horizontalAlign: 'center',
      onItemClick: { toggleDataSeries: true }
    },
    grid: { borderColor: '#374151' }
  };
  macroChart = new ApexCharts(document.querySelector("#macro-chart"), macroOptions);
  macroChart.render();

  const compOptions = {
    chart: { 
      type: 'line', 
      height: 350, 
      toolbar: { show: true },
      background: 'transparent'
    },
    theme: { mode: 'dark' },
    series: [],
    xaxis: { type: 'datetime' },
    yaxis: [
      { title: { text: "Weight / Muscle (kg)", style: { color: '#9ca3af' } } },
      { opposite: true, title: { text: "Body Fat %", style: { color: '#9ca3af' } } }
    ],
    stroke: { curve: 'smooth', width: [3, 3, 2] },
    colors: ['#60a5fa', '#a78bfa', '#fb7185'],
    grid: { borderColor: '#374151' }
  };
  compositionChart = new ApexCharts(document.querySelector("#composition-chart"), compOptions);
  compositionChart.render();
}

function loadLogs() {
  const qLogs = query(collection(db, 'daily_logs'), orderBy('date', 'asc'));
  onSnapshot(qLogs, (snapshot) => {
    const logs = snapshot.docs.map(doc => doc.data());
    updateMacroChart(logs.filter(l => l.userId === currentUser.uid));
    updateSnapshot(logs.filter(l => l.userId === currentUser.uid));
  });

  const qDiet = query(collection(db, 'dietologist_logs'), orderBy('date', 'asc'));
  onSnapshot(qDiet, (snapshot) => {
    const dLogs = snapshot.docs.map(doc => doc.data());
    updateCompChart(dLogs.filter(l => l.userId === currentUser.uid));
  });
}

function updateMacroChart(logs) {
  if (!macroChart) return;
  const series = [
    { name: 'Kcal', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.calories })) },
    { name: 'Protein', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.protein })) },
    { name: 'Net Carbs', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.netCarbs })) },
    { name: 'Fat', data: logs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.fat })) }
  ];
  macroChart.updateSeries(series);
}

function updateCompChart(dLogs) {
  if (!compositionChart) return;
  const series = [
    { name: 'Weight', type: 'line', data: dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.weight })) },
    { name: 'Lean Muscle', type: 'line', data: dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.leanMuscle })) },
    { name: 'Body Fat %', type: 'area', data: dLogs.map(l => ({ x: l.date?.toDate() || new Date(), y: l.fatPercent })) }
  ];
  compositionChart.updateSeries(series);
}

function updateSnapshot(logs) {
  if (logs.length === 0) return;
  const last = logs[logs.length - 1];
  const proteinGoal = 150;
  const carbsGoal = 20;
  
  const proteinOk = last.protein >= proteinGoal;
  const carbsOk = last.netCarbs <= carbsGoal;

  if (snapshotContent) {
    snapshotContent.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="text-gray-500 font-medium">Calories</span>
        <span class="text-xl font-bold">${last.calories} <small class="text-gray-400 font-normal">kcal</small></span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-gray-500 font-medium">Protein</span>
        <span class="font-bold ${proteinOk ? 'text-green-600' : 'text-orange-500'}">${last.protein}g / ${proteinGoal}g</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-gray-500 font-medium">Net Carbs</span>
        <span class="font-bold ${carbsOk ? 'text-green-600' : 'text-red-500'}">${last.netCarbs}g / ${carbsGoal}g</span>
      </div>
      <div class="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-400 truncate">
        ${last.foodsTracked || 'No foods listed'}
      </div>
    `;
  }
}

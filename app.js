// ===== State =====
const DEFAULT_GOAL = 100;
const STORAGE_KEY = 'momtodo_v1';

let state = {
  tasks: [],
  settings: {
    goal: DEFAULT_GOAL,
    momName: 'Mama',
    bonusMessage: 'Treat yourself to something special today! 🎁'
  },
  today: todayStr(),
  bonusEarnedToday: false,
  carriedBonus: null  // bonus message from yesterday if earned
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ===== Persistence =====
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    // Check if it's a new day
    if (saved.today !== todayStr()) {
      // Carry over bonus if earned yesterday
      state.settings = saved.settings || state.settings;
      state.tasks = (saved.tasks || []).map(t => ({ ...t, done: false }));
      state.bonusEarnedToday = false;
      state.today = todayStr();
      state.carriedBonus = saved.bonusEarnedToday
        ? (saved.settings?.bonusMessage || state.settings.bonusMessage)
        : null;
    } else {
      state = { ...state, ...saved };
    }
  } catch (e) {
    console.error('Load error', e);
  }
}

// ===== DOM refs =====
const $taskList       = document.getElementById('taskList');
const $completedList  = document.getElementById('completedList');
const $emptyState     = document.getElementById('emptyState');
const $completedCount = document.getElementById('completedCount');
const $completedToggle= document.getElementById('completedToggle');
const $completedChevron = document.getElementById('completedChevron');
const $completedSection = document.getElementById('completedSection');
const $currentPoints  = document.getElementById('currentPoints');
const $goalPoints     = document.getElementById('goalPoints');
const $progressBar    = document.getElementById('progressBar');
const $progressPct    = document.getElementById('progressPct');
const $bonusBadge     = document.getElementById('bonusBadge');
const $bonusBanner    = document.getElementById('bonusBanner');
const $bonusText      = document.getElementById('bonusText');
const $closeBanner    = document.getElementById('closeBanner');
const $carriedBonus   = document.getElementById('carriedBonus');
const $carriedBonusText = document.getElementById('carriedBonusText');
const $dismissBonus   = document.getElementById('dismissBonus');
const $dateLabel      = document.getElementById('dateLabel');
const $addTaskBtn     = document.getElementById('addTaskBtn');
const $settingsBtn    = document.getElementById('settingsBtn');
const $taskModal      = document.getElementById('taskModal');
const $settingsModal  = document.getElementById('settingsModal');
const $taskName       = document.getElementById('taskName');
const $customPts      = document.getElementById('customPts');
const $cancelTask     = document.getElementById('cancelTask');
const $saveTask       = document.getElementById('saveTask');
const $deleteTask     = document.getElementById('deleteTask');
const $cancelSettings = document.getElementById('cancelSettings');
const $saveSettings   = document.getElementById('saveSettings');
const $goalInput      = document.getElementById('goalInput');
const $bonusMessageInput = document.getElementById('bonusMessageInput');
const $momNameInput   = document.getElementById('momNameInput');
const $resetDayBtn    = document.getElementById('resetDayBtn');
const $confettiCanvas = document.getElementById('confettiCanvas');

let editingTaskId = null;
let selectedPts   = 10;
let selectedCat   = 'general';
let selectedEmoji = '✅';
let completedOpen = false;

// ===== Utilities =====
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function earned() {
  return state.tasks.filter(t => t.done).reduce((s, t) => s + t.pts, 0);
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ===== Render =====
function render() {
  renderProgress();
  renderTasks();
  renderCarriedBonus();
}

function renderProgress() {
  const pts = earned();
  const goal = state.settings.goal;
  const pct = Math.min(100, Math.round((pts / goal) * 100));

  $currentPoints.textContent = pts;
  $goalPoints.textContent    = goal;
  $progressBar.style.width   = pct + '%';
  $progressPct.textContent   = pct + '%';

  const justReached = pts >= goal && !state.bonusEarnedToday;
  const alreadyReached = pts >= goal;

  if (alreadyReached) {
    $bonusBadge.classList.remove('hidden');
  } else {
    $bonusBadge.classList.add('hidden');
  }

  if (justReached) {
    state.bonusEarnedToday = true;
    save();
    showBonusBanner();
    launchConfetti();
  }
}

function renderTasks() {
  const active    = state.tasks.filter(t => !t.done);
  const completed = state.tasks.filter(t => t.done);

  // Empty state
  if (state.tasks.length === 0) {
    $emptyState.classList.remove('hidden');
    $taskList.innerHTML = '';
  } else {
    $emptyState.classList.add('hidden');
    $taskList.innerHTML = active.map(taskHTML).join('');
  }

  $completedList.innerHTML = completed.map(taskHTML).join('');
  $completedCount.textContent = completed.length;

  // Show/hide completed section list
  if (completedOpen) {
    $completedList.style.display = 'block';
    $completedChevron.classList.add('open');
  } else {
    $completedList.style.display = 'none';
    $completedChevron.classList.remove('open');
  }
}

function taskHTML(task) {
  return `
    <div class="task-item${task.done ? ' done' : ''}" data-id="${task.id}" role="button" tabindex="0" aria-label="${task.name}">
      <div class="task-check">${task.done ? '✓' : ''}</div>
      <span class="task-emoji">${task.emoji}</span>
      <div class="task-body">
        <div class="task-name">${escHtml(task.name)}</div>
        <div class="task-cat">${task.cat}</div>
      </div>
      <span class="task-pts">${task.pts} pts</span>
      <button class="task-edit-btn" data-id="${task.id}" aria-label="Edit task">✏️</button>
    </div>`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCarriedBonus() {
  if (state.carriedBonus) {
    $carriedBonus.classList.remove('hidden');
    $carriedBonusText.textContent = state.carriedBonus;
  } else {
    $carriedBonus.classList.add('hidden');
  }
}

// ===== Task Toggle =====
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;

  // Animate check
  const el = document.querySelector(`.task-item[data-id="${id}"]`);
  if (el && task.done) {
    el.classList.add('completing');
    setTimeout(() => el.classList.remove('completing'), 400);
  }

  save();
  render();
}

// ===== Task Modal =====
function openAddModal() {
  editingTaskId = null;
  $taskName.value = '';
  $customPts.value = '';
  selectedPts = 10;
  selectedCat = 'general';
  selectedEmoji = '✅';
  document.getElementById('modalTitle').textContent = 'New Task';
  $deleteTask.classList.add('hidden');
  syncPickerUI();
  $taskModal.classList.remove('hidden');
  setTimeout(() => $taskName.focus(), 300);
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  $taskName.value = task.name;
  selectedPts     = task.pts;
  selectedCat     = task.cat;
  selectedEmoji   = task.emoji;
  $customPts.value = '';
  document.getElementById('modalTitle').textContent = 'Edit Task';
  $deleteTask.classList.remove('hidden');
  syncPickerUI();
  $taskModal.classList.remove('hidden');
}

function closeTaskModal() {
  $taskModal.classList.add('hidden');
}

function syncPickerUI() {
  // Points buttons
  document.querySelectorAll('.pts-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.pts) === selectedPts);
  });
  // Category buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === selectedCat);
  });
  // Emoji buttons
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.emoji === selectedEmoji);
  });
}

function saveTask() {
  const name = $taskName.value.trim();
  if (!name) { $taskName.focus(); shake($taskName); return; }

  const customVal = parseInt($customPts.value);
  const pts = (!isNaN(customVal) && customVal > 0) ? customVal : selectedPts;

  if (editingTaskId) {
    const task = state.tasks.find(t => t.id === editingTaskId);
    if (task) {
      task.name  = name;
      task.pts   = pts;
      task.cat   = selectedCat;
      task.emoji = selectedEmoji;
    }
  } else {
    state.tasks.push({ id: uid(), name, pts, cat: selectedCat, emoji: selectedEmoji, done: false });
  }

  save();
  render();
  closeTaskModal();
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  render();
  closeTaskModal();
}

function shake(el) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

// ===== Settings Modal =====
function openSettings() {
  $goalInput.value         = state.settings.goal;
  $bonusMessageInput.value = state.settings.bonusMessage;
  $momNameInput.value      = state.settings.momName;
  $settingsModal.classList.remove('hidden');
}

function closeSettings() {
  $settingsModal.classList.add('hidden');
}

function saveSettings() {
  const goal = parseInt($goalInput.value);
  if (!isNaN(goal) && goal >= 1) state.settings.goal = goal;
  const msg = $bonusMessageInput.value.trim();
  if (msg) state.settings.bonusMessage = msg;
  const name = $momNameInput.value.trim();
  if (name) state.settings.momName = name;
  save();
  render();
  closeSettings();
}

// ===== Bonus Banner =====
function showBonusBanner() {
  $bonusText.textContent = state.settings.bonusMessage;
  $bonusBanner.classList.remove('hidden');
}

$closeBanner.addEventListener('click', () => $bonusBanner.classList.add('hidden'));
$dismissBonus.addEventListener('click', () => {
  state.carriedBonus = null;
  save();
  $carriedBonus.classList.add('hidden');
});

// ===== Date label =====
function renderDate() {
  $dateLabel.textContent = formatDate(new Date());
}

// ===== Confetti =====
function launchConfetti() {
  const canvas = $confettiCanvas;
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 8 + 4,
    d: Math.random() * 8 + 2,
    color: ['#c084fc','#f9a8d4','#fbbf24','#34d399','#60a5fa','#f97316'][Math.floor(Math.random()*6)],
    tilt: Math.random() * 10 - 5,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.07 + 0.05
  }));

  let frames = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r * 1.5);
      ctx.stroke();
    });
    update();
    frames++;
    if (frames < 200) requestAnimationFrame(draw);
    else { canvas.style.display = 'none'; }
  }

  function update() {
    pieces.forEach(p => {
      p.tiltAngle += p.tiltSpeed;
      p.y += (Math.cos(p.d) + 1.5 + p.r / 9);
      p.x += Math.sin(frames * 0.01) * 1.5;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      if (p.y > canvas.height) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
    });
  }

  draw();
}

// ===== Event Delegation for task list =====
function setupTaskEvents(container) {
  container.addEventListener('click', e => {
    const item    = e.target.closest('.task-item');
    const editBtn = e.target.closest('.task-edit-btn');
    if (editBtn) {
      e.stopPropagation();
      openEditModal(editBtn.dataset.id);
    } else if (item) {
      toggleTask(item.dataset.id);
    }
  });
  container.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.task-item');
      if (item) { e.preventDefault(); toggleTask(item.dataset.id); }
    }
  });
}

// ===== Reset Day =====
$resetDayBtn.addEventListener('click', () => {
  if (!confirm('Reset all tasks for today? This cannot be undone.')) return;
  state.tasks = state.tasks.map(t => ({ ...t, done: false }));
  state.bonusEarnedToday = false;
  $bonusBanner.classList.add('hidden');
  save();
  render();
  closeSettings();
});

// ===== Wire up everything =====
setupTaskEvents($taskList);
setupTaskEvents($completedList);

$addTaskBtn.addEventListener('click', openAddModal);
$settingsBtn.addEventListener('click', openSettings);

$cancelTask.addEventListener('click', closeTaskModal);
$saveTask.addEventListener('click', saveTask);
$deleteTask.addEventListener('click', () => deleteTask(editingTaskId));
$taskName.addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });

$cancelSettings.addEventListener('click', closeSettings);
$saveSettings.addEventListener('click', saveSettings);

// Close modals on overlay click
$taskModal.addEventListener('click', e => { if (e.target === $taskModal) closeTaskModal(); });
$settingsModal.addEventListener('click', e => { if (e.target === $settingsModal) closeSettings(); });

// Completed toggle
$completedToggle.addEventListener('click', () => {
  completedOpen = !completedOpen;
  renderTasks();
});

// Points picker
document.querySelectorAll('.pts-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedPts = parseInt(btn.dataset.pts);
    $customPts.value = '';
    document.querySelectorAll('.pts-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

$customPts.addEventListener('input', () => {
  document.querySelectorAll('.pts-btn').forEach(b => b.classList.remove('selected'));
});

// Category picker
document.getElementById('categoryPicker').addEventListener('click', e => {
  const btn = e.target.closest('.cat-btn');
  if (!btn) return;
  selectedCat = btn.dataset.cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// Emoji picker
document.querySelector('.emoji-picker').addEventListener('click', e => {
  const btn = e.target.closest('.emoji-btn');
  if (!btn) return;
  selectedEmoji = btn.dataset.emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ===== Init =====
load();
renderDate();
render();

// Seed with sample tasks if empty for first-time users
if (state.tasks.length === 0) {
  state.tasks = [
    { id: uid(), name: 'Morning walk', pts: 20, cat: 'health', emoji: '🏃', done: false },
    { id: uid(), name: 'Take vitamins', pts: 10, cat: 'health', emoji: '💊', done: false },
    { id: uid(), name: 'Drink 8 glasses of water', pts: 15, cat: 'health', emoji: '💧', done: false },
    { id: uid(), name: 'Prepare lunch', pts: 20, cat: 'home', emoji: '🍳', done: false },
    { id: uid(), name: 'Call a friend', pts: 15, cat: 'personal', emoji: '📞', done: false },
    { id: uid(), name: 'Read for 30 min', pts: 20, cat: 'personal', emoji: '📚', done: false },
  ];
  save();
  render();
}

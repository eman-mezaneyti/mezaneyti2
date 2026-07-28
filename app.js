// ============================================================
// ميزانيتي — المرحلة الأولى
// تخزين محلي بالكامل على الهاتف (localStorage) — بدون إنترنت وبدون سيرفر
// ============================================================

// عشان نقدر نشوف أي خطأ فعليًا بيحصل على الهاتف (مفيش أدوات مطوّر متاحة على الموبايل)
window.addEventListener('error', function (e) {
  alert('حصل خطأ في التطبيق:\n' + e.message);
});

const STORAGE_KEY = 'mezaneyti_data_v1';

const CATEGORIES = [
  { id: 'اكل',       icon: '🍽️' },
  { id: 'ملابس',     icon: '👕' },
  { id: 'تعليم',     icon: '📚' },
  { id: 'علاج',      icon: '💊' },
  { id: 'اولاد',     icon: '🧒' },
  { id: 'ترفيه',     icon: '🎬' },
  { id: 'مواصلات',   icon: '🚗' },
  { id: 'اخرى',      icon: '📦' },
];

const PAYMENT_METHODS = ['كاش', 'فيزا'];

// القيم الافتراضية منقولة كما هي من ملف Google Sheets الأصلي
// (شاشة الإعدادات لتعديلها هتتضاف في المرحلة الجاية)
const DEFAULT_DATA = {
  income: { salary: 5000, spouseSalary: 12000, extra: 0 },
  commitments: [
    { name: 'كهرباء', amount: 600 },
    { name: 'مياه', amount: 200 },
    { name: 'غاز', amount: 250 },
    { name: 'إنترنت', amount: 300 },
    { name: 'أقساط', amount: 400 },
    { name: 'دروس مدرسة', amount: 1500 },
    { name: 'جمعيات', amount: 0 },
  ],
  transactions: [],
  // إعدادات كل شهر (دخل + التزامات) بشكل مستقل، مفتاحها "YYYY-MM"
  monthSettings: {},
  // تدوين حر لاقتراحات الشراء
  notes: '',
};

// ---------- تحميل / حفظ البيانات ----------
function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw);
    // تأكيد إن الشكل سليم قبل الاعتماد عليه
    if (!parsed || !parsed.income || !Array.isArray(parsed.commitments) || !Array.isArray(parsed.transactions)) {
      return cloneDefaults();
    }
    // ترحيل البيانات القديمة (قبل ميزة استقلالية كل شهر) لأول مرة
    if (!parsed.monthSettings || typeof parsed.monthSettings !== 'object') {
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      parsed.monthSettings = {
        [currentKey]: { income: parsed.income, commitments: parsed.commitments },
      };
    }
    if (typeof parsed.notes !== 'string') {
      parsed.notes = '';
    }
    return parsed;
  } catch (e) {
    alert('مشكلة في تحميل البيانات المحفوظة، هيتم البدء ببيانات افتراضية:\n' + e.message);
    return cloneDefaults();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('مشكلة في حفظ البيانات:\n' + e.message);
  }
}

let state = loadData();

// ---------- أدوات التاريخ ----------
function isoDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() {
  return isoDateStr(new Date());
}

function monthKeyOf(year, monthIndex0) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}

// دورة الميزانية مش شهر تقويمي: بتبدأ يوم 27 وتنتهي يوم 26 من الشهر اللي بعده.
// الدورة بتتحدد باسم شهر بدايتها (يوم الـ27).
function cycleBounds(year, monthIndex0) {
  const start = new Date(year, monthIndex0, 27);
  const end = new Date(year, monthIndex0 + 1, 26);
  return { startISO: isoDateStr(start), endISO: isoDateStr(end) };
}

function cycleKeyFromDate(date) {
  let y = date.getFullYear();
  let m = date.getMonth();
  if (date.getDate() < 27) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return { year: y, monthIndex0: m, key: monthKeyOf(y, m) };
}

function getCycleTx(year, monthIndex0) {
  const { startISO, endISO } = cycleBounds(year, monthIndex0);
  return state.transactions.filter(t => t.date >= startISO && t.date <= endISO);
}

function cycleLabelText(year, monthIndex0) {
  const startDate = new Date(year, monthIndex0, 27);
  const endDate = new Date(year, monthIndex0 + 1, 26);
  const opts = { day: 'numeric', month: 'long' };
  return `${startDate.toLocaleDateString('ar-EG', opts)} – ${endDate.toLocaleDateString('ar-EG', opts)}`;
}

// ---------- حالة الدورة المعروضة (للتنقل بين الدورات) ----------
const realNow = new Date();
const realCycle = cycleKeyFromDate(realNow);
let viewYear = realCycle.year;
let viewMonthIndex = realCycle.monthIndex0; // شهر بداية الدورة (0-based)

// ---------- حالة اليوم المعروض (للتنقل بين الأيام) ----------
let viewDate = new Date(realNow.getFullYear(), realNow.getMonth(), realNow.getDate());

// إعدادات الدخل/الالتزامات الخاصة بشهر معيّن.
// لو الشهر ده معملوش له تعديل صريح، بترجع آخر إعدادات محفوظة لأقرب شهر سابق (استمرارية طبيعية)،
// وأي تعديل لاحق على شهر معيّن بيفضل خاص بيه لوحده ومبيأثرش على الشهور اللي ليها إعداداتها الخاصة بالفعل.
function getSettingsForMonth(monthKey) {
  const keys = Object.keys(state.monthSettings).sort();
  let chosen = null;
  for (const k of keys) {
    if (k <= monthKey) chosen = k; else break;
  }
  if (chosen) return state.monthSettings[chosen];
  const d = cloneDefaults();
  return { income: d.income, commitments: d.commitments };
}

// ---------- الحسابات (نفس منطق الشيت) ----------
function computeStats() {
  const viewMonthKey = monthKeyOf(viewYear, viewMonthIndex);
  const viewSettings = getSettingsForMonth(viewMonthKey);
  const income = viewSettings.income.salary + viewSettings.income.spouseSalary + viewSettings.income.extra;
  const commitmentsTotal = viewSettings.commitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const remainingAfterCommitments = income - commitmentsTotal;

  const viewMonthTx = getCycleTx(viewYear, viewMonthIndex);
  const expensesTotal = viewMonthTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const remainingAfterExpenses = remainingAfterCommitments - expensesTotal;

  const byCategory = {};
  viewMonthTx.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount || 0);
  });

  return {
    income, commitmentsTotal, expensesTotal,
    remainingAfterCommitments, remainingAfterExpenses,
    byCategory, viewMonthTx, viewSettings,
  };
}

// ---------- تنسيق الأرقام ----------
function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

// ---------- عرض الشاشة الرئيسية ----------
function renderDashboard() {
  const s = computeStats();

  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  document.getElementById('monthLabel').textContent = cycleLabelText(viewYear, viewMonthIndex);

  document.getElementById('statIncome').textContent = fmt(s.income) + ' ج.م';
  document.getElementById('statCommitments').textContent = fmt(s.commitmentsTotal) + ' ج.م';
  document.getElementById('statExpenses').textContent = fmt(s.expensesTotal) + ' ج.م';
  document.getElementById('statRemaining').textContent = fmt(s.remainingAfterExpenses) + ' ج.م';

  renderDaySection();

  renderTxList(document.getElementById('recentTxList'), [...s.viewMonthTx]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 5));
}

// ---------- عرض قسم "مصروف يوم بعينه" ----------
function renderDaySection() {
  document.getElementById('dayLabel').textContent = viewDate.toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const dateStr = isoDateStr(viewDate);
  const dayTx = state.transactions.filter(t => t.date === dateStr);
  const dayTotal = dayTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  document.getElementById('statDayExpense').textContent = fmt(dayTotal) + ' ج.م';
}

// ---------- عرض قوائم الحركات ----------
function categoryIcon(catId) {
  const c = CATEGORIES.find(c => c.id === catId);
  return c ? c.icon : '📦';
}

function renderTxList(container, list) {
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<p style="color:var(--ink-soft); font-size:13px; text-align:center; padding:12px;">مفيش حركات لسه</p>';
    return;
  }
  list.forEach(t => {
    const row = document.createElement('div');
    row.className = 'tx-row';
    row.innerHTML = `
      <div class="tx-cat-icon">${categoryIcon(t.category)}</div>
      <div class="tx-info">
        <span class="tx-desc">${escapeHtml(t.desc)}</span>
        <span class="tx-meta">${t.category} · ${t.payment} · ${t.date}</span>
      </div>
      <span class="tx-amount">-${fmt(t.amount)}</span>
    `;
    row.addEventListener('click', () => openEditSheet(t.id));
    container.appendChild(row);
  });
}

function renderAllTransactions() {
  document.getElementById('txMonthLabel').textContent = `(${cycleLabelText(viewYear, viewMonthIndex)})`;
  const cycleTx = getCycleTx(viewYear, viewMonthIndex);
  const sorted = [...cycleTx].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const listEl = document.getElementById('allTxList');
  const emptyEl = document.getElementById('txEmptyState');
  if (sorted.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    renderTxList(listEl, sorted);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- التنقل بين الشاشات ----------
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewId);
  });
  if (viewId === 'view-transactions') renderAllTransactions();
  if (viewId === 'view-dashboard') renderDashboard();
  if (viewId === 'view-settings') renderSettings();
  if (viewId === 'view-notes') renderNotes();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.getElementById('goToTransactions').addEventListener('click', () => switchView('view-transactions'));

document.getElementById('prevMonthBtn').addEventListener('click', () => {
  viewMonthIndex--;
  if (viewMonthIndex < 0) { viewMonthIndex = 11; viewYear--; }
  renderDashboard();
});
document.getElementById('nextMonthBtn').addEventListener('click', () => {
  viewMonthIndex++;
  if (viewMonthIndex > 11) { viewMonthIndex = 0; viewYear++; }
  renderDashboard();
});

document.getElementById('prevDayBtn').addEventListener('click', () => {
  viewDate.setDate(viewDate.getDate() - 1);
  renderDaySection();
});
document.getElementById('nextDayBtn').addEventListener('click', () => {
  viewDate.setDate(viewDate.getDate() + 1);
  renderDaySection();
});

// ---------- نافذة إضافة / تعديل حركة ----------
const sheetBackdrop = document.getElementById('sheetBackdrop');
const txForm = document.getElementById('txForm');

function populateSelects() {
  const catSelect = document.getElementById('txCategory');
  catSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.id}</option>`).join('');
  const paySelect = document.getElementById('txPayment');
  paySelect.innerHTML = PAYMENT_METHODS.map(p => `<option value="${p}">${p}</option>`).join('');
}

function openAddSheet() {
  txForm.reset();
  document.getElementById('sheetTitle').textContent = 'إضافة مصروف';
  document.getElementById('txId').value = '';
  document.getElementById('txDate').value = todayISO();
  document.getElementById('deleteTxBtn').classList.add('hidden');
  sheetBackdrop.classList.remove('hidden');
}

function openEditSheet(id) {
  const t = state.transactions.find(t => t.id === id);
  if (!t) return;
  document.getElementById('sheetTitle').textContent = 'تعديل الحركة';
  document.getElementById('txId').value = t.id;
  document.getElementById('txDate').value = t.date;
  document.getElementById('txDesc').value = t.desc;
  document.getElementById('txCategory').value = t.category;
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('txPayment').value = t.payment;
  document.getElementById('deleteTxBtn').classList.remove('hidden');
  sheetBackdrop.classList.remove('hidden');
}

function closeSheet() {
  sheetBackdrop.classList.add('hidden');
}

document.getElementById('addTxBtn').addEventListener('click', openAddSheet);
document.getElementById('cancelTxBtn').addEventListener('click', closeSheet);
sheetBackdrop.addEventListener('click', (e) => {
  if (e.target === sheetBackdrop) closeSheet();
});

document.getElementById('saveTxBtn').addEventListener('click', () => {
  const id = document.getElementById('txId').value;
  const dateVal = document.getElementById('txDate').value;
  const descVal = document.getElementById('txDesc').value.trim();
  const catVal = document.getElementById('txCategory').value;
  const amountVal = Number(document.getElementById('txAmount').value);
  const payVal = document.getElementById('txPayment').value;

  if (!dateVal) { alert('من فضلك اختاري التاريخ'); return; }
  if (!descVal) { alert('من فضلك اكتبي البيان'); return; }
  if (!amountVal || amountVal <= 0) { alert('من فضلك اكتبي مبلغ أكبر من صفر'); return; }

  const entry = { id: id ? Number(id) : Date.now(), date: dateVal, desc: descVal, category: catVal, amount: amountVal, payment: payVal };

  if (id) {
    const idx = state.transactions.findIndex(t => t.id === entry.id);
    if (idx > -1) state.transactions[idx] = entry;
  } else {
    state.transactions.push(entry);
  }
  saveData();
  closeSheet();
  refreshCurrentView();
});

document.getElementById('deleteTxBtn').addEventListener('click', () => {
  const id = Number(document.getElementById('txId').value);
  if (!id) return;
  if (!confirm('تأكيدي حذف الحركة دي؟')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveData();
  closeSheet();
  refreshCurrentView();
});

function refreshCurrentView() {
  const activeView = document.querySelector('.view:not(.hidden)').id;
  if (activeView === 'view-transactions') renderAllTransactions();
  renderDashboard();
}

// ---------- نافذة تفاصيل البطاقات ----------
const detailBackdrop = document.getElementById('detailBackdrop');

function detailRow(name, value, isTotal) {
  return `<div class="detail-row${isTotal ? ' total' : ''}">
    <span class="d-name">${escapeHtml(name)}</span>
    <span class="d-value">${fmt(value)} ج.م</span>
  </div>`;
}

function openDetailSheet(kind) {
  const s = computeStats();
  let title = '';
  let body = '';

  if (kind === 'income') {
    title = 'تفاصيل الدخل';
    body = detailRow('مرتب', s.viewSettings.income.salary)
      + detailRow('مرتب الزوج', s.viewSettings.income.spouseSalary)
      + detailRow('دخل إضافي', s.viewSettings.income.extra)
      + detailRow('الإجمالي', s.income, true);
  } else if (kind === 'commitments') {
    title = 'تفاصيل الالتزامات الثابتة';
    body = s.viewSettings.commitments.map(c => detailRow(c.name, c.amount)).join('')
      + detailRow('الإجمالي', s.commitmentsTotal, true);
  } else if (kind === 'expenses') {
    title = 'المنصرف حتى اليوم حسب التصنيف';
    const entries = Object.entries(s.byCategory);
    if (entries.length === 0) {
      body = '<p class="detail-empty">لسه مفيش مصروفات في الشهر ده</p>';
    } else {
      body = entries
        .sort((a, b) => b[1] - a[1])
        .map(([cat, val]) => detailRow(`${categoryIcon(cat)} ${cat}`, val))
        .join('') + detailRow('الإجمالي', s.expensesTotal, true);
    }
  } else if (kind === 'remaining') {
    title = 'كيف حُسب المتبقي';
    body = detailRow('إجمالي الدخل', s.income)
      + detailRow('الالتزامات الثابتة', -s.commitmentsTotal)
      + detailRow('المنصرف حتى اليوم', -s.expensesTotal)
      + detailRow('المتبقي', s.remainingAfterExpenses, true);
  } else if (kind === 'day') {
    const dateStr = isoDateStr(viewDate);
    title = 'مصروفات ' + viewDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
    const dayTx = state.transactions.filter(t => t.date === dateStr);
    if (dayTx.length === 0) {
      body = '<p class="detail-empty">مفيش مصروفات في اليوم ده</p>';
    } else {
      const dayTotal = dayTx.reduce((s2, t) => s2 + Number(t.amount || 0), 0);
      body = dayTx.map(t => detailRow(`${categoryIcon(t.category)} ${t.desc}`, t.amount)).join('')
        + detailRow('الإجمالي', dayTotal, true);
    }
  }

  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailBody').innerHTML = body;
  detailBackdrop.classList.remove('hidden');
}

document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => openDetailSheet(card.dataset.detail));
});
document.getElementById('closeDetailBtn').addEventListener('click', () => detailBackdrop.classList.add('hidden'));
detailBackdrop.addEventListener('click', (e) => {
  if (e.target === detailBackdrop) detailBackdrop.classList.add('hidden');
});

// ---------- شاشة الإعدادات ----------
let settingsSnapshot = null; // الإعدادات الفعّالة اللي بتتعرض دلوقتي (تُستخدم وقت الحفظ)

function renderSettings() {
  const monthKey = monthKeyOf(viewYear, viewMonthIndex);
  const effective = getSettingsForMonth(monthKey);
  settingsSnapshot = effective;

  const monthDate = new Date(viewYear, viewMonthIndex, 1);
  const monthName = monthDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
  document.getElementById('settingsMonthLabel').textContent = `(شهر ${monthName})`;

  document.getElementById('setSalary').value = effective.income.salary;
  document.getElementById('setSpouseSalary').value = effective.income.spouseSalary;
  document.getElementById('setExtraIncome').value = effective.income.extra;

  const container = document.getElementById('commitmentsFields');
  container.innerHTML = effective.commitments.map((c, i) => `
    <label class="field">
      <span>${c.name}</span>
      <input type="number" inputmode="decimal" min="0" step="1" data-idx="${i}" class="commitmentInput" value="${c.amount}">
    </label>
  `).join('');
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const monthKey = monthKeyOf(viewYear, viewMonthIndex);
  const salary = Number(document.getElementById('setSalary').value) || 0;
  const spouseSalary = Number(document.getElementById('setSpouseSalary').value) || 0;
  const extra = Number(document.getElementById('setExtraIncome').value) || 0;

  const baseCommitments = settingsSnapshot ? settingsSnapshot.commitments : [];
  const newCommitments = baseCommitments.map((c, i) => {
    const input = document.querySelector(`.commitmentInput[data-idx="${i}"]`);
    return { name: c.name, amount: input ? (Number(input.value) || 0) : c.amount };
  });

  state.monthSettings[monthKey] = {
    income: { salary, spouseSalary, extra },
    commitments: newCommitments,
  };

  saveData();
  alert('تم حفظ التعديلات لهذا الشهر ✅');
  switchView('view-dashboard');
});

// ---------- شاشة التدوين ----------
function renderNotes() {
  document.getElementById('notesArea').value = state.notes || '';
}

document.getElementById('saveNotesBtn').addEventListener('click', () => {
  state.notes = document.getElementById('notesArea').value;
  saveData();
  alert('تم حفظ التدوين ✅');
});

// ---------- تسجيل Service Worker (للعمل بدون إنترنت) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // لو فشل التسجيل (مثلاً وقت التجربة المحلية)، التطبيق برضو هيشتغل عادي
    });
  });
}

// ---------- تشغيل التطبيق ----------
populateSelects();
renderDashboard();

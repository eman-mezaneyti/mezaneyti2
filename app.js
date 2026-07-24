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
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function isSameMonth(dateStr, ref) {
  return dateStr.slice(0, 7) === ref.slice(0, 7);
}

// ---------- حالة الشهر المعروض (للتنقل بين الشهور) ----------
const realNow = new Date();
let viewYear = realNow.getFullYear();
let viewMonthIndex = realNow.getMonth(); // 0-based

function monthKeyOf(year, monthIndex0) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}

function getMonthTx(monthKey) {
  return state.transactions.filter(t => t.date.slice(0, 7) === monthKey);
}

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
  // --- حسابات "النهاردة" الحقيقية (مستقلة عن الشهر اللي بتتصفحيه) ---
  const today = todayISO();
  const realMonthKey = monthKeyOf(realNow.getFullYear(), realNow.getMonth());
  const realSettings = getSettingsForMonth(realMonthKey);
  const realIncome = realSettings.income.salary + realSettings.income.spouseSalary + realSettings.income.extra;
  const realCommitmentsTotal = realSettings.commitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const remainingAfterCommitmentsReal = realIncome - realCommitmentsTotal;

  const realMonthTx = getMonthTx(realMonthKey);
  const realExpensesTotal = realMonthTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const remainingAfterExpensesReal = remainingAfterCommitmentsReal - realExpensesTotal;

  const totalDaysInMonth = daysInMonth(realNow.getFullYear(), realNow.getMonth());
  const dayOfMonth = realNow.getDate();
  const daysRemaining = totalDaysInMonth - dayOfMonth + 1; // شامل اليوم النهارده

  // المسموح به يوميًا = المتبقي بعد الالتزامات ومصروفات الشهر الحالي ÷ الأيام المتبقية في الشهر
  const allowedPerDay = daysRemaining > 0 ? remainingAfterExpensesReal / daysRemaining : 0;

  const todayTx = state.transactions.filter(t => t.date === today);
  const spentToday = todayTx.reduce((s, t) => s + Number(t.amount || 0), 0);

  // --- حسابات الشهر اللي بتتصفحيه (له دخل والتزامات مستقلة تمامًا) ---
  const viewMonthKey = monthKeyOf(viewYear, viewMonthIndex);
  const viewSettings = getSettingsForMonth(viewMonthKey);
  const income = viewSettings.income.salary + viewSettings.income.spouseSalary + viewSettings.income.extra;
  const commitmentsTotal = viewSettings.commitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const remainingAfterCommitments = income - commitmentsTotal;

  const viewMonthTx = getMonthTx(viewMonthKey);
  const expensesTotal = viewMonthTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const remainingAfterExpenses = remainingAfterCommitments - expensesTotal;

  const byCategory = {};
  viewMonthTx.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount || 0);
  });

  const isCurrentMonth = (viewYear === realNow.getFullYear() && viewMonthIndex === realNow.getMonth());

  return {
    income, commitmentsTotal, expensesTotal,
    remainingAfterCommitments, remainingAfterExpenses,
    allowedPerDay, spentToday, daysRemaining, byCategory,
    viewMonthTx, viewSettings, isCurrentMonth,
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

  const monthDate = new Date(viewYear, viewMonthIndex, 1);
  document.getElementById('monthLabel').textContent = monthDate.toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long',
  });

  const heroValue = s.allowedPerDay - s.spentToday;

  document.getElementById('heroAmount').textContent = fmt(heroValue);
  document.getElementById('heroSub').textContent =
    `من أصل ${fmt(s.allowedPerDay)} ج.م المسموح بيه النهاردة، صرفتِ ${fmt(s.spentToday)} ج.م`;

  const ring = document.getElementById('ringProgress');
  const circumference = 540; // 2 * PI * 86
  let pct = s.allowedPerDay > 0 ? s.spentToday / s.allowedPerDay : (s.spentToday > 0 ? 1 : 0);
  pct = Math.min(Math.max(pct, 0), 1);
  ring.style.strokeDashoffset = circumference - (circumference * pct);

  if (heroValue < 0) {
    ring.style.stroke = 'var(--brick)';
  } else if (pct > 0.75) {
    ring.style.stroke = 'var(--amber)';
  } else {
    ring.style.stroke = 'var(--teal)';
  }

  document.getElementById('statIncome').textContent = fmt(s.income) + ' ج.م';
  document.getElementById('statCommitments').textContent = fmt(s.commitmentsTotal) + ' ج.م';
  document.getElementById('statExpenses').textContent = fmt(s.expensesTotal) + ' ج.م';
  document.getElementById('statRemaining').textContent = fmt(s.remainingAfterExpenses) + ' ج.م';
  const todayCard = document.querySelector('.stat-card[data-detail="today"]');
  if (s.isCurrentMonth) {
    document.getElementById('statToday').textContent = fmt(s.spentToday) + ' ج.م';
    todayCard.classList.remove('disabled-card');
  } else {
    document.getElementById('statToday').textContent = '—';
    todayCard.classList.add('disabled-card');
  }

  renderTxList(document.getElementById('recentTxList'), [...s.viewMonthTx]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 5));
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
  const sorted = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
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
    title = 'مصروفات الشهر حسب التصنيف';
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
      + detailRow('مصروفات الشهر', -s.expensesTotal)
      + detailRow('المتبقي', s.remainingAfterExpenses, true);
  } else if (kind === 'today') {
    title = 'مصروفات النهاردة';
    if (!s.isCurrentMonth) {
      body = '<p class="detail-empty">"مصروف اليوم" بيوري إنفاق النهاردة الفعلي بس، فمش بيتغيّر مع تصفح شهور تانية. ارجعي للشهر الحالي عشان تشوفيه.</p>';
    } else {
      const today = todayISO();
      const todayTx = state.transactions.filter(t => t.date === today);
      if (todayTx.length === 0) {
        body = '<p class="detail-empty">لسه معملتيش أي مصروف النهاردة</p>';
      } else {
        body = todayTx.map(t => detailRow(`${categoryIcon(t.category)} ${t.desc}`, t.amount)).join('')
          + detailRow('الإجمالي', s.spentToday, true);
      }
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

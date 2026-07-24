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

// ---------- الحسابات (نفس منطق الشيت) ----------
function computeStats() {
  const income = state.income.salary + state.income.spouseSalary + state.income.extra;
  const commitmentsTotal = state.commitments.reduce((s, c) => s + Number(c.amount || 0), 0);

  const today = todayISO();
  const now = new Date();
  const totalDaysInMonth = daysInMonth(now.getFullYear(), now.getMonth());
  const dayOfMonth = now.getDate();
  const daysRemaining = totalDaysInMonth - dayOfMonth + 1; // شامل اليوم النهارده

  const monthTx = state.transactions.filter(t => isSameMonth(t.date, today));
  const expensesTotal = monthTx.reduce((s, t) => s + Number(t.amount || 0), 0);

  const remainingAfterCommitments = income - commitmentsTotal;
  const remainingAfterExpenses = remainingAfterCommitments - expensesTotal;

  // المسموح به يوميًا = المتبقي بعد الالتزامات والمصروفات ÷ الأيام المتبقية في الشهر
  const allowedPerDay = daysRemaining > 0 ? remainingAfterExpenses / daysRemaining : 0;

  // متوسط الصرف اليومي = إجمالي مصروفات الشهر ÷ عدد الأيام التي مرّت من الشهر (شامل اليوم)
  // ملاحظة: القسمة الدقيقة المستخدمة في نسخة الشيت الأصلية لم تكن واضحة (٧ كخانة قسمة ثابتة)،
  // فتم اعتماد "عدد الأيام المنقضية" كأقرب معنى منطقي لحد ما تتأكدي من الرقم الصحيح.
  const averageDailySpend = dayOfMonth > 0 ? expensesTotal / dayOfMonth : 0;

  const todayTx = state.transactions.filter(t => t.date === today);
  const spentToday = todayTx.reduce((s, t) => s + Number(t.amount || 0), 0);

  const byCategory = {};
  monthTx.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount || 0);
  });

  return {
    income, commitmentsTotal, expensesTotal,
    remainingAfterCommitments, remainingAfterExpenses,
    allowedPerDay, averageDailySpend, spentToday,
    daysRemaining, byCategory,
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

  renderTxList(document.getElementById('recentTxList'), [...state.transactions]
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

// ---------- شاشة الإعدادات ----------
function renderSettings() {
  document.getElementById('setSalary').value = state.income.salary;
  document.getElementById('setSpouseSalary').value = state.income.spouseSalary;
  document.getElementById('setExtraIncome').value = state.income.extra;

  const container = document.getElementById('commitmentsFields');
  container.innerHTML = state.commitments.map((c, i) => `
    <label class="field">
      <span>${c.name}</span>
      <input type="number" inputmode="decimal" min="0" step="1" data-idx="${i}" class="commitmentInput" value="${c.amount}">
    </label>
  `).join('');
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const salary = Number(document.getElementById('setSalary').value) || 0;
  const spouseSalary = Number(document.getElementById('setSpouseSalary').value) || 0;
  const extra = Number(document.getElementById('setExtraIncome').value) || 0;
  state.income = { salary, spouseSalary, extra };

  document.querySelectorAll('.commitmentInput').forEach(input => {
    const idx = Number(input.dataset.idx);
    state.commitments[idx].amount = Number(input.value) || 0;
  });

  saveData();
  alert('تم حفظ التعديلات ✅');
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

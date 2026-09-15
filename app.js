const STORAGE_KEY = 'myfintrack-data';
const INCOME_KEY = 'income';
const INITIAL_BALANCE_KEY = 'initialBalance';
const SETUP_KEY = 'isSetupDone';
const AUTO_BACKUP_KEY = 'autoBackupSnapshot';
const LAST_BACKUP_KEY = 'lastBackupDate';
const BACKUP_PROMPT_KEY = 'backupPromptDate';
const BACKUP_DISMISS_KEY = 'backupDismissedDate';
const PIN_SET_KEY = 'pinIsSet';
const USER_PIN_KEY = 'userPin';
const COLORS = ['#e67c67', '#6792b8', '#e6b84f', '#6eaa86', '#9a7eb8', '#d28e5e'];
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"expenses":[],"investments":[]}');
data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
data.investments = Array.isArray(data.investments) ? data.investments : [];
let income = JSON.parse(localStorage.getItem(INCOME_KEY) || '[]');
income = Array.isArray(income) ? income : [];
let initialBalance = Number(localStorage.getItem(INITIAL_BALANCE_KEY) || 0);
let expenseChart;
let investmentChart;
let isUnlocked = false;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses: data.expenses, investments: data.investments }));
  localStorage.setItem(INCOME_KEY, JSON.stringify(income));
}

function snapshot() {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify({ initialBalance, income, expenses: data.expenses, investments: data.investments }));
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('is-visible', panel.id === tabName));
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === tabName));
  window.location.hash = tabName;
}

document.querySelectorAll('.nav-tab').forEach(tab => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
document.querySelectorAll('[data-go-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.goTab)));

function setDefaultDates() {
  document.querySelectorAll('input[type="date"][name="date"]').forEach(input => { if (!input.value) input.value = today(); });
  document.querySelector('#dashboard-date').textContent = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());
}

function totalIncome() { return income.reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function totalExpenses() { return data.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function investedCost(item) { return item.quantity && item.buyPrice ? Number(item.quantity) * Number(item.buyPrice) : Number(item.amount || 0); }
function totalInvested() { return data.investments.reduce((sum, item) => sum + investedCost(item), 0); }
function portfolioValue() { return data.investments.reduce((sum, item) => sum + Number(item.value || 0), 0); }
function availableBalance() { return initialBalance + totalIncome() - totalExpenses() - totalInvested(); }

function getFilteredExpenses() {
  const category = document.querySelector('#expense-category-filter').value;
  const from = document.querySelector('#expense-from').value;
  const to = document.querySelector('#expense-to').value;
  return data.expenses.filter(item => (!from || item.date >= from) && (!to || item.date <= to) && (category === 'all' || item.category === category)).sort((a, b) => b.date.localeCompare(a.date));
}

function renderExpenseList() {
  const list = getFilteredExpenses();
  const body = document.querySelector('#expense-list');
  body.innerHTML = list.map(item => `<tr><td>${item.date}</td><td><span class="category-pill">${item.category}</span></td><td>${item.note || '<span class="muted">No note</span>'}</td><td class="align-right">${money(item.amount)}</td><td class="align-right"><button class="action-button" title="Edit expense" data-edit-expense="${item.id}">✎</button><button class="action-button" title="Delete expense" data-delete-expense="${item.id}">×</button></td></tr>`).join('');
  document.querySelector('#expense-list-empty').style.display = list.length ? 'none' : 'block';
  document.querySelector('#expense-running-total').textContent = money(list.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  body.querySelectorAll('[data-delete-expense]').forEach(button => button.addEventListener('click', () => removeItem('expenses', button.dataset.deleteExpense)));
  body.querySelectorAll('[data-edit-expense]').forEach(button => button.addEventListener('click', () => editExpense(button.dataset.editExpense)));
}

function renderInvestmentList() {
  const body = document.querySelector('#investment-list');
  body.innerHTML = data.investments.slice().sort((a, b) => b.date.localeCompare(a.date)).map(item => `<tr><td>${item.name}</td><td><span class="category-pill">${item.type}</span></td><td>${item.date}</td><td class="align-right">${money(item.value)}</td><td class="align-right"><button class="action-button" title="Edit investment" data-edit-investment="${item.id}">✎</button><button class="action-button" title="Delete investment" data-delete-investment="${item.id}">×</button></td></tr>`).join('');
  document.querySelector('#investment-list-empty').style.display = data.investments.length ? 'none' : 'block';
  document.querySelector('#investment-running-total').textContent = money(portfolioValue());
  body.querySelectorAll('[data-delete-investment]').forEach(button => button.addEventListener('click', () => removeItem('investments', button.dataset.deleteInvestment)));
  body.querySelectorAll('[data-edit-investment]').forEach(button => button.addEventListener('click', () => editInvestment(button.dataset.editInvestment)));
}

function renderIncomeList() {
  const body = document.querySelector('#income-list');
  body.innerHTML = income.slice().sort((a, b) => b.date.localeCompare(a.date)).map(item => `<tr><td>${item.date}</td><td><span class="category-pill">${item.source}</span></td><td>${item.note || '<span class="muted">No note</span>'}</td><td class="align-right">${money(item.amount)}</td><td class="align-right"><button class="action-button" title="Edit income" data-edit-income="${item.id}">✎</button><button class="action-button" title="Delete income" data-delete-income="${item.id}">×</button></td></tr>`).join('');
  document.querySelector('#income-list-empty').style.display = income.length ? 'none' : 'block';
  document.querySelector('#income-running-total').textContent = money(totalIncome());
  document.querySelector('#total-income').textContent = money(totalIncome());
  document.querySelector('#income-count').textContent = `${income.length} entr${income.length === 1 ? 'y' : 'ies'}`;
  body.querySelectorAll('[data-delete-income]').forEach(button => button.addEventListener('click', () => removeItem('income', button.dataset.deleteIncome)));
  body.querySelectorAll('[data-edit-income]').forEach(button => button.addEventListener('click', () => editIncome(button.dataset.editIncome)));
}

function removeItem(collection, id) {
  if (collection === 'income') income = income.filter(item => item.id !== id);
  else data[collection] = data[collection].filter(item => item.id !== id);
  save(); snapshot(); renderAll(); showToast('Entry removed');
}

function fillForm(form, item) {
  Object.entries(item).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
  form.dataset.editing = item.id;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function editExpense(id) { const item = data.expenses.find(entry => entry.id === id); if (!item) return; activateTab('expenses'); fillForm(document.querySelector('#expense-form'), item); document.querySelector('#expense-form button').firstChild.textContent = 'Update expense '; }
function editInvestment(id) { const item = data.investments.find(entry => entry.id === id); if (!item) return; activateTab('investments'); fillForm(document.querySelector('#investment-form'), item); document.querySelector('#investment-form button').firstChild.textContent = 'Update investment '; }
function editIncome(id) { const item = income.find(entry => entry.id === id); if (!item) return; activateTab('income'); fillForm(document.querySelector('#income-form'), item); document.querySelector('#income-form button').firstChild.textContent = 'Update income '; }

function balanceAfterChange(collection, entry, editingId) {
  let balance = availableBalance();
  const oldCollection = collection === 'income' ? income : data[collection];
  const old = editingId ? oldCollection.find(item => item.id === editingId) : null;
  if (old) balance += collection === 'income' ? -Number(old.amount || 0) : Number(old.amount || 0);
  if (collection === 'income') balance += Number(entry.amount || 0);
  if (collection === 'expenses') balance -= Number(entry.amount || 0);
  if (collection === 'investments') balance -= investedCost(entry);
  return balance;
}

function formEntry(form, collection, fields) {
  const values = Object.fromEntries(fields.map(field => [field, form.elements[field].value]));
  const entry = { id: form.dataset.editing || crypto.randomUUID(), ...values };
  entry.amount = Number(entry.amount);
  if (collection === 'investments') entry.value = Number(entry.value);
  if (['expenses', 'investments'].includes(collection) && balanceAfterChange(collection, entry, form.dataset.editing) < 0 && !window.confirm('This will make your balance negative. Continue?')) return;
  const collectionData = collection === 'income' ? income : data[collection];
  const existingIndex = collectionData.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) collectionData[existingIndex] = entry; else collectionData.push(entry);
  save(); snapshot(); form.reset(); delete form.dataset.editing; setDefaultDates(); renderAll();
  form.querySelector('button').firstChild.textContent = collection === 'expenses' ? 'Save expense ' : collection === 'investments' ? 'Save investment ' : 'Save income ';
  showToast(existingIndex >= 0 ? 'Entry updated' : 'Entry saved');
}

document.querySelector('#expense-form').addEventListener('submit', event => { event.preventDefault(); formEntry(event.currentTarget, 'expenses', ['amount', 'category', 'date', 'note']); });
document.querySelector('#investment-form').addEventListener('submit', event => { event.preventDefault(); formEntry(event.currentTarget, 'investments', ['name', 'type', 'amount', 'value', 'date']); });
document.querySelector('#income-form').addEventListener('submit', event => { event.preventDefault(); formEntry(event.currentTarget, 'income', ['amount', 'source', 'date', 'note']); });
['#expense-category-filter', '#expense-from', '#expense-to'].forEach(selector => document.querySelector(selector).addEventListener('input', renderExpenseList));

function groupBy(items, key) {
  return items.reduce((groups, item) => { groups[item[key]] = (groups[item[key]] || 0) + (key === 'category' ? Number(item.amount || 0) : Number(item.value || 0)); return groups; }, {});
}

function drawChart(canvasId, emptyId, legendId, grouped, chartRef) {
  const labels = Object.keys(grouped);
  document.querySelector(`#${emptyId}`).style.display = labels.length ? 'none' : 'block';
  if (chartRef) chartRef.destroy();
  if (!labels.length || typeof Chart === 'undefined') return null;
  const colors = labels.map((_, index) => COLORS[index % COLORS.length]);
  const chart = new Chart(document.querySelector(`#${canvasId}`), { type: 'doughnut', data: { labels, datasets: [{ data: Object.values(grouped), backgroundColor: colors, borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ` ${money(context.raw)}` } } } } });
  document.querySelector(`#${legendId}`).innerHTML = labels.map((label, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${colors[index]}"></i>${label}</span>`).join('');
  return chart;
}

function renderDashboard() {
  const monthExpenses = data.expenses.filter(item => item.date.startsWith(currentMonth()));
  const monthExpenseTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const invested = totalInvested();
  const portfolio = portfolioValue();
  const balance = availableBalance();
  document.querySelector('#available-balance').textContent = money(balance);
  document.querySelector('#total-expenses').textContent = money(monthExpenseTotal);
  document.querySelector('#expense-count').textContent = `${monthExpenses.length} transaction${monthExpenses.length === 1 ? '' : 's'}`;
  document.querySelector('#total-invested').textContent = money(invested);
  document.querySelector('#investment-count').textContent = `${data.investments.length} position${data.investments.length === 1 ? '' : 's'}`;
  document.querySelector('#portfolio-value').textContent = money(portfolio);
  document.querySelector('#net-worth').textContent = money(balance + portfolio);
  const change = portfolio - invested;
  document.querySelector('#portfolio-change').textContent = data.investments.length ? `${change >= 0 ? '+' : ''}${money(change)} unrealized change` : 'Add investments to track value';
  document.querySelector('#available-balance').classList.toggle('negative-value', balance < 0);
  expenseChart = drawChart('expense-chart', 'expense-empty', 'expense-legend', groupBy(monthExpenses, 'category'), expenseChart);
  investmentChart = drawChart('investment-chart', 'investment-empty', 'investment-legend', groupBy(data.investments, 'type'), investmentChart);
}

function backupAge() {
  const date = localStorage.getItem(LAST_BACKUP_KEY);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

function exportData() {
  const backup = { initialBalance, income, expenses: data.expenses, investments: data.investments };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  link.download = `myfintrack-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  localStorage.removeItem(BACKUP_DISMISS_KEY);
  renderBackupReminder();
  showToast('Backup exported');
}

function renderBackupReminder() {
  const age = backupAge();
  const overdue = age === null || age >= 7;
  const banner = document.querySelector('#backup-banner');
  const dismissed = localStorage.getItem(BACKUP_DISMISS_KEY) === today();
  if (!overdue || dismissed) { banner.classList.remove('is-visible'); return; }
  document.querySelector('#backup-message').textContent = `⚠️ Last backup: ${age === null ? 'never' : `${age} day${age === 1 ? '' : 's'} ago`}. Export your data to avoid losing it.`;
  banner.classList.add('is-visible');
}

function maybePromptBackup() {
  if (localStorage.getItem(SETUP_KEY) !== 'true') return;
  const age = backupAge();
  if ((age === null || age >= 7) && localStorage.getItem(BACKUP_PROMPT_KEY) !== today()) {
    localStorage.setItem(BACKUP_PROMPT_KEY, today());
    if (window.confirm("It's been a while since your last backup. Export your data now?")) exportData();
  }
}

function restoreAutoBackup() {
  const snapshotData = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) || 'null');
  if (!snapshotData) { showToast('No auto-backup found'); return; }
  if (!window.confirm('Restore your data from the auto-backup?')) return;
  initialBalance = Number(snapshotData.initialBalance || 0);
  income = Array.isArray(snapshotData.income) ? snapshotData.income : [];
  data.expenses = Array.isArray(snapshotData.expenses) ? snapshotData.expenses : [];
  data.investments = Array.isArray(snapshotData.investments) ? snapshotData.investments : [];
  localStorage.setItem(INITIAL_BALANCE_KEY, initialBalance);
  save(); renderAll(); showToast('Auto-backup restored');
}

function resetApp() {
  if (!window.confirm('This will clear your current data. Your last auto-backup will still be available for restore. Continue?')) return;
  [STORAGE_KEY, INCOME_KEY, INITIAL_BALANCE_KEY, SETUP_KEY].forEach(key => localStorage.removeItem(key));
  window.location.reload();
}

function setupPinLock() {
  const lock = document.querySelector('#pin-lock');
  const form = document.querySelector('#pin-form');
  const inputs = [...document.querySelectorAll('.pin-input')];
  const inputGroup = document.querySelector('#pin-inputs');
  const error = document.querySelector('#pin-error');
  const title = document.querySelector('#pin-lock-title');
  const subtitle = document.querySelector('.pin-lock-subtitle');
  const submitButton = form.querySelector('button[type="submit"]');
  let activeIndex = 0;
  let flow = 'unlock';
  let firstPin = '';

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(index, inputs.length - 1));
    inputs.forEach((pinInput, inputIndex) => pinInput.classList.toggle('is-active', inputIndex === activeIndex));
  }

  function focusInput(index) {
    setActive(index);
    inputs[activeIndex].focus();
  }

  function clearPin() {
    inputs.forEach(input => { input.value = ''; });
    focusInput(0);
  }

  function setScreen(nextFlow, message = '') {
    flow = nextFlow;
    const screens = {
      unlock: { heading: 'MyFinTrack', subtitle: 'Enter your PIN to continue', button: 'Unlock' },
      current: { heading: 'Enter your current PIN', subtitle: 'Verify your identity to change your PIN', button: 'Verify PIN' },
      create: { heading: 'Create a 4-digit PIN', subtitle: 'Choose a PIN for this device', button: 'Continue' },
      confirm: { heading: 'Confirm your PIN', subtitle: 'Enter your new PIN again', button: 'Save PIN' }
    };
    const screen = screens[nextFlow];
    title.textContent = screen.heading;
    subtitle.textContent = screen.subtitle;
    submitButton.firstChild.textContent = `${screen.button} `;
    error.textContent = message;
    clearPin();
  }

  function finishUnlock() {
    isUnlocked = true;
    lock.classList.add('is-unlocked');
    lock.setAttribute('aria-hidden', 'true');
  }

  function submitPin() {
    const enteredPin = inputs.map(input => input.value).join('');
    if (enteredPin.length !== inputs.length) return;

    if (flow === 'unlock') {
      if (enteredPin === localStorage.getItem(USER_PIN_KEY)) finishUnlock();
      else { error.textContent = 'Incorrect PIN, try again'; shakeAndClear(); }
      return;
    }

    if (flow === 'current') {
      if (enteredPin === localStorage.getItem(USER_PIN_KEY)) setScreen('create');
      else { error.textContent = 'Incorrect current PIN'; shakeAndClear(); }
      return;
    }

    if (flow === 'create') {
      firstPin = enteredPin;
      setScreen('confirm');
      return;
    }

    if (enteredPin === firstPin) {
      localStorage.setItem(USER_PIN_KEY, enteredPin);
      localStorage.setItem(PIN_SET_KEY, 'true');
      finishUnlock();
    } else {
      firstPin = '';
      setScreen('create', "PINs don't match, try again");
    }
  }

  function shakeAndClear() {
    inputGroup.classList.remove('is-shaking');
    window.requestAnimationFrame(() => inputGroup.classList.add('is-shaking'));
    clearPin();
  }

  inputs.forEach(input => {
    input.readOnly = true;
    input.setAttribute('readonly', 'true');
  });
  inputs.forEach((input, index) => {
    input.addEventListener('focus', () => setActive(index));
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      error.textContent = '';
      if (input.value && index < inputs.length - 1) focusInput(index + 1);
      if (inputs.every(pinInput => pinInput.value)) submitPin();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value && index > 0) focusInput(index - 1);
      if (event.key === 'ArrowLeft' && index > 0) focusInput(index - 1);
      if (event.key === 'ArrowRight' && index < inputs.length - 1) focusInput(index + 1);
    });
    input.addEventListener('paste', event => {
      event.preventDefault();
      const pastedPin = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, inputs.length);
      pastedPin.split('').forEach((digit, pastedIndex) => { inputs[pastedIndex].value = digit; });
      const nextEmpty = inputs.findIndex(pinInput => !pinInput.value);
      if (nextEmpty === -1) submitPin(); else focusInput(nextEmpty);
    });
  });

  form.addEventListener('submit', event => { event.preventDefault(); submitPin(); });
  document.querySelectorAll('[data-pin-key]').forEach(button => button.addEventListener('click', () => {
    inputs[activeIndex].value = button.dataset.pinKey;
    inputs[activeIndex].dispatchEvent(new Event('input', { bubbles: true }));
  }));
  document.querySelector('[data-pin-action="delete"]').addEventListener('click', () => {
    const input = inputs[activeIndex];
    if (input.value) input.value = '';
    else if (activeIndex > 0) {
      focusInput(activeIndex - 1);
      inputs[activeIndex].value = '';
    }
    error.textContent = '';
  });
  const startChangePin = () => {
    firstPin = '';
    lock.classList.remove('is-unlocked');
    lock.removeAttribute('aria-hidden');
    setScreen('current');
  };

  if (localStorage.getItem(PIN_SET_KEY) === 'true' && localStorage.getItem(USER_PIN_KEY)) setScreen('unlock');
  else setScreen('create');
  return { startChangePin };
}

function setupApp(pinLock) {
  document.querySelector('#setup-form').addEventListener('submit', event => {
    event.preventDefault();
    initialBalance = Number(event.currentTarget.elements.initialBalance.value);
    localStorage.setItem(INITIAL_BALANCE_KEY, initialBalance);
    localStorage.setItem(SETUP_KEY, 'true');
    snapshot();
    document.querySelector('#setup-modal').classList.remove('is-visible');
    renderAll();
  });
  document.querySelector('#settings-button').addEventListener('click', () => document.querySelector('#settings-modal').classList.add('is-visible'));
  document.querySelector('#close-settings').addEventListener('click', () => document.querySelector('#settings-modal').classList.remove('is-visible'));
  document.querySelector('#settings-export-button').addEventListener('click', exportData);
  document.querySelector('#export-now-button').addEventListener('click', exportData);
  document.querySelector('#dismiss-backup-button').addEventListener('click', () => { localStorage.setItem(BACKUP_DISMISS_KEY, today()); renderBackupReminder(); });
  document.querySelector('#restore-button').addEventListener('click', restoreAutoBackup);
  document.querySelector('#change-pin-button').addEventListener('click', () => {
    document.querySelector('#settings-modal').classList.remove('is-visible');
    pinLock.startChangePin();
  });
  document.querySelector('#reset-button').addEventListener('click', resetApp);
  if (localStorage.getItem(SETUP_KEY) !== 'true') document.querySelector('#setup-modal').classList.add('is-visible');
}

function renderAll() { renderDashboard(); renderExpenseList(); renderInvestmentList(); renderIncomeList(); renderBackupReminder(); }

localStorage.setItem(INITIAL_BALANCE_KEY, initialBalance);
const pinLock = setupPinLock();
setDefaultDates();
activateTab(window.location.hash.slice(1) || 'dashboard');
setupApp(pinLock);
renderAll();
maybePromptBackup();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
/*
const STORAGE_KEY = 'myfintrack-data';
const INCOME_KEY = 'income';
const INITIAL_BALANCE_KEY = 'initialBalance';
const SETUP_KEY = 'isSetupDone';
const AUTO_BACKUP_KEY = 'autoBackupSnapshot';
const LAST_BACKUP_KEY = 'lastBackupDate';
const BACKUP_PROMPT_KEY = 'backupPromptDate';
const BACKUP_DISMISS_KEY = 'backupDismissedDate';
const COLORS = ['#e67c67', '#6792b8', '#e6b84f', '#6eaa86', '#9a7eb8', '#d28e5e'];
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"expenses":[],"investments":[]}');
data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
data.investments = Array.isArray(data.investments) ? data.investments : [];
let income = JSON.parse(localStorage.getItem(INCOME_KEY) || '[]');
income = Array.isArray(income) ? income : [];
let initialBalance = Number(localStorage.getItem(INITIAL_BALANCE_KEY) || 0);
let expenseChart;
let investmentChart;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses: data.expenses, investments: data.investments }));
  localStorage.setItem(INCOME_KEY, JSON.stringify(income));
}

function snapshot() {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify({ initialBalance, income, expenses: data.expenses, investments: data.investments }));
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('is-visible', panel.id === tabName));
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === tabName));
  window.location.hash = tabName;
}

document.querySelectorAll('.nav-tab').forEach(tab => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
document.querySelectorAll('[data-go-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.goTab)));

function setDefaultDates() {
  document.querySelectorAll('input[type="date"][name="date"]').forEach(input => { if (!input.value) input.value = today(); });
  document.querySelector('#dashboard-date').textContent = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());
}

function totalIncome() { return income.reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function totalExpenses() { return data.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function investedCost(item) { return item.quantity && item.buyPrice ? Number(item.quantity) * Number(item.buyPrice) : Number(item.amount || 0); }
function totalInvested() { return data.investments.reduce((sum, item) => sum + investedCost(item), 0); }
function portfolioValue() { return data.investments.reduce((sum, item) => sum + Number(item.value || 0), 0); }
function availableBalance() { return initialBalance + totalIncome() - totalExpenses() - totalInvested(); }

function getFilteredExpenses() {
  const category = document.querySelector('#expense-category-filter').value;
  const from = document.querySelector('#expense-from').value;
  const to = document.querySelector('#expense-to').value;
  return data.expenses.filter(item => (!from || item.date >= from) && (!to || item.date <= to) && (category === 'all' || item.category === category)).sort((a, b) => b.date.localeCompare(a.date));
}

function renderExpenseList() {
  const list = getFilteredExpenses();
  const body = document.querySelector('#expense-list');
  body.innerHTML = list.map(item => `<tr><td>${item.date}</td><td><span class="category-pill">${item.category}</span></td><td>${item.note || '<span class="muted">No note</span>'}</td><td class="align-right">${money(item.amount)}</td><td class="align-right"><button class="action-button" title="Edit expense" data-edit-expense="${item.id}">✎</button><button class="action-button" title="Delete expense" data-delete-expense="${item.id}">×</button></td></tr>`).join('');
  document.querySelector('#expense-list-empty').style.display = list.length ? 'none' : 'block';
  document.querySelector('#expense-running-total').textContent = money(list.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  body.querySelectorAll('[data-delete-expense]').forEach(button => button.addEventListener('click', () => removeItem('expenses', button.dataset.deleteExpense)));
  body.querySelectorAll('[data-edit-expense]').forEach(button => button.addEventListener('click', () => editExpense(button.dataset.editExpense)));
}

function renderInvestmentList() {
  const body = document.querySelector('#investment-list');
  body.innerHTML = data.investments.slice().sort((a, b) => b.date.localeCompare(a.date)).map(item => `<tr><td>${item.name}</td><td><span class="category-pill">${item.type}</span></td><td>${item.date}</td><td class="align-right">${money(item.value)}</td><td class="align-right"><button class="action-button" title="Edit investment" data-edit-investment="${item.id}">✎</button><button class="action-button" title="Delete investment" data-delete-investment="${item.id}">×</button></td></tr>`).join('');
  document.querySelector('#investment-list-empty').style.display = data.investments.length ? 'none' : 'block';
  document.querySelector('#investment-running-total').textContent = money(portfolioValue());
  body.querySelectorAll('[data-delete-investment]').forEach(button => button.addEventListener('click', () => removeItem('investments', button.dataset.deleteInvestment)));
  body.querySelectorAll('[data-edit-investment]').forEach(button => button.addEventListener('click', () => editInvestment(button.dataset.editInvestment)));
}

function renderIncomeList() {
  const body = document.querySelector('#income-list');
  body.innerHTML = income.slice().sort((a, b) => b.date.localeCompare(a.date)).map(item => `<tr><td>${item.date}</td><td><span class="category-pill">${item.source}</span></td><td>${item.note || '<span class="muted">No note</span>'}</td><td class="align-right">${money(item.amount)}</td><td class="align-right"><button class="action-button" title="Edit income" data-edit-income="${item.id}">✎</button><button class="action-button" title="Delete income" data-delete-income="${item.id}">×</button></td></tr>`).join('');
  document.querySelector('#income-list-empty').style.display = income.length ? 'none' : 'block';
  document.querySelector('#income-running-total').textContent = money(totalIncome());
  document.querySelector('#total-income').textContent = money(totalIncome());
  document.querySelector('#income-count').textContent = `${income.length} entr${income.length === 1 ? 'y' : 'ies'}`;
  body.querySelectorAll('[data-delete-income]').forEach(button => button.addEventListener('click', () => removeItem('income', button.dataset.deleteIncome)));
  body.querySelectorAll('[data-edit-income]').forEach(button => button.addEventListener('click', () => editIncome(button.dataset.editIncome)));
}

function removeItem(collection, id) {
  if (collection === 'income') income = income.filter(item => item.id !== id);
  else data[collection] = data[collection].filter(item => item.id !== id);
  save(); snapshot(); renderAll(); showToast('Entry removed');
}

function fillForm(form, item) {
  Object.entries(item).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
  form.dataset.editing = item.id;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function editExpense(id) { const item = data.expenses.find(entry => entry.id === id); if (!item) return; activateTab('expenses'); fillForm(document.querySelector('#expense-form'), item); document.querySelector('#expense-form button').firstChild.textContent = 'Update expense '; }
function editInvestment(id) { const item = data.investments.find(entry => entry.id === id); if (!item) return; activateTab('investments'); fillForm(document.querySelector('#investment-form'), item); document.querySelector('#investment-form button').firstChild.textContent = 'Update investment '; }
function editIncome(id) { const item = income.find(entry => entry.id === id); if (!item) return; activateTab('income'); fillForm(document.querySelector('#income-form'), item); document.querySelector('#income-form button').firstChild.textContent = 'Update income '; }

function balanceAfterChange(collection, entry, editingId) {
  let balance = availableBalance();
  const oldCollection = collection === 'income' ? income : data[collection];
  const old = editingId ? oldCollection.find(item => item.id === editingId) : null;
  if (old) balance += collection === 'income' ? -Number(old.amount || 0) : Number(old.amount || 0);
  if (collection === 'income') balance += Number(entry.amount || 0);
  if (collection === 'expenses') balance -= Number(entry.amount || 0);
  if (collection === 'investments') balance -= investedCost(entry);
  return balance;
}

function formEntry(form, collection, fields) {
  const values = Object.fromEntries(fields.map(field => [field, form.elements[field].value]));
  const entry = { id: form.dataset.editing || crypto.randomUUID(), ...values };
  entry.amount = Number(entry.amount);
  if (collection === 'investments') entry.value = Number(entry.value);
  if (['expenses', 'investments'].includes(collection) && balanceAfterChange(collection, entry, form.dataset.editing) < 0 && !window.confirm('This will make your balance negative. Continue?')) return;
  const collectionData = collection === 'income' ? income : data[collection];
  const existingIndex = collectionData.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) collectionData[existingIndex] = entry; else collectionData.push(entry);
  save(); snapshot(); form.reset(); delete form.dataset.editing; setDefaultDates(); renderAll();
  form.querySelector('button').firstChild.textContent = collection === 'expenses' ? 'Save expense ' : collection === 'investments' ? 'Save investment ' : 'Save income ';
  showToast(existingIndex >= 0 ? 'Entry updated' : 'Entry saved');
}

document.querySelector('#expense-form').addEventListener('submit', event => { event.preventDefault(); formEntry(event.currentTarget, 'expenses', ['amount', 'category', 'date', 'note']); });
document.querySelector('#investment-form').addEventListener('submit', event => { event.preventDefault(); formEntry(event.currentTarget, 'investments', ['name', 'type', 'amount', 'value', 'date']); });
document.querySelector('#income-form').addEventListener('submit', event => { event.preventDefault(); formEntry(event.currentTarget, 'income', ['amount', 'source', 'date', 'note']); });
['#expense-category-filter', '#expense-from', '#expense-to'].forEach(selector => document.querySelector(selector).addEventListener('input', renderExpenseList));

function groupBy(items, key) {
  return items.reduce((groups, item) => { groups[item[key]] = (groups[item[key]] || 0) + (key === 'category' ? Number(item.amount || 0) : Number(item.value || 0)); return groups; }, {});
}

function drawChart(canvasId, emptyId, legendId, grouped, chartRef) {
  const labels = Object.keys(grouped);
  document.querySelector(`#${emptyId}`).style.display = labels.length ? 'none' : 'block';
  if (chartRef) chartRef.destroy();
  if (!labels.length || typeof Chart === 'undefined') return null;
  const colors = labels.map((_, index) => COLORS[index % COLORS.length]);
  const chart = new Chart(document.querySelector(`#${canvasId}`), { type: 'doughnut', data: { labels, datasets: [{ data: Object.values(grouped), backgroundColor: colors, borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ` ${money(context.raw)}` } } } } });
  document.querySelector(`#${legendId}`).innerHTML = labels.map((label, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${colors[index]}"></i>${label}</span>`).join('');
  return chart;
}

function renderDashboard() {
  const monthExpenses = data.expenses.filter(item => item.date.startsWith(currentMonth()));
  const monthExpenseTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const invested = totalInvested();
  const portfolio = portfolioValue();
  const balance = availableBalance();
  document.querySelector('#available-balance').textContent = money(balance);
  document.querySelector('#total-expenses').textContent = money(monthExpenseTotal);
  document.querySelector('#expense-count').textContent = `${monthExpenses.length} transaction${monthExpenses.length === 1 ? '' : 's'}`;
  document.querySelector('#total-invested').textContent = money(invested);
  document.querySelector('#investment-count').textContent = `${data.investments.length} position${data.investments.length === 1 ? '' : 's'}`;
  document.querySelector('#portfolio-value').textContent = money(portfolio);
  document.querySelector('#net-worth').textContent = money(balance + portfolio);
  const change = portfolio - invested;
  document.querySelector('#portfolio-change').textContent = data.investments.length ? `${change >= 0 ? '+' : ''}${money(change)} unrealized change` : 'Add investments to track value';
  document.querySelector('#available-balance').classList.toggle('negative-value', balance < 0);
  expenseChart = drawChart('expense-chart', 'expense-empty', 'expense-legend', groupBy(monthExpenses, 'category'), expenseChart);
  investmentChart = drawChart('investment-chart', 'investment-empty', 'investment-legend', groupBy(data.investments, 'type'), investmentChart);
}

function backupAge() {
  const date = localStorage.getItem(LAST_BACKUP_KEY);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

function exportData() {
  const backup = { initialBalance, income, expenses: data.expenses, investments: data.investments };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  link.download = `myfintrack-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  localStorage.removeItem(BACKUP_DISMISS_KEY);
  renderBackupReminder();
  showToast('Backup exported');
}

function renderBackupReminder() {
  const age = backupAge();
  const overdue = age === null || age >= 7;
  const banner = document.querySelector('#backup-banner');
  const dismissed = localStorage.getItem(BACKUP_DISMISS_KEY) === today();
  if (!overdue || dismissed) { banner.classList.remove('is-visible'); return; }
  document.querySelector('#backup-message').textContent = `⚠️ Last backup: ${age === null ? 'never' : `${age} day${age === 1 ? '' : 's'} ago`}. Export your data to avoid losing it.`;
  banner.classList.add('is-visible');
}

function maybePromptBackup() {
  if (localStorage.getItem(SETUP_KEY) !== 'true') return;
  const age = backupAge();
  if ((age === null || age >= 7) && localStorage.getItem(BACKUP_PROMPT_KEY) !== today()) {
    localStorage.setItem(BACKUP_PROMPT_KEY, today());
    if (window.confirm("It's been a while since your last backup. Export your data now?")) exportData();
  }
}

function restoreAutoBackup() {
  const snapshotData = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) || 'null');
  if (!snapshotData) { showToast('No auto-backup found'); return; }
  if (!window.confirm('Restore your data from the auto-backup?')) return;
  initialBalance = Number(snapshotData.initialBalance || 0);
  income = Array.isArray(snapshotData.income) ? snapshotData.income : [];
  data.expenses = Array.isArray(snapshotData.expenses) ? snapshotData.expenses : [];
  data.investments = Array.isArray(snapshotData.investments) ? snapshotData.investments : [];
  localStorage.setItem(INITIAL_BALANCE_KEY, initialBalance);
  save(); renderAll(); showToast('Auto-backup restored');
}

function resetApp() {
  if (!window.confirm('Reset MyFinTrack and delete all saved data?')) return;
  [STORAGE_KEY, INCOME_KEY, INITIAL_BALANCE_KEY, SETUP_KEY, AUTO_BACKUP_KEY, LAST_BACKUP_KEY, BACKUP_PROMPT_KEY, BACKUP_DISMISS_KEY].forEach(key => localStorage.removeItem(key));
  window.location.reload();
}

function setupApp() {
  document.querySelector('#setup-form').addEventListener('submit', event => {
    event.preventDefault();
    initialBalance = Number(event.currentTarget.elements.initialBalance.value);
    localStorage.setItem(INITIAL_BALANCE_KEY, initialBalance);
    localStorage.setItem(SETUP_KEY, 'true');
    snapshot();
    document.querySelector('#setup-modal').classList.remove('is-visible');
    renderAll();
  });
  document.querySelector('#settings-button').addEventListener('click', () => document.querySelector('#settings-modal').classList.add('is-visible'));
  document.querySelector('#close-settings').addEventListener('click', () => document.querySelector('#settings-modal').classList.remove('is-visible'));
  document.querySelector('#settings-export-button').addEventListener('click', exportData);
  document.querySelector('#export-now-button').addEventListener('click', exportData);
  document.querySelector('#dismiss-backup-button').addEventListener('click', () => { localStorage.setItem(BACKUP_DISMISS_KEY, today()); renderBackupReminder(); });
  document.querySelector('#restore-button').addEventListener('click', restoreAutoBackup);
  document.querySelector('#reset-button').addEventListener('click', resetApp);
  if (localStorage.getItem(SETUP_KEY) !== 'true') document.querySelector('#setup-modal').classList.add('is-visible');
}

function renderAll() { renderDashboard(); renderExpenseList(); renderInvestmentList(); renderIncomeList(); renderBackupReminder(); }

localStorage.setItem(INITIAL_BALANCE_KEY, initialBalance);
setDefaultDates();
activateTab(window.location.hash.slice(1) || 'dashboard');
setupApp();
renderAll();
maybePromptBackup();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
*/
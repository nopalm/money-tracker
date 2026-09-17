// ---------- Supabase Connection ----------
const SUPABASE_URL = 'https://eclscooqzqbrwtekcogb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbHNjb29xenFicnd0ZWtjb2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTc4MzgsImV4cCI6MjEwNTE5MzgzOH0.WjkDquD88No40bcIAHKp0Q9j83DmuXVgNDf1KBIIIjQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let transactions = [];
let categoriesList = [];
let reportMode = 'weekly';

// DOM Elements
const syncStatus = document.getElementById('sync-status');
const txModal = document.getElementById('transaction-modal');
const catModal = document.getElementById('category-modal');

// Modal Toggles
function openTransactionModal(tx = null) {
    document.getElementById('tx-id').value = tx ? tx.id : '';
    document.getElementById('tx-type').value = tx ? tx.type : 'expense';
    populateMajorCategories(tx ? tx.major_category : null);
    document.getElementById('tx-amount').value = tx ? tx.amount : '';
    document.getElementById('tx-date').value = tx ? tx.date : new Date().toISOString().split('T')[0];
    document.getElementById('tx-method').value = tx ? (tx.payment_method || 'Cash') : 'Cash';
    document.getElementById('tx-recurring').checked = tx ? tx.is_recurring : false;
    document.getElementById('tx-desc').value = tx ? (tx.description || '') : '';
    document.getElementById('tx-modal-title').textContent = tx ? 'Edit Transaction' : 'New Transaction';
    txModal.classList.remove('hidden');
}

function toggleTransactionModal(show) {
    if (!show) txModal.classList.add('hidden');
}

function toggleCategoryModal(show, cat = null) {
    document.getElementById('cat-id').value = cat ? cat.id : '';
    document.getElementById('cat-type').value = cat ? cat.type : 'expense';
    document.getElementById('cat-major').value = cat ? cat.major : '';
    document.getElementById('cat-sub').value = cat ? cat.sub : '';
    document.getElementById('cat-modal-title').textContent = cat ? 'Edit Category' : 'Add Category';
    if (show) catModal.classList.remove('hidden');
    else catModal.classList.add('hidden');
}

// Category Dropdown Population helpers
function populateMajorCategories(selectedMajor = null) {
    const type = document.getElementById('tx-type').value;
    const majorSelect = document.getElementById('tx-major');
    majorSelect.innerHTML = '';
    
    const majors = [...new Set(categoriesList.filter(c => c.type === type).map(c => c.major))];
    majors.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        majorSelect.appendChild(opt);
    });
    if (selectedMajor) majorSelect.value = selectedMajor;
    populateSubCategories();
}

function populateSubCategories(selectedSub = null) {
    const type = document.getElementById('tx-type').value;
    const major = document.getElementById('tx-major').value;
    const subSelect = document.getElementById('tx-sub');
    subSelect.innerHTML = '';

    const subs = categoriesList.filter(c => c.type === type && c.major === major).map(c => c.sub);
    subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subSelect.appendChild(opt);
    });
    if (selectedSub) subSelect.value = selectedSub;
}

document.getElementById('tx-major').addEventListener('change', () => populateSubCategories());

// Charts Setup
let incomeExpenseChart = new Chart(document.getElementById('incomeExpenseChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Income', 'Expense'], datasets: [{ data: [0, 0], backgroundColor: ['#10b981', '#ef4444'] }] },
    options: { responsive: true, maintainAspectRatio: false }
});

let categoryChart = new Chart(document.getElementById('categoryChart').getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Major Category (Rp)', data: [], backgroundColor: '#6366f1' }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
});

// Fetch Data from Supabase
async function loadData() {
    syncStatus.textContent = "Syncing...";
    
    const [catRes, txRes] = await Promise.all([
        supabaseClient.from('categories').select('*').order('major'),
        supabaseClient.from('transactions').select('*').order('date', { ascending: false })
    ]);

    if (catRes.error || txRes.error) {
        syncStatus.textContent = "Sync Error";
        syncStatus.className = "text-xs bg-red-700 text-white px-2.5 py-1 rounded-full font-medium";
    } else {
        categoriesList = catRes.data || [];
        transactions = txRes.data || [];
        syncStatus.textContent = "Synced";
        syncStatus.className = "text-xs bg-green-700 text-white px-2.5 py-1 rounded-full font-medium";
        renderCategoriesTable();
        renderApp();
    }
}

// Category CRUD Handlers
document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const payload = {
        type: document.getElementById('cat-type').value,
        major: document.getElementById('cat-major').value,
        sub: document.getElementById('cat-sub').value
    };

    let error;
    if (id) {
        ({ error } = await supabaseClient.from('categories').update(payload).eq('id', id));
    } else {
        ({ error } = await supabaseClient.from('categories').insert([payload]));
    }

    if (error) alert('Error saving category: ' + error.message);
    else {
        toggleCategoryModal(false);
        loadData();
    }
});

async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if (error) alert('Delete failed');
    else loadData();
}

function renderCategoriesTable() {
    const tbody = document.getElementById('category-table-body');
    tbody.innerHTML = '';
    categoriesList.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="py-2 text-xs"><span class="px-2 py-0.5 rounded ${c.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${c.type}</span></td>
            <td class="py-2 font-medium text-xs">${c.major}</td>
            <td class="py-2 text-xs text-gray-500">${c.sub}</td>
            <td class="py-2 text-right space-x-2">
                <button onclick='toggleCategoryModal(true, ${JSON.stringify(c)})' class="text-indigo-600 hover:underline text-xs">Edit</button>
                <button onclick="deleteCategory(${c.id})" class="text-red-600 hover:underline text-xs">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Transaction CRUD Handlers
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const payload = {
        type: document.getElementById('tx-type').value,
        major_category: document.getElementById('tx-major').value,
        sub_category: document.getElementById('tx-sub').value,
        amount: parseFloat(document.getElementById('tx-amount').value),
        date: document.getElementById('tx-date').value,
        payment_method: document.getElementById('tx-method').value,
        is_recurring: document.getElementById('tx-recurring').checked,
        description: document.getElementById('tx-desc').value
    };

    let error;
    if (id) {
        ({ error } = await supabaseClient.from('transactions').update(payload).eq('id', id));
    } else {
        ({ error } = await supabaseClient.from('transactions').insert([payload]));
    }

    if (error) alert('Error saving transaction: ' + error.message);
    else {
        toggleTransactionModal(false);
        loadData();
    }
});

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) alert('Delete failed');
    else loadData();
}

function formatRp(val) {
    return 'Rp ' + Number(val).toLocaleString('id-ID');
}

// Render Dashboard Analytics & Reports
function renderApp() {
    let totalIncome = 0;
    let totalExpense = 0;
    let majorTotals = {};

    const expenseMajors = [...new Set(categoriesList.filter(c => c.type === 'expense').map(c => c.major))];
    expenseMajors.forEach(m => majorTotals[m] = 0);

    const tbody = document.getElementById('transaction-table-body');
    tbody.innerHTML = '';

    transactions.forEach(t => {
        const amt = Number(t.amount);
        if (t.type === 'income') {
            totalIncome += amt;
        } else {
            totalExpense += amt;
            if (majorTotals[t.major_category] !== undefined) {
                majorTotals[t.major_category] += amt;
            } else {
                majorTotals[t.major_category] = amt; // Dynamic catch-all
            }
        }

        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="py-2.5 text-xs text-gray-500">${t.date}</td>
            <td class="py-2.5"><span class="px-2 py-0.5 rounded text-xs ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${t.type}</span></td>
            <td class="py-2.5 font-medium text-xs"><b>${t.major_category}</b> <span class="text-gray-400">/ ${t.sub_category}</span></td>
            <td class="py-2.5 text-xs text-gray-500">${t.payment_method || 'Cash'}</td>
            <td class="py-2.5 font-bold text-xs ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">${t.type === 'income' ? '+' : '-'}${formatRp(amt)}</td>
            <td class="py-2.5 text-right space-x-2">
                <button onclick='openTransactionModal(${JSON.stringify(t)})' class="text-indigo-600 hover:underline text-xs">Edit</button>
                <button onclick="deleteTransaction(${t.id})" class="text-red-600 hover:underline text-xs">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-income').textContent = formatRp(totalIncome);
    document.getElementById('total-expense').textContent = formatRp(totalExpense);
    const net = totalIncome - totalExpense;
    const netEl = document.getElementById('net-balance');
    netEl.textContent = formatRp(net);
    netEl.className = `text-2xl font-bold mt-1 ${net >= 0 ? 'text-indigo-600' : 'text-red-600'}`;

    incomeExpenseChart.data.datasets[0].data = [totalIncome, totalExpense];
    incomeExpenseChart.update();

    categoryChart.data.labels = Object.keys(majorTotals);
    categoryChart.data.datasets[0].data = Object.values(majorTotals);
    categoryChart.update();

    renderOverspending(majorTotals);
    renderReports();
}

function renderOverspending(currentMajorTotals) {
    const container = document.getElementById('overspending-alert-container');
    container.innerHTML = '';

    const baselineAverages = { "Food": 1500000, "Transportation": 900000, "Bills": 1200000, "Shopping": 800000 };
    let hasAlerts = false;

    for (let [cat, spent] of Object.entries(currentMajorTotals)) {
        const avg = baselineAverages[cat] || 1000000;
        const diffPercent = ((spent - avg) / avg) * 100;
        const isOver = spent > avg;

        if (spent > 0) {
            hasAlerts = true;
            const div = document.createElement('div');
            div.className = 'p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm';
            div.innerHTML = `
                <div class="flex justify-between mb-1">
                    <span class="font-semibold text-gray-700">${cat}</span>
                    <span class="${isOver ? 'text-red-600 font-bold' : 'text-gray-500'}">${formatRp(spent)} / Avg: ${formatRp(avg)} <span class="text-xs">(${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%)</span></span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${isOver ? 'bg-red-500' : 'bg-indigo-500'} h-2 rounded-full" style="width: ${Math.min((spent / avg) * 100, 100)}%"></div>
                </div>
                ${isOver ? '<p class="text-xs text-red-500 mt-1 font-medium">🔴 Overspending detected relative to baseline!</p>' : ''}
            `;
            container.appendChild(div);
        }
    }

    if (!hasAlerts) {
        container.innerHTML = '<p class="text-sm text-gray-400">No expense records found.</p>';
    }
}

function setReportMode(mode) {
    reportMode = mode;
    document.getElementById('btn-weekly').className = mode === 'weekly' ? 'px-3 py-1 text-xs rounded-md bg-white shadow-sm font-medium text-indigo-600 transition' : 'px-3 py-1 text-xs rounded-md text-gray-600 font-medium transition';
    document.getElementById('btn-monthly').className = mode === 'monthly' ? 'px-3 py-1 text-xs rounded-md bg-white shadow-sm font-medium text-indigo-600 transition' : 'px-3 py-1 text-xs rounded-md text-gray-600 font-medium transition';
    renderReports();
}

function renderReports() {
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';
    let grouped = {};

    transactions.forEach(t => {
        let d = new Date(t.date);
        let key = reportMode === 'monthly' 
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : `${d.getFullYear()}-W${Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + new Date(d.getFullYear(),0,1).getDay() + 1) / 7)}`;

        if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
        if (t.type === 'income') grouped[key].income += Number(t.amount);
        else grouped[key].expense += Number(t.amount);
    });

    const keys = Object.keys(grouped).sort().reverse();
    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-3 text-gray-400 text-center text-xs">No records found.</td></tr>`;
        return;
    }

    keys.forEach(k => {
        const item = grouped[k];
        const net = item.income - item.expense;
        const savingsRate = item.income > 0 ? ((net / item.income) * 100).toFixed(1) : 0;
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML = `
            <td class="py-2.5 font-medium text-xs">${k}</td>
            <td class="py-2.5 text-green-600 text-xs">+${formatRp(item.income)}</td>
            <td class="py-2.5 text-red-600 text-xs">-${formatRp(item.expense)}</td>
            <td class="py-2.5 text-xs font-bold ${net >= 0 ? 'text-indigo-600' : 'text-red-600'}">${formatRp(net)} <span class="text-[10px] text-gray-400 font-normal">(${savingsRate}% savings)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Initial Boot
loadData();
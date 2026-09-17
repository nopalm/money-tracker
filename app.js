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

// Charts Setup (Monochrome palette)
let incomeExpenseChart = new Chart(document.getElementById('incomeExpenseChart').getContext('2d'), {
    type: 'doughnut',
    data: { 
        labels: ['Income', 'Expense'], 
        datasets: [{ 
            data: [0, 0], 
            backgroundColor: ['#111111', '#d4d4d4'],
            borderColor: '#ffffff',
            borderWidth: 2
        }] 
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { family: 'sans-serif', size: 10 }, boxWidth: 12 } } }
    }
});

let categoryChart = new Chart(document.getElementById('categoryChart').getContext('2d'), {
    type: 'bar',
    data: { 
        labels: [], 
        datasets: [{ 
            label: 'Major Category (Rp)', 
            data: [], 
            backgroundColor: '#111111' 
        }] 
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        scales: { 
            y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        },
        plugins: { legend: { display: false } }
    }
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
        syncStatus.className = "text-[10px] uppercase tracking-wider bg-zinc-800 border border-zinc-600 text-white px-3 py-1 rounded-full font-medium";
    } else {
        categoriesList = catRes.data || [];
        transactions = txRes.data || [];
        syncStatus.textContent = "Synced";
        syncStatus.className = "text-[10px] uppercase tracking-wider bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1 rounded-full font-medium";
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
        tr.className = 'hover:bg-zinc-50';
        tr.innerHTML = `
            <td class="py-2.5 text-[10px] uppercase tracking-wider"><span class="px-2 py-0.5 border ${c.type === 'income' ? 'border-black text-black font-semibold' : 'border-zinc-300 text-zinc-500'}">${c.type}</span></td>
            <td class="py-2.5 font-medium text-xs text-black">${c.major}</td>
            <td class="py-2.5 text-xs text-zinc-500">${c.sub}</td>
            <td class="py-2.5 text-right space-x-3">
                <button onclick='toggleCategoryModal(true, ${JSON.stringify(c)})' class="text-black hover:underline text-[10px] uppercase tracking-wider font-semibold">Edit</button>
                <button onclick="deleteCategory(${c.id})" class="text-zinc-400 hover:text-black hover:underline text-[10px] uppercase tracking-wider font-semibold">Delete</button>
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
        tr.className = 'hover:bg-zinc-50';
        tr.innerHTML = `
            <td class="py-3 text-xs text-zinc-500">${t.date}</td>
            <td class="py-3 text-[10px] uppercase tracking-wider"><span class="px-2 py-0.5 border ${t.type === 'income' ? 'border-black text-black font-semibold' : 'border-zinc-300 text-zinc-500'}">${t.type}</span></td>
            <td class="py-3 font-medium text-xs text-black"><b>${t.major_category}</b> <span class="text-zinc-400 font-light">/ ${t.sub_category}</span></td>
            <td class="py-3 text-xs text-zinc-500">${t.payment_method || 'Cash'}</td>
            <td class="py-3 font-medium text-xs text-black">${t.type === 'income' ? '+' : '-'}${formatRp(amt)}</td>
            <td class="py-3 text-right space-x-3">
                <button onclick='openTransactionModal(${JSON.stringify(t)})' class="text-black hover:underline text-[10px] uppercase tracking-wider font-semibold">Edit</button>
                <button onclick="deleteTransaction(${t.id})" class="text-zinc-400 hover:text-black hover:underline text-[10px] uppercase tracking-wider font-semibold">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-income').textContent = formatRp(totalIncome);
    document.getElementById('total-expense').textContent = formatRp(totalExpense);
    const net = totalIncome - totalExpense;
    const netEl = document.getElementById('net-balance');
    netEl.textContent = formatRp(net);

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
            div.className = 'p-3 bg-zinc-50 border border-zinc-200 text-xs';
            div.innerHTML = `
                <div class="flex justify-between mb-2">
                    <span class="font-bold text-black uppercase tracking-wider">${cat}</span>
                    <span class="${isOver ? 'text-black font-bold underline' : 'text-zinc-600'}">${formatRp(spent)} / Avg: ${formatRp(avg)} <span class="text-[10px]">(${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%)</span></span>
                </div>
                <div class="w-full bg-zinc-200 h-1">
                    <div class="${isOver ? 'bg-black' : 'bg-zinc-500'} h-1" style="width: ${Math.min((spent / avg) * 100, 100)}%"></div>
                </div>
                ${isOver ? '<p class="text-[10px] text-black tracking-widest uppercase mt-2 font-bold">&bull; Over baseline threshold</p>' : ''}
            `;
            container.appendChild(div);
        }
    }

    if (!hasAlerts) {
        container.innerHTML = '<p class="text-xs text-zinc-400 font-light">No expense records found.</p>';
    }
}

function setReportMode(mode) {
    reportMode = mode;
    document.getElementById('btn-weekly').className = mode === 'weekly' ? 'px-3 py-1 text-[10px] uppercase tracking-wider bg-black text-white font-semibold transition' : 'px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold transition';
    document.getElementById('btn-monthly').className = mode === 'monthly' ? 'px-3 py-1 text-[10px] uppercase tracking-wider bg-black text-white font-semibold transition' : 'px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold transition';
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
        tbody.innerHTML = `<tr><td colspan="4" class="py-3 text-zinc-400 text-center text-xs font-light">No records found.</td></tr>`;
        return;
    }

    keys.forEach(k => {
        const item = grouped[k];
        const net = item.income - item.expense;
        const savingsRate = item.income > 0 ? ((net / item.income) * 100).toFixed(1) : 0;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-50';
        tr.innerHTML = `
            <td class="py-3 font-medium text-xs text-black">${k}</td>
            <td class="py-3 text-black text-xs">+${formatRp(item.income)}</td>
            <td class="py-3 text-zinc-500 text-xs">-${formatRp(item.expense)}</td>
            <td class="py-3 text-xs font-bold text-black">${formatRp(net)} <span class="text-[10px] text-zinc-400 font-light">(${savingsRate}% savings)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Initial Boot
loadData();
document.addEventListener('DOMContentLoaded', () => {
    // --- Globals ---
    let encryptionKey = null;
    let decryptedTransactions = [];
    let charts = {};
    const mainContainer = document.getElementById('main-container');

    // --- Main Application Flow ---
    function init() {
        showPasswordPrompt();
    }

    function showPasswordPrompt() {
        mainContainer.innerHTML = `
            <div class="card" id="password-prompt">
              <div class="card-body text-center py-4">
                <h3 class="mb-4">Welcome to FinSet</h3>
                <p class="text-muted" id="password-message">Please enter your password to unlock your data.</p>
                <div class="mx-auto mt-4" style="max-width: 300px;">
                    <input type="password" class="form-control form-control-lg" id="password-input" placeholder="Enter your password...">
                    <button type="button" class="btn btn-primary w-100 mt-3" id="password-submit-btn">Unlock</button>
                </div>
                 <div class="text-danger mt-3">
                  <strong>Important:</strong> This password cannot be recovered. Forgetting it means losing all your data.
                </div>
              </div>
            </div>`;
        
        document.getElementById('password-submit-btn').addEventListener('click', handlePasswordSubmit);
        if (localStorage.getItem('salt')) {
            document.getElementById('password-message').textContent = 'Please enter your password to unlock your financial data.';
        }
    }

    async function handlePasswordSubmit() {
        const password = document.getElementById('password-input').value;
        if (!password) return;
        
        const salt = security.getSalt();
        encryptionKey = security.deriveKey(password, salt);
        
        await db.init();
        const transactions = await db.getTransactions();
        decryptedTransactions = transactions.map(t => ({
            id: t.id,
            ...security.decrypt(t.data, encryptionKey)
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        setupNavigation();
        showDashboard();
    }

    function setupNavigation() {
        document.getElementById('nav-dashboard').addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
        document.getElementById('nav-reports').addEventListener('click', (e) => { e.preventDefault(); showReports(); });
        // Add listeners for transactions and settings if needed
    }

    // --- Dashboard ---
    function showDashboard() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const today = new Date();

        mainContainer.innerHTML = `
            <div class="page-header">
              <div class="row align-items-center">
                <div class="col">
                  <h2 class="page-title">Dashboard</h2>
                  <div class="text-muted mt-1">Analytics for the selected period.</div>
                </div>
                <div class="col-md-auto ms-auto d-print-none">
                   <div class="form-group">
                       <label class="form-label">Date Range</label>
                       <input type="text" id="date-range-picker" class="form-control">
                   </div>
                </div>
              </div>
            </div>
            <div class="row row-deck row-cards mt-3" id="dashboard-content">
                </div>`;
        
        const picker = new Litepicker({
            element: document.getElementById('date-range-picker'),
            singleMode: false,
            numberOfMonths: 2,
            format: 'MMM D, YYYY',
            startDate: sixMonthsAgo,
            endDate: today,
            setup: (picker) => {
                picker.on('selected', (date1, date2) => {
                    renderDashboardContent(date1.dateInstance, date2.dateInstance);
                });
            },
        });

        renderDashboardContent(sixMonthsAgo, today);
    }

    function renderDashboardContent(startDate, endDate) {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        // 1. Filter Data
        const filteredData = decryptedTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        });

        // 2. Prepare Data for Components
        // Income vs Expense Chart Data
        const monthlySummary = {};
        filteredData.forEach(t => {
            const month = new Date(t.date).toISOString().slice(0, 7); // YYYY-MM
            if (!monthlySummary[month]) {
                monthlySummary[month] = { income: 0, expense: 0 };
            }
            if (t.type === 'income') monthlySummary[month].income += t.amount;
            else monthlySummary[month].expense += t.amount;
        });
        const incomeExpenseData = {
            labels: Object.keys(monthlySummary),
            income: Object.values(monthlySummary).map(m => m.income),
            expense: Object.values(monthlySummary).map(m => m.expense),
        };
        
        // Trend Chart Data
        let runningBalance = 0;
        const trendData = filteredData.map(t => {
            runningBalance += t.type === 'income' ? t.amount : -t.amount;
            return { x: new Date(t.date).toLocaleDateString(), y: runningBalance };
        });

        // Expense & Income Tables Data
        const expenses = filteredData.filter(t => t.type === 'expense').sort((a,b) => b.amount - a.amount);
        const incomes = filteredData.filter(t => t.type === 'income').sort((a,b) => b.amount - a.amount);

        // 3. Render HTML
        container.innerHTML = `
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-body">
                        <h3 class="card-title">Income vs Expense</h3>
                        <div class="chart-container"><canvas id="incomeExpenseChart"></canvas></div>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-body">
                        <h3 class="card-title">Net Worth Trend</h3>
                        <div class="chart-container"><canvas id="trendChart"></canvas></div>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card" style="max-height: 400px; overflow-y: auto;">
                    <div class="card-header"><h3 class="card-title">Top Expenses</h3></div>
                    <table class="table card-table table-vcenter">
                        <thead><tr><th>Category</th><th>Date</th><th>Amount</th></tr></thead>
                        <tbody>${expenses.map(t => `<tr><td>${t.category}</td><td>${new Date(t.date).toLocaleDateString()}</td><td class="text-danger">-$${t.amount.toFixed(2)}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card" style="max-height: 400px; overflow-y: auto;">
                    <div class="card-header"><h3 class="card-title">Top Incomes</h3></div>
                    <table class="table card-table table-vcenter">
                        <thead><tr><th>Source</th><th>Date</th><th>Amount</th></tr></thead>
                        <tbody>${incomes.map(t => `<tr><td>${t.category}</td><td>${new Date(t.date).toLocaleDateString()}</td><td class="text-success">+$${t.amount.toFixed(2)}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;

        // 4. Render Charts
        destroyCharts(); // Clear old charts before rendering new ones
        charts.incomeExpense = new Chart(document.getElementById('incomeExpenseChart'), {
            type: 'bar',
            data: {
                labels: incomeExpenseData.labels,
                datasets: [
                    { label: 'Income', data: incomeExpenseData.income, backgroundColor: '#206bc4' },
                    { label: 'Expense', data: incomeExpenseData.expense, backgroundColor: '#d63939' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });

        charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Net Worth',
                    data: trendData,
                    borderColor: '#2fb344',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'category' } } }
        });
    }

    // --- Reports ---
    function showReports() {
        mainContainer.innerHTML = `
            <div class="page-header">
                <h2 class="page-title">Generate Reports</h2>
            </div>
            <div class="card mt-3">
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-6">
                            <label class="form-label">Select Date Range for Report</label>
                            <input type="text" id="report-date-picker" class="form-control">
                        </div>
                        <div class="col-md-auto">
                            <button class="btn btn-success" id="download-csv-btn">Download CSV</button>
                        </div>
                        <div class="col-md-auto">
                            <button class="btn btn-danger" id="download-pdf-btn">Download PDF</button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        let reportStartDate = new Date();
        reportStartDate.setMonth(reportStartDate.getMonth() - 1);
        let reportEndDate = new Date();

        const picker = new Litepicker({
            element: document.getElementById('report-date-picker'),
            singleMode: false,
            numberOfMonths: 2,
            format: 'MMM D, YYYY',
            startDate: reportStartDate,
            endDate: reportEndDate,
            setup: (picker) => {
                picker.on('selected', (date1, date2) => {
                    reportStartDate = date1.dateInstance;
                    reportEndDate = date2.dateInstance;
                });
            },
        });

        document.getElementById('download-csv-btn').addEventListener('click', () => {
            downloadCSV(reportStartDate, reportEndDate);
        });

        document.getElementById('download-pdf-btn').addEventListener('click', () => {
            downloadPDF(reportStartDate, reportEndDate);
        });
    }

    function downloadCSV(startDate, endDate) {
        const filteredData = decryptedTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        }).map(t => ({
            Date: new Date(t.date).toLocaleDateString(),
            Category: t.category,
            Type: t.type,
            Amount: t.amount,
            Description: t.description || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
        XLSX.writeFile(workbook, `Transactions_${startDate.toISOString().slice(0,10)}_to_${endDate.toISOString().slice(0,10)}.xlsx`);
    }

    function downloadPDF(startDate, endDate) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const filteredData = decryptedTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        });
        
        const tableBody = filteredData.map(t => ([
            new Date(t.date).toLocaleDateString(),
            t.category,
            t.type,
            t.type === 'income' ? `+${t.amount.toFixed(2)}` : `-${t.amount.toFixed(2)}`
        ]));
        
        doc.text(`Transaction Report`, 14, 15);
        doc.setFontSize(10);
        doc.text(`From: ${startDate.toLocaleDateString()} To: ${endDate.toLocaleDateString()}`, 14, 20);

        doc.autoTable({
            startY: 25,
            head: [['Date', 'Category', 'Type', 'Amount']],
            body: tableBody,
        });

        doc.save(`Report_${startDate.toISOString().slice(0,10)}_to_${endDate.toISOString().slice(0,10)}.pdf`);
    }

    // --- Utility Functions ---
    function destroyCharts() {
        Object.values(charts).forEach(chart => chart.destroy());
    }

    // --- Initial Load ---
    init();
});

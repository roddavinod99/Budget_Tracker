document.addEventListener('DOMContentLoaded', () => {
  let encryptionKey = null;

  const passwordPrompt = document.getElementById('password-prompt');
  const mainContent = document.getElementById('main-content');
  const passwordInput = document.getElementById('password-input');
  const passwordSubmitBtn = document.getElementById('password-submit-btn');
  const passwordMessage = document.getElementById('password-message');

  const navDashboard = document.getElementById('nav-dashboard');
  const navTransactions = document.getElementById('nav-transactions');
  const navSettings = document.getElementById('nav-settings');
  const pageTitle = document.getElementById('page-title');

  const addTransactionForm = document.getElementById('add-transaction-form');
  const saveTransactionBtn = document.getElementById('save-transaction-btn');


  // Check if a salt exists to customize the password prompt message
  if (localStorage.getItem('salt')) {
    passwordMessage.textContent = 'Please enter your password to unlock your financial data.';
  }

  passwordSubmitBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (password) {
      const salt = security.getSalt();
      encryptionKey = security.deriveKey(password, salt);
      passwordPrompt.classList.add('d-none');
      mainContent.classList.remove('d-none');
      await db.init();
      showDashboard();
    }
  });

  navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
  navTransactions.addEventListener('click', (e) => { e.preventDefault(); showTransactions(); });
  navSettings.addEventListener('click', (e) => { e.preventDefault(); showSettings(); });

  async function showDashboard() {
    pageTitle.textContent = 'Dashboard';

    const transactions = await db.getTransactions();
    const decryptedTransactions = transactions.map(t => ({
        id: t.id,
        ...security.decrypt(t.data, encryptionKey)
    }));

    // --- Data Processing for Dashboard ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthTransactions = decryptedTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    const totalIncome = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const netIncome = totalIncome - totalExpenses;

    const expenseByCategory = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {});

    const sortedExpenses = Object.entries(expenseByCategory)
        .sort(([,a],[,b]) => b-a)
        .slice(0, 5); // Top 5 categories

    const recentTransactions = decryptedTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);


    mainContent.innerHTML = `
    <div class="row row-deck row-cards">
        <div class="col-sm-6 col-lg-4">
            <div class="card">
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <div class="subheader">Total Income</div>
                    </div>
                    <div class="h1 mb-3">$${totalIncome.toFixed(2)}</div>
                    <div class="d-flex mb-2">
                        <div>This Month</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-sm-6 col-lg-4">
            <div class="card">
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <div class="subheader">Total Expenses</div>
                    </div>
                    <div class="h1 mb-3">$${totalExpenses.toFixed(2)}</div>
                    <div class="d-flex mb-2">
                        <div>This Month</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-sm-6 col-lg-4">
            <div class="card">
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <div class="subheader">Net Income</div>
                    </div>
                    <div class="h1 mb-3 ${netIncome >= 0 ? 'text-success' : 'text-danger'}">$${netIncome.toFixed(2)}</div>
                     <div class="d-flex mb-2">
                        <div>This Month</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-7">
            <div class="card">
                <div class="card-body">
                    <h3 class="card-title">Income vs. Expense (Last 6 Months)</h3>
                    <div class="chart-container">
                        <canvas id="incomeExpenseChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-5">
            <div class="card">
                <div class="card-body">
                    <h3 class="card-title">Top Expense Categories (This Month)</h3>
                    <div class="chart-container">
                        <canvas id="expenseCategoryChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Transactions</h3>
                </div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter text-nowrap datatable">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentTransactions.map(t => `
                            <tr>
                                <td><span class="badge bg-${t.type === 'income' ? 'success' : 'danger'}-lt">${t.type}</span></td>
                                <td>${t.category}</td>
                                <td>$${t.amount.toFixed(2)}</td>
                                <td>${new Date(t.date).toLocaleDateString()}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;

    // --- Render Charts ---

    // Income vs Expense Chart
    const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
    const monthlyData = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.toLocaleString('default', { month: 'short' });
        monthlyData[month] = { income: 0, expense: 0 };
    }

    decryptedTransactions.forEach(t => {
        const tDate = new Date(t.date);
        const month = tDate.toLocaleString('default', { month: 'short' });
        if (monthlyData[month]) {
            if (t.type === 'income') monthlyData[month].income += t.amount;
            if (t.type === 'expense') monthlyData[month].expense += t.amount;
        }
    });

    new Chart(incomeExpenseCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [{
                label: 'Income',
                data: Object.values(monthlyData).map(d => d.income),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
            }, {
                label: 'Expense',
                data: Object.values(monthlyData).map(d => d.expense),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });

    // Expense Category Chart
    const expenseCategoryCtx = document.getElementById('expenseCategoryChart').getContext('2d');
    new Chart(expenseCategoryCtx, {
        type: 'doughnut',
        data: {
            labels: sortedExpenses.map(([category]) => category),
            datasets: [{
                label: 'Expenses',
                data: sortedExpenses.map(([, amount]) => amount),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });
  }

  async function showTransactions() {
    pageTitle.textContent = 'Transactions';
    const transactions = await db.getTransactions();
    const decryptedTransactions = transactions.map(t => ({
        id: t.id,
        ...security.decrypt(t.data, encryptionKey)
    }));


    let transactionsHtml = `
      <div class="card">
        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Date</th>
                <th>Description</th>
                <th class="w-1"></th>
              </tr>
            </thead>
            <tbody>
    `;

    decryptedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    decryptedTransactions.forEach(t => {
      transactionsHtml += `
        <tr>
          <td><span class="badge bg-${t.type === 'income' ? 'success' : 'danger'}-lt">${t.type}</span></td>
          <td>$${t.amount.toFixed(2)}</td>
          <td>${t.category}</td>
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${t.description || ''}</td>
          <td>
            <a href="#" class="btn btn-sm btn-ghost-danger btn-delete-transaction" data-id="${t.id}">Delete</a>
          </td>
        </tr>
      `;
    });

    transactionsHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    mainContent.innerHTML = transactionsHtml;

    document.querySelectorAll('.btn-delete-transaction').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            const transactionId = parseInt(e.target.dataset.id);
            if (confirm('Are you sure you want to delete this transaction?')) {
                await db.deleteTransaction(transactionId);
                showTransactions();
            }
        });
    });
  }

  function showSettings() {
    pageTitle.textContent = 'Settings';
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Data Management</h3>
            </div>
            <div class="card-body">
                <div class="row g-4">
                    <div class="col-md-6">
                        <h4>Export Data</h4>
                        <p>Export all your transaction data to a spreadsheet file (XLSX). This is useful for creating backups or for analysis in other software.</p>
                        <button class="btn btn-success" id="export-csv-btn">Export to XLSX</button>
                    </div>
                    <div class="col-md-6">
                        <h4>Import Data (from Backup)</h4>
                        <p>Import a previously created encrypted backup file to restore your data. <strong>Warning:</strong> This will overwrite any existing data.</p>
                        <div class="input-group">
                            <input type="file" id="import-file-input" class="form-control" accept=".json">
                            <button class="btn btn-warning" id="import-json-btn">Import</button>
                        </div>
                    </div>
                </div>
                 <hr class="my-4">
                <div class="row mt-4">
                    <div class="col">
                        <h4>Create Backup</h4>
                        <p>Create a secure, encrypted backup of all your data. Store this file in a safe place. This is the only way to move your data to another computer or browser.</p>
                        <button class="btn btn-info" id="backup-btn">Create Encrypted Backup</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('export-csv-btn').addEventListener('click', async () => {
        const transactions = await db.getTransactions();
        const decryptedTransactions = transactions.map(t => {
            const data = security.decrypt(t.data, encryptionKey);
            return {
                Type: data.type,
                Amount: data.amount,
                Category: data.category,
                Date: new Date(data.date).toLocaleDateString(),
                Description: data.description
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(decryptedTransactions);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
        XLSX.writeFile(workbook, "Finance_Tracker_Export.xlsx");
    });
    
    document.getElementById('backup-btn').addEventListener('click', async () => {
        const transactions = await db.getTransactions();
        const dataStr = JSON.stringify(transactions);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-json-btn').addEventListener('click', () => {
        const fileInput = document.getElementById('import-file-input');
        if (fileInput.files.length > 0) {
            if(confirm("Are you sure you want to import this file? This will overwrite all current data.")) {
                const file = fileInput.files[0];
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const transactions = JSON.parse(e.target.result);
                        if(!Array.isArray(transactions) || (transactions.length > 0 && !transactions[0].data)) {
                            throw new Error("Invalid backup file format.");
                        }
                        
                        // Clear existing transactions first
                        const allTransactions = await db.getTransactions();
                        for (const t of allTransactions) {
                            await db.deleteTransaction(t.id);
                        }

                        // Use a transaction for bulk import
                        const trans = db.db.transaction(['transactions'], 'readwrite');
                        const store = trans.objectStore('transactions');
                        for (const t of transactions) {
                           store.add({ data: t.data }); 
                        }

                        trans.oncomplete = () => {
                            alert('Data imported successfully!');
                            showDashboard();
                        };
                        trans.onerror = (event) => {
                            alert('An error occurred during import: ' + event.target.error);
                        }

                    } catch(err) {
                        alert("Failed to import backup: " + err.message);
                    }
                };
                reader.readAsText(file);
            }
        } else {
            alert('Please select a backup file to import.');
        }
    });

  }

  saveTransactionBtn.addEventListener('click', async () => {
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const category = document.getElementById('transaction-category').value;
    const date = document.getElementById('transaction-date').value;
    const description = document.getElementById('transaction-description').value;

    if (amount && category && date) {
      const transactionData = {
        type,
        amount,
        category,
        date,
        description
      };

      const encryptedData = security.encrypt(transactionData, encryptionKey);
      await db.addTransaction({ data: encryptedData });

      // Hide the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('modal-add-transaction'));
      modal.hide();

      addTransactionForm.reset();
      showDashboard(); // Refresh dashboard after adding transaction
    } else {
      alert('Please fill in all required fields.');
    }
  });

});

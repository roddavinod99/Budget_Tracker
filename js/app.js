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

  navDashboard.addEventListener('click', () => showDashboard());
  navTransactions.addEventListener('click', () => showTransactions());
  navSettings.addEventListener('click', () => showSettings());

  function showDashboard() {
    pageTitle.textContent = 'Dashboard';
    mainContent.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h3 class="card-title">Welcome to your Personal Finance Tracker</h3>
          <p class="text-muted">Use the menu to navigate through the application. You can add new transactions, view your transaction history, and manage your settings.</p>
        </div>
      </div>
    `;
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
          <td>${t.type}</td>
          <td>$${t.amount.toFixed(2)}</td>
          <td>${t.category}</td>
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${t.description}</td>
          <td>
            <a href="#" class="btn-delete-transaction" data-id="${t.id}">Delete</a>
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
                <div class="row">
                    <div class="col-md-6">
                        <h4>Export Data</h4>
                        <p>Export all your transaction data to a CSV file. This is useful for creating backups or for analysis in other software.</p>
                        <button class="btn btn-success" id="export-csv-btn">Export to CSV</button>
                    </div>
                    <div class="col-md-6">
                        <h4>Import Data (Backup)</h4>
                        <p>Import a previously exported JSON backup file to restore your data. <strong>Warning:</strong> This will overwrite any existing data.</p>
                        <input type="file" id="import-file-input" class="form-control">
                        <button class="btn btn-warning mt-2" id="import-json-btn">Import from Backup</button>
                    </div>
                </div>
                 <hr>
                <div class="row mt-4">
                    <div class="col">
                        <h4>Backup Your Data</h4>
                        <p>Create a secure, encrypted backup of all your data. Store this file in a safe place.</p>
                        <button class="btn btn-info" id="backup-btn">Create Encrypted Backup</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('export-csv-btn').addEventListener('click', async () => {
        const transactions = await db.getTransactions();
        const decryptedTransactions = transactions.map(t => security.decrypt(t.data, encryptionKey));

        const worksheet = XLSX.utils.json_to_sheet(decryptedTransactions);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
        XLSX.writeFile(workbook, "transactions.xlsx");
    });
    
    document.getElementById('backup-btn').addEventListener('click', async () => {
        const transactions = await db.getTransactions();
        const dataStr = JSON.stringify(transactions);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'finance_tracker_backup.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-json-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('import-file-input');
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = async (e) => {
                const transactions = JSON.parse(e.target.result);
                // Clear existing transactions first
                const allTransactions = await db.getTransactions();
                for (const t of allTransactions) {
                    await db.deleteTransaction(t.id);
                }
                // Import new transactions
                for (const t of transactions) {
                    await db.addTransaction({data: t.data}); // Re-add with existing structure
                }
                alert('Data imported successfully!');
                showTransactions();
            };
            reader.readAsText(file);
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
      showTransactions();
    } else {
      alert('Please fill in all required fields.');
    }
  });

});

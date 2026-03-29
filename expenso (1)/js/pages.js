/* ══════════════════════════════════════════════════════════════
   PAGES — All Page Renderers
   ══════════════════════════════════════════════════════════════ */

const Pages = (() => {

  // ══════════ DASHBOARD ══════════
  function dashboard(el) {
    const user = App.currentUser;
    const expenses = Store.getExpenses();
    const users = Store.getUsers();
    const company = Store.getCompany();
    const bc = company.baseCurrency || 'INR';

    let filtered = expenses;
    if (user.role === 'employee') filtered = expenses.filter(e => e.userId === user.id);
    if (user.role === 'manager') {
      const reportIds = users.filter(u => u.manager === user.id).map(u => u.id);
      reportIds.push(user.id);
      filtered = expenses.filter(e => reportIds.includes(e.userId));
    }

    const pending = filtered.filter(e => e.status === 'PENDING');
    const approved = filtered.filter(e => e.status === 'APPROVED');
    const rejected = filtered.filter(e => e.status === 'REJECTED');
    const totalApproved = approved.reduce((s, e) => s + (e.convertedAmount || 0), 0);
    const totalPending = pending.reduce((s, e) => s + (e.convertedAmount || 0), 0);
    const recent = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    // Category breakdown
    const catMap = {};
    approved.forEach(e => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + (e.convertedAmount || 0); });

    el.innerHTML = `
      <div class="page-header animate-in">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Welcome back, ${user.name.split(' ')[0]} — here's your expense overview</p>
      </div>

      <div class="stats-grid animate-stagger">
        <div class="glass-card stat-card">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value stat-neon">${filtered.length}</div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-label">Pending Review</div>
          <div class="stat-value stat-orange">${pending.length}</div>
          <div class="stat-sub">${UI.fmtCurr(totalPending, bc)}</div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-label">Approved</div>
          <div class="stat-value stat-green">${approved.length}</div>
          <div class="stat-sub">${UI.fmtCurr(totalApproved, bc)}</div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-label">Rejected</div>
          <div class="stat-value stat-red">${rejected.length}</div>
        </div>
      </div>

      <div class="content-grid-2">
        <div class="glass-card animate-in" style="animation-delay:0.2s">
          <div class="glass-card-title">Recent Activity</div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th>
                <th>Description</th>
                ${user.role !== 'employee' ? '<th>Employee</th>' : ''}
                <th style="text-align:right">Amount</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                ${recent.map(e => {
                  const emp = users.find(u => u.id === e.userId);
                  return `<tr>
                    <td>${UI.fmtDate(e.date)}</td>
                    <td><div style="font-weight:500">${e.description}</div></td>
                    ${user.role !== 'employee' ? `<td class="td-meta">${emp ? emp.name : '?'}</td>` : ''}
                    <td class="td-amount">
                      <div class="amount-primary">${UI.fmtCurr(e.convertedAmount, e.baseCurrency)}</div>
                      ${e.currency !== e.baseCurrency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
                    </td>
                    <td>${UI.statusBadge(e.status)}</td>
                  </tr>`;
                }).join('')}
                ${recent.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-4);padding:24px">No expenses yet</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card animate-in" style="animation-delay:0.3s">
          <div class="glass-card-title">Spending by Category</div>
          ${Object.keys(catMap).length === 0
            ? '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">No approved expenses yet</div></div>'
            : Object.entries(catMap).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
                const pct = totalApproved > 0 ? Math.round((amt / totalApproved) * 100) : 0;
                return `<div class="cat-bar-row">
                  <div class="cat-bar-header">
                    <span class="cat-bar-name">${cat}</span>
                    <span class="cat-bar-value">${UI.fmtCurr(amt, bc)} (${pct}%)</span>
                  </div>
                  <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
                </div>`;
              }).join('')}
        </div>
      </div>`;
  }

  // ══════════ COMPANY SETUP (Admin) ══════════
  async function companySetup(el) {
    const company = Store.getCompany();

    el.innerHTML = `
      <div class="page-header animate-in">
        <h1 class="page-title">Company Setup</h1>
        <p class="page-sub">Configure your organization's base country and currency</p>
      </div>
      <div class="glass-card animate-in" style="max-width:600px;position:relative;animation-delay:0.1s">
        <div id="companyLoading" class="loading-overlay"><div class="spinner"></div><p>Loading countries…</p></div>
        <div class="glass-card-title">Organization Settings</div>
        <div class="form-group">
          <label class="form-label">Company Name</label>
          <input class="form-input" id="companyName" value="${company.name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Base Country</label>
          <select class="form-input" id="countrySelect"><option value="">Loading…</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Base Currency</label>
          <input class="form-input" id="baseCurrDisplay" value="${company.baseCurrency || ''}" readonly style="opacity:0.6">
          <div class="form-hint">Automatically set based on country selection</div>
        </div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="Pages.saveCompany()">Save Settings</button>
      </div>`;

    // Load countries
    try {
      const countries = await API.fetchCountries();
      const sel = document.getElementById('countrySelect');
      sel.innerHTML = '<option value="">Select a country</option>' +
        countries.map(c => {
          const curr = Object.keys(c.currencies)[0];
          return `<option value="${c.name.common}" data-currency="${curr}" ${c.name.common === company.country ? 'selected' : ''}>${c.name.common} (${curr})</option>`;
        }).join('');

      sel.addEventListener('change', () => {
        const opt = sel.options[sel.selectedIndex];
        document.getElementById('baseCurrDisplay').value = opt.dataset.currency || '';
      });
    } catch (err) {
      App.toast('Failed to load countries', 'error');
    }

    document.getElementById('companyLoading').style.display = 'none';
  }

  function saveCompany() {
    const name = document.getElementById('companyName').value.trim();
    const sel = document.getElementById('countrySelect');
    const country = sel.value;
    const opt = sel.options[sel.selectedIndex];
    const baseCurrency = opt?.dataset?.currency || document.getElementById('baseCurrDisplay').value;

    if (!name || !country) { App.toast('Please fill all fields', 'error'); return; }
    Store.saveCompany({ name, country, baseCurrency });
    App.toast('Company settings saved successfully', 'success');
  }

  // ══════════ USER MANAGEMENT (Admin) ══════════
  function userManagement(el) {
    const users = Store.getUsers();
    const currentUser = App.currentUser;

    el.innerHTML = `
      <div class="page-header-row animate-in">
        <div><h1 class="page-title">User Management</h1><p class="page-sub">Manage employees, managers, and their reporting structure</p></div>
        <button class="btn btn-primary" onclick="Pages.showAddUserModal()">${UI.icon('plusCircle')} Add User</button>
      </div>
      <div class="glass-card animate-in" style="animation-delay:0.1s">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Reports To</th><th>Actions</th></tr></thead>
            <tbody>
              ${users.map(u => {
                const mgr = u.manager ? users.find(x => x.id === u.manager) : null;
                return `<tr>
                  <td><strong>${u.name}</strong></td>
                  <td style="color:var(--text-3)">${u.email}</td>
                  <td>${UI.roleBadge(u.role)}</td>
                  <td>${mgr ? mgr.name : '—'}</td>
                  <td class="td-actions">
                    ${u.id !== currentUser.id
                      ? `<button class="btn-icon" title="Edit" onclick="Pages.showEditUserModal('${u.id}')">${UI.icon('edit', 14)}</button>
                         <button class="btn-icon" title="Delete" onclick="Pages.deleteUser('${u.id}')" style="color:var(--red)">${UI.icon('trash', 14)}</button>`
                      : '<span style="color:var(--text-4);font-size:12px">You</span>'}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function showAddUserModal() {
    const users = Store.getUsers();
    const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');
    App.showModal(`
      <button class="modal-close" onclick="App.closeModal()">${UI.icon('x')}</button>
      <h3 class="modal-title">Add New User</h3>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="muName" placeholder="John Doe"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="muEmail" type="email" placeholder="john@company.com"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="muPass" value="pass"></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Role</label>
          <select class="form-input" id="muRole"><option value="employee">Employee</option><option value="manager">Manager</option></select></div>
        <div class="form-group"><label class="form-label">Reports To</label>
          <select class="form-input" id="muManager"><option value="">None</option>
            ${managers.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Pages.addUser()">Add User</button>
      </div>`);
  }

  function addUser() {
    const name = document.getElementById('muName').value.trim();
    const email = document.getElementById('muEmail').value.trim().toLowerCase();
    const password = document.getElementById('muPass').value || 'pass';
    const role = document.getElementById('muRole').value;
    const manager = document.getElementById('muManager').value || null;
    if (!name || !email) { App.toast('Name and email are required', 'error'); return; }
    const users = Store.getUsers();
    if (users.find(u => u.email === email)) { App.toast('Email already exists', 'error'); return; }
    users.push({ id: Store.uid(), name, email, password, role, manager });
    Store.saveUsers(users);
    App.closeModal();
    App.toast(`${name} added successfully`, 'success');
    App.navigate('user-management');
  }

  function showEditUserModal(userId) {
    const users = Store.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return;
    const managers = users.filter(x => (x.role === 'manager' || x.role === 'admin') && x.id !== userId);
    App.showModal(`
      <button class="modal-close" onclick="App.closeModal()">${UI.icon('x')}</button>
      <h3 class="modal-title">Edit User — ${u.name}</h3>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="euName" value="${u.name}"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="euPass" value="${u.password}" placeholder="Leave unchanged"></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Role</label>
          <select class="form-input" id="euRole">
            <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>Employee</option>
            <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
          </select></div>
        <div class="form-group"><label class="form-label">Reports To</label>
          <select class="form-input" id="euManager"><option value="">None</option>
            ${managers.map(m => `<option value="${m.id}" ${u.manager === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Pages.editUser('${userId}')">Save Changes</button>
      </div>`);
  }

  function editUser(userId) {
    const users = Store.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return;
    u.name = document.getElementById('euName').value.trim() || u.name;
    u.password = document.getElementById('euPass').value || u.password;
    u.role = document.getElementById('euRole').value;
    u.manager = document.getElementById('euManager').value || null;
    Store.saveUsers(users);
    App.closeModal();
    App.toast('User updated', 'success');
    App.navigate('user-management');
  }

  function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const users = Store.getUsers().filter(u => u.id !== userId);
    Store.saveUsers(users);
    App.toast('User deleted', 'success');
    App.navigate('user-management');
  }

  // ══════════ ALL EXPENSES (Admin) ══════════
  function allExpenses(el) {
    const expenses = Store.getExpenses();
    const users = Store.getUsers();
    const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];

    el.innerHTML = `
      <div class="page-header animate-in">
        <h1 class="page-title">All Expenses</h1>
        <p class="page-sub">Company-wide expense oversight and management</p>
      </div>
      <div class="filters-bar animate-in" style="animation-delay:0.1s">
        <div class="filter-label">${UI.icon('filter', 14)} Filters:</div>
        <select class="filter-select" id="aeStatusF" onchange="Pages.filterAllExpenses()">
          <option value="">All Status</option><option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
        <select class="filter-select" id="aeCatF" onchange="Pages.filterAllExpenses()">
          <option value="">All Categories</option>
          ${categories.map(c => `<option>${c}</option>`).join('')}</select>
        <select class="filter-select" id="aeSortF" onchange="Pages.filterAllExpenses()">
          <option value="date-desc">Newest First</option><option value="date-asc">Oldest First</option>
          <option value="amount-desc">Highest Amount</option><option value="amount-asc">Lowest Amount</option></select>
      </div>
      <div class="glass-card animate-in" style="animation-delay:0.15s">
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Employee</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="aeTableBody"></tbody>
        </table></div>
      </div>`;

    filterAllExpenses();
  }

  function filterAllExpenses() {
    const statusF = document.getElementById('aeStatusF')?.value || '';
    const catF = document.getElementById('aeCatF')?.value || '';
    const sortF = document.getElementById('aeSortF')?.value || 'date-desc';

    let expenses = Store.getExpenses();
    const users = Store.getUsers();
    if (statusF) expenses = expenses.filter(e => e.status === statusF);
    if (catF) expenses = expenses.filter(e => e.category === catF);

    if (sortF === 'date-desc') expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortF === 'date-asc') expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortF === 'amount-desc') expenses.sort((a, b) => b.convertedAmount - a.convertedAmount);
    else if (sortF === 'amount-asc') expenses.sort((a, b) => a.convertedAmount - b.convertedAmount);

    document.getElementById('aeTableBody').innerHTML = expenses.map(e => {
      const emp = users.find(u => u.id === e.userId);
      return `<tr>
        <td>${UI.fmtDate(e.date)}</td>
        <td>${emp ? emp.name : '?'}</td>
        <td>${e.description}</td>
        <td>${e.category || '—'}</td>
        <td class="td-amount">
          <div class="amount-primary">${UI.fmtCurr(e.convertedAmount, e.baseCurrency)}</div>
          ${e.currency !== e.baseCurrency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
        </td>
        <td>${UI.statusBadge(e.status)}</td>
        <td class="td-actions">
          <button class="btn-icon" title="View" onclick="Pages.showExpenseDetail('${e.id}')">${UI.icon('eye', 14)}</button>
          ${e.status === 'PENDING' ? `
            <button class="btn btn-sm btn-approve" onclick="Pages.adminOverride('${e.id}','APPROVED')">✓</button>
            <button class="btn btn-sm btn-reject" onclick="Pages.adminOverride('${e.id}','REJECTED')">✗</button>
          ` : ''}
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-4);padding:24px">No expenses match filters</td></tr>';
  }

  function adminOverride(expId, status) {
    const e = Store.updateExpense(expId, { status });
    if (e) {
      e.approvalLog.push({ action: `${status} (Admin Override)`, by: App.currentUser.id, at: new Date().toISOString() });
      Store.saveExpenses(Store.getExpenses());
    }
    App.toast(`Expense ${status.toLowerCase()}`, 'success');
    filterAllExpenses();
    App.renderSidebar();
  }

  // ══════════ APPROVALS (Manager) ══════════
  function approvals(el) {
    const expenses = Store.getExpenses();
    const users = Store.getUsers();
    const pending = expenses.filter(e => e.status === 'PENDING' && e.managerId === App.currentUser.id);

    el.innerHTML = `
      <div class="page-header animate-in">
        <h1 class="page-title">Pending Approvals</h1>
        <p class="page-sub">${pending.length} expense${pending.length !== 1 ? 's' : ''} awaiting your review</p>
      </div>
      <div id="approvalsList">
        ${pending.length === 0
          ? `<div class="glass-card empty-state animate-in"><div class="empty-state-icon">✓</div><div class="empty-state-text">All caught up — no pending approvals</div></div>`
          : pending.map((e, i) => {
              const emp = users.find(u => u.id === e.userId);
              return `<div class="glass-card approval-card" style="animation-delay:${i * 0.08}s">
                <div class="approval-card-header">
                  <div>
                    <div class="approval-emp-name">${emp ? emp.name : '?'}</div>
                    <div class="approval-desc">${e.description}</div>
                  </div>
                  <div class="approval-amounts">
                    ${e.currency !== e.baseCurrency ? `<div class="approval-original">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
                    <div class="approval-converted">${UI.fmtCurr(e.convertedAmount, e.baseCurrency)}</div>
                  </div>
                </div>
                <div class="approval-meta">
                  <span>📅 ${UI.fmtDate(e.date)}</span>
                  <span>🏷️ ${e.category || '—'}</span>
                  ${e.notes ? `<span>📝 ${e.notes}</span>` : ''}
                </div>
                <div class="approval-actions">
                  <input class="form-input approval-comment-input" placeholder="Comment (optional)" id="comment_${e.id}">
                  <button class="btn btn-sm btn-approve" onclick="Pages.handleApproval('${e.id}','APPROVED')">✓ Approve</button>
                  <button class="btn btn-sm btn-reject" onclick="Pages.handleApproval('${e.id}','REJECTED')">✗ Reject</button>
                  <button class="btn-icon" title="View Details" onclick="Pages.showExpenseDetail('${e.id}')">${UI.icon('eye', 14)}</button>
                </div>
              </div>`;
            }).join('')}
      </div>`;
  }

  function handleApproval(expId, status) {
    const comment = document.getElementById('comment_' + expId)?.value || '';
    const e = Store.updateExpense(expId, { status });
    if (e) {
      e.approvalLog.push({ action: status, by: App.currentUser.id, at: new Date().toISOString(), comment });
      Store.saveExpenses(Store.getExpenses());
    }
    App.toast(`Expense ${status.toLowerCase()}`, status === 'APPROVED' ? 'success' : 'error');
    App.navigate('approvals');
  }

  // ══════════ TEAM EXPENSES (Manager) ══════════
  function teamExpenses(el) {
    const expenses = Store.getExpenses();
    const users = Store.getUsers();
    const reportIds = users.filter(u => u.manager === App.currentUser.id).map(u => u.id);
    const team = expenses.filter(e => reportIds.includes(e.userId));

    el.innerHTML = `
      <div class="page-header animate-in">
        <h1 class="page-title">Team Expenses</h1>
        <p class="page-sub">All expenses from your direct reports</p>
      </div>
      <div class="filters-bar animate-in" style="animation-delay:0.05s">
        <select class="filter-select" id="teStatusF" onchange="Pages.filterTeamExpenses()">
          <option value="">All Status</option><option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
      </div>
      <div class="glass-card animate-in" style="animation-delay:0.1s">
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Employee</th><th>Description</th><th style="text-align:right">Amount</th><th>Status</th><th></th></tr></thead>
          <tbody id="teTableBody"></tbody>
        </table></div>
      </div>`;

    filterTeamExpenses();
  }

  function filterTeamExpenses() {
    const statusF = document.getElementById('teStatusF')?.value || '';
    const expenses = Store.getExpenses();
    const users = Store.getUsers();
    const reportIds = users.filter(u => u.manager === App.currentUser.id).map(u => u.id);
    let team = expenses.filter(e => reportIds.includes(e.userId));
    if (statusF) team = team.filter(e => e.status === statusF);
    team.sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('teTableBody').innerHTML = team.map(e => {
      const emp = users.find(u => u.id === e.userId);
      return `<tr>
        <td>${UI.fmtDate(e.date)}</td>
        <td>${emp ? emp.name : '?'}</td>
        <td>${e.description}</td>
        <td class="td-amount">
          <div class="amount-primary">${UI.fmtCurr(e.convertedAmount, e.baseCurrency)}</div>
          ${e.currency !== e.baseCurrency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
        </td>
        <td>${UI.statusBadge(e.status)}</td>
        <td><button class="btn-icon" onclick="Pages.showExpenseDetail('${e.id}')">${UI.icon('eye', 14)}</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-4);padding:24px">No expenses</td></tr>';
  }

  // ══════════ MY EXPENSES ══════════
  function myExpenses(el) {
    const expenses = Store.getExpenses().filter(e => e.userId === App.currentUser.id);

    el.innerHTML = `
      <div class="page-header-row animate-in">
        <div><h1 class="page-title">My Expenses</h1><p class="page-sub">${expenses.length} total submissions</p></div>
        <button class="btn btn-primary" onclick="App.navigate('submit-expense')">${UI.icon('plusCircle')} New Expense</button>
      </div>
      <div class="filters-bar animate-in" style="animation-delay:0.05s">
        <select class="filter-select" id="meStatusF" onchange="Pages.filterMyExpenses()">
          <option value="">All Status</option><option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
      </div>
      <div class="glass-card animate-in" style="animation-delay:0.1s">
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th>Status</th><th></th></tr></thead>
          <tbody id="meTableBody"></tbody>
        </table></div>
      </div>`;

    filterMyExpenses();
  }

  function filterMyExpenses() {
    const statusF = document.getElementById('meStatusF')?.value || '';
    let expenses = Store.getExpenses().filter(e => e.userId === App.currentUser.id);
    if (statusF) expenses = expenses.filter(e => e.status === statusF);
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('meTableBody').innerHTML = expenses.map(e =>
      `<tr>
        <td>${UI.fmtDate(e.date)}</td>
        <td>${e.description}</td>
        <td>${e.category || '—'}</td>
        <td class="td-amount">
          <div class="amount-primary">${UI.fmtCurr(e.convertedAmount, e.baseCurrency)}</div>
          ${e.currency !== e.baseCurrency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
        </td>
        <td>${UI.statusBadge(e.status)}</td>
        <td><button class="btn-icon" onclick="Pages.showExpenseDetail('${e.id}')">${UI.icon('eye', 14)}</button></td>
      </tr>`
    ).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-4);padding:24px">No expenses found</td></tr>';
  }

  // ══════════ SUBMIT EXPENSE (with OCR) ══════════
  function submitExpense(el) {
    const company = Store.getCompany();
    const bc = company.baseCurrency || 'INR';

    el.innerHTML = `
      <div class="page-header animate-in">
        <h1 class="page-title">Submit Expense</h1>
        <p class="page-sub">File a new reimbursement request</p>
      </div>
      <div class="content-grid-2">
        <!-- OCR Panel -->
        <div class="glass-card animate-in" style="position:relative;animation-delay:0.1s">
          <div class="glass-card-title">${UI.icon('camera')} Scan Receipt (OCR)</div>
          <div class="ocr-drop-zone" id="ocrZone">
            <input type="file" accept="image/jpeg,image/png,image/webp" id="receiptFile" onchange="Pages.handleOCRFile(this)">
            ${UI.icons.upload}
            <p>Drop receipt image here or click to upload</p>
            <span class="ocr-hint">JPG, PNG supported — Powered by Tesseract.js OCR</span>
          </div>
          <div id="ocrProgressArea" style="display:none"></div>
          <div id="ocrPreviewArea" style="display:none"></div>
        </div>

        <!-- Form Panel -->
        <div class="glass-card animate-in" style="position:relative;animation-delay:0.15s">
          <div id="submitLoading" class="loading-overlay" style="display:none"><div class="spinner"></div><p>Converting currency…</p></div>
          <div class="glass-card-title">${UI.icon('edit')} Expense Details</div>
          <div class="form-group">
            <label class="form-label">Description / Merchant *</label>
            <input class="form-input" id="expDesc" placeholder="e.g. Taj Hotel dinner">
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Amount *</label>
              <input class="form-input" id="expAmount" type="number" step="0.01" min="0" placeholder="0.00" oninput="Pages.updateConversionPreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-input" id="expCurrency" onchange="Pages.updateConversionPreview()">
                ${UI.CURRENCIES.map(c => `<option value="${c}" ${c === bc ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-input" id="expCategory">
                ${UI.CATEGORIES.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input class="form-input" id="expDate" type="date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-input" id="expNotes" rows="2" placeholder="Additional context…"></textarea>
          </div>
          <div id="conversionPreview" style="display:none"></div>
          <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="Pages.submitExpenseForm()">Submit Expense</button>
        </div>
      </div>`;

    // Drag and drop handlers
    setTimeout(() => {
      const zone = document.getElementById('ocrZone');
      if (!zone) return;
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) processOCRFile(e.dataTransfer.files[0]);
      });
    }, 100);
  }

  function handleOCRFile(input) {
    if (input.files && input.files[0]) processOCRFile(input.files[0]);
  }

  async function processOCRFile(file) {
    if (!file.type.startsWith('image/')) {
      App.toast('Please upload an image file (JPG or PNG)', 'error');
      return;
    }

    // Show preview
    try {
      const dataUrl = await OCR.readAsDataURL(file);
      const previewArea = document.getElementById('ocrPreviewArea');
      if (previewArea) {
        previewArea.style.display = 'block';
        previewArea.innerHTML = `<img src="${dataUrl}" class="ocr-preview-img" alt="Receipt preview">`;
      }
    } catch {}

    // Show progress
    const progressArea = document.getElementById('ocrProgressArea');
    if (progressArea) {
      progressArea.style.display = 'block';
      progressArea.innerHTML = `
        <div class="ocr-progress">
          <div class="spinner" style="width:18px;height:18px"></div>
          <div style="flex:1">
            <div class="ocr-progress-text" id="ocrStatusText">Initializing…</div>
            <div class="ocr-progress-bar"><div class="ocr-progress-fill" id="ocrProgressFill" style="width:5%"></div></div>
          </div>
        </div>`;
    }

    try {
      const result = await OCR.scanReceipt(file, ({ status, progress }) => {
        const statusEl = document.getElementById('ocrStatusText');
        const fillEl = document.getElementById('ocrProgressFill');
        if (statusEl) statusEl.textContent = status;
        if (fillEl) fillEl.style.width = Math.round(progress * 100) + '%';
      });

      // Auto-fill form
      if (result.merchant) {
        const descEl = document.getElementById('expDesc');
        if (descEl) descEl.value = result.merchant;
      }
      if (result.amount != null) {
        const amtEl = document.getElementById('expAmount');
        if (amtEl) amtEl.value = result.amount;
      }
      if (result.currency) {
        const currEl = document.getElementById('expCurrency');
        if (currEl) {
          for (let opt of currEl.options) {
            if (opt.value === result.currency) { opt.selected = true; break; }
          }
        }
      }
      if (result.date) {
        const dateEl = document.getElementById('expDate');
        if (dateEl) dateEl.value = result.date;
      }
      if (result.category) {
        const catEl = document.getElementById('expCategory');
        if (catEl) {
          for (let opt of catEl.options) {
            if (opt.value === result.category) { opt.selected = true; break; }
          }
        }
      }

      // Update progress to complete
      if (progressArea) {
        progressArea.innerHTML = `
          <div class="ocr-progress" style="background:rgba(0,230,138,0.04);border-color:rgba(0,230,138,0.15)">
            <span style="color:var(--green);font-size:18px">✓</span>
            <div>
              <div class="ocr-progress-text" style="color:var(--green)">Receipt scanned — fields auto-filled</div>
              <div style="font-size:11px;color:var(--text-4);margin-top:4px">
                ${result.rawText ? `Extracted ${result.rawText.split(/\s+/).length} words` : ''}
                ${result.merchant ? ` · Merchant: ${result.merchant}` : ''}
              </div>
            </div>
          </div>`;
      }

      App.toast('Receipt scanned — form auto-filled', 'success');
      updateConversionPreview();
    } catch (err) {
      console.error('OCR Error:', err);
      if (progressArea) {
        progressArea.innerHTML = `
          <div class="ocr-progress" style="background:rgba(255,77,106,0.04);border-color:rgba(255,77,106,0.15)">
            <span style="color:var(--red);font-size:18px">✗</span>
            <div class="ocr-progress-text" style="color:var(--red)">OCR failed — ${err.message || 'please fill manually'}</div>
          </div>`;
      }
      App.toast('OCR failed — please fill the form manually', 'error');
    }
  }

  // Live conversion preview
  let conversionTimeout = null;
  async function updateConversionPreview() {
    clearTimeout(conversionTimeout);
    conversionTimeout = setTimeout(async () => {
      const company = Store.getCompany();
      const bc = company.baseCurrency || 'INR';
      const amt = parseFloat(document.getElementById('expAmount')?.value);
      const curr = document.getElementById('expCurrency')?.value;
      const previewEl = document.getElementById('conversionPreview');
      if (!previewEl) return;

      if (!amt || amt <= 0 || curr === bc) {
        previewEl.style.display = 'none';
        return;
      }

      previewEl.style.display = 'block';
      previewEl.className = 'conversion-preview';
      previewEl.innerHTML = `<div class="spinner" style="width:14px;height:14px"></div> Converting…`;

      try {
        const { converted, rate } = await API.convert(amt, curr, bc);
        previewEl.innerHTML = `
          💱 ${UI.fmtCurr(amt, curr)} ≈ <strong>${UI.fmtCurr(converted, bc)}</strong>
          <span class="rate-info">Rate: 1 ${curr} = ${rate.toFixed(4)} ${bc}</span>`;
      } catch {
        previewEl.innerHTML = `<span style="color:var(--red)">Could not fetch rate</span>`;
      }
    }, 300);
  }

  // Submit expense form
  async function submitExpenseForm() {
    const desc = document.getElementById('expDesc')?.value.trim();
    const amount = parseFloat(document.getElementById('expAmount')?.value);
    const currency = document.getElementById('expCurrency')?.value;
    const category = document.getElementById('expCategory')?.value;
    const date = document.getElementById('expDate')?.value;
    const notes = document.getElementById('expNotes')?.value.trim();

    if (!desc) { App.toast('Description is required', 'error'); return; }
    if (!amount || amount <= 0) { App.toast('Enter a valid amount', 'error'); return; }
    if (!date) { App.toast('Date is required', 'error'); return; }

    const company = Store.getCompany();
    const bc = company.baseCurrency || 'INR';
    const user = App.currentUser;
    const users = Store.getUsers();
    const me = users.find(u => u.id === user.id);

    const loader = document.getElementById('submitLoading');
    if (loader) loader.style.display = 'flex';

    let convertedAmount = amount;
    if (currency !== bc) {
      try {
        const { converted } = await API.convert(amount, currency, bc);
        convertedAmount = converted;
      } catch {
        App.toast('Conversion failed — using original amount', 'info');
      }
    }

    const expense = {
      id: Store.uid(),
      userId: user.id,
      description: desc,
      amount,
      currency,
      convertedAmount,
      baseCurrency: bc,
      category,
      date,
      notes,
      status: 'PENDING',
      managerId: me?.manager || null,
      createdAt: new Date().toISOString(),
      approvalLog: [{ action: 'SUBMITTED', by: user.id, at: new Date().toISOString() }],
    };

    Store.addExpense(expense);

    if (loader) loader.style.display = 'none';
    App.toast(`Expense submitted — ${UI.fmtCurr(convertedAmount, bc)}`, 'success');
    App.renderSidebar();
    App.navigate('my-expenses');
  }

  // ══════════ EXPENSE DETAIL MODAL ══════════
  function showExpenseDetail(expId) {
    const expenses = Store.getExpenses();
    const users = Store.getUsers();
    const e = expenses.find(x => x.id === expId);
    if (!e) return;
    const emp = users.find(u => u.id === e.userId);

    const timeline = (e.approvalLog || []).map((log, i) =>
      UI.timelineItem(log, users, i === e.approvalLog.length - 1)
    ).join('');

    App.showModal(`
      <button class="modal-close" onclick="App.closeModal()">${UI.icon('x')}</button>
      <h3 class="modal-title">${e.description}</h3>
      <div class="detail-grid">
        <div class="detail-field">
          <div class="detail-label">Amount</div>
          <div class="detail-amount">${UI.fmtCurr(e.convertedAmount, e.baseCurrency)}</div>
          ${e.currency !== e.baseCurrency ? `<div class="detail-amount-sub">Original: ${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
        </div>
        <div class="detail-field">
          <div class="detail-label">Status</div>
          <div class="detail-value">${UI.statusBadge(e.status)}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Category</div>
          <div class="detail-value">${e.category || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Date</div>
          <div class="detail-value">${UI.fmtDate(e.date)}</div>
        </div>
        <div class="detail-field full">
          <div class="detail-label">Submitted By</div>
          <div class="detail-value">${emp ? `${emp.name} (${emp.email})` : '?'}</div>
        </div>
        ${e.notes ? `<div class="detail-field full">
          <div class="detail-label">Notes</div>
          <div class="detail-value" style="color:var(--text-3)">${e.notes}</div>
        </div>` : ''}
      </div>
      <div style="margin-top:8px">
        <div style="font-size:14px;font-weight:600;margin-bottom:14px;color:var(--text-2)">Approval Timeline</div>
        <div class="timeline">${timeline}</div>
      </div>`);
  }

  return {
    dashboard, companySetup, saveCompany,
    userManagement, showAddUserModal, addUser, showEditUserModal, editUser, deleteUser,
    allExpenses, filterAllExpenses, adminOverride,
    approvals, handleApproval,
    teamExpenses, filterTeamExpenses,
    myExpenses, filterMyExpenses,
    submitExpense, handleOCRFile, updateConversionPreview, submitExpenseForm,
    showExpenseDetail,
  };
})();

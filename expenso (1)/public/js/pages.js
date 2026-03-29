/* ══════════════════════════════════════════════════════════════
   PAGES — All Page Renderers (Async, API-backed)
   ══════════════════════════════════════════════════════════════ */

const Pages = (() => {

  // ══════════ DASHBOARD ══════════
  async function dashboard(el) {
    try {
      const data = await Store.getDashboard();
      const company = Store.getCompanyCache();
      const bc = company?.base_currency || 'INR';
      const user = Store.getCurrentUser();

      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back, ${user.name.split(' ')[0]}</p>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Expenses</div>
            <div class="stat-value">${data.total}</div>
          </div>
          <div class="stat-card stat-warning">
            <div class="stat-label">Pending Review</div>
            <div class="stat-value">${data.pending.count}</div>
            <div class="stat-sub">${UI.fmtCurr(data.pending.total, bc)}</div>
          </div>
          <div class="stat-card stat-success">
            <div class="stat-label">Approved</div>
            <div class="stat-value">${data.approved.count}</div>
            <div class="stat-sub">${UI.fmtCurr(data.approved.total, bc)}</div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-label">Rejected</div>
            <div class="stat-value">${data.rejected}</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header">Recent Activity</div>
            <div class="table-wrap">
              <table>
                <thead><tr>
                  <th>Date</th><th>Description</th>
                  ${user.role !== 'employee' ? '<th>Employee</th>' : ''}
                  <th class="text-right">Amount</th><th>Status</th>
                </tr></thead>
                <tbody>
                  ${data.recent.length === 0 ? `<tr><td colspan="5" class="empty-cell">No expenses yet</td></tr>` :
                    data.recent.map(e => `<tr>
                      <td class="text-muted">${UI.fmtDate(e.expense_date)}</td>
                      <td><strong>${e.description}</strong></td>
                      ${user.role !== 'employee' ? `<td class="text-muted">${e.user_name || '—'}</td>` : ''}
                      <td class="text-right">
                        <div class="amount-primary">${UI.fmtCurr(e.converted_amount, e.base_currency)}</div>
                        ${e.currency !== e.base_currency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
                      </td>
                      <td>${UI.statusBadge(e.status)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header">Spending by Category</div>
            ${data.categories.length === 0 ? '<div class="empty-state">No approved expenses yet</div>' :
              data.categories.map(c => {
                const pct = data.approved.total > 0 ? Math.round((parseFloat(c.total) / data.approved.total) * 100) : 0;
                return `<div class="cat-row">
                  <div class="cat-header"><span>${c.category || 'Other'}</span><span class="text-muted">${UI.fmtCurr(c.total, bc)} (${pct}%)</span></div>
                  <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                </div>`;
              }).join('')}
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="error-state">Failed to load dashboard: ${err.message}</div>`;
    }
  }

  // ══════════ COMPANY SETUP ══════════
  async function companySetup(el) {
    try {
      const company = await Store.getCompany();
      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Company Setup</h1>
          <p class="page-subtitle">Configure your organization settings</p>
        </div>
        <div class="card" style="max-width:640px">
          <div class="card-header">Organization Settings</div>
          <div class="form-group">
            <label class="form-label">Company Name</label>
            <input class="form-input" id="companyName" value="${company.name || ''}">
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Base Country</label>
              <select class="form-input" id="countrySelect"><option>Loading countries…</option></select>
            </div>
            <div class="form-group" style="flex:0 0 120px">
              <label class="form-label">Base Currency</label>
              <input class="form-input" id="baseCurrDisplay" value="${company.base_currency || ''}" readonly>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Manager Approval Required</label>
            <div class="toggle-row">
              <label class="toggle">
                <input type="checkbox" id="isManagerApprover" ${company.is_manager_approver ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-desc">When enabled, the employee's direct manager is the first approver in the chain</span>
            </div>
          </div>
          <button class="btn btn-primary" onclick="Pages.saveCompany()">Save Settings</button>
        </div>`;

      const countries = await ExternalAPI.fetchCountries();
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
      el.innerHTML = `<div class="error-state">${err.message}</div>`;
    }
  }

  async function saveCompany() {
    const name = document.getElementById('companyName').value.trim();
    const sel = document.getElementById('countrySelect');
    const country = sel.value;
    const opt = sel.options[sel.selectedIndex];
    const base_currency = opt?.dataset?.currency || document.getElementById('baseCurrDisplay').value;
    const is_manager_approver = document.getElementById('isManagerApprover').checked;

    if (!name || !country) { App.toast('Please fill all fields', 'error'); return; }
    try {
      await Store.updateCompany({ name, country, base_currency, is_manager_approver });
      App.toast('Company settings saved', 'success');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  // ══════════ USER MANAGEMENT ══════════
  async function userManagement(el) {
    try {
      const users = await Store.getUsers();
      const me = Store.getCurrentUser();
      el.innerHTML = `
        <div class="page-header-row">
          <div><h1 class="page-title">User Management</h1><p class="page-subtitle">Manage employees, managers, and reporting structure</p></div>
          <button class="btn btn-primary" onclick="Pages.showAddUserModal()">${UI.icon('plusSmall',14)} Add User</button>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Reports To</th><th>Actions</th></tr></thead>
              <tbody>
                ${users.map(u => {
                  const mgr = u.manager_id ? users.find(x => x.id === u.manager_id) : null;
                  return `<tr>
                    <td><strong>${u.name}</strong></td>
                    <td class="text-muted">${u.email}</td>
                    <td>${UI.roleBadge(u.role)}</td>
                    <td>${mgr ? mgr.name : '—'}</td>
                    <td class="td-actions">
                      ${u.id !== me.id
                        ? `<button class="btn-icon" title="Edit" onclick="Pages.showEditUserModal(${u.id})"> ${UI.icon('edit',14)}</button>
                           <button class="btn-icon btn-icon-danger" title="Delete" onclick="Pages.deleteUser(${u.id})">${UI.icon('trash',14)}</button>`
                        : '<span class="text-muted text-sm">You</span>'}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="error-state">${err.message}</div>`;
    }
  }

  async function showAddUserModal() {
    const users = await Store.getUsers();
    const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');
    App.showModal(`
      <button class="modal-close" onclick="App.closeModal()">${UI.icon('x')}</button>
      <h3 class="modal-title">Add New User</h3>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="muName" placeholder="John Doe"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="muEmail" type="email" placeholder="john@company.com"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="muPass" value="pass"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label class="form-label">Role</label>
          <select class="form-input" id="muRole"><option value="employee">Employee</option><option value="manager">Manager</option></select></div>
        <div class="form-group" style="flex:1"><label class="form-label">Reports To</label>
          <select class="form-input" id="muManager"><option value="">None</option>
            ${managers.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Pages.addUser()">Add User</button>
      </div>`);
  }

  async function addUser() {
    const name = document.getElementById('muName').value.trim();
    const email = document.getElementById('muEmail').value.trim().toLowerCase();
    const password = document.getElementById('muPass').value || 'pass';
    const role = document.getElementById('muRole').value;
    const manager_id = parseInt(document.getElementById('muManager').value) || null;
    if (!name || !email) { App.toast('Name and email required', 'error'); return; }
    try {
      await Store.createUser({ name, email, password, role, manager_id });
      App.closeModal();
      App.toast(`${name} added`, 'success');
      App.navigate('user-management');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  async function showEditUserModal(userId) {
    const users = await Store.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return;
    const managers = users.filter(x => (x.role === 'manager' || x.role === 'admin') && x.id !== userId);
    App.showModal(`
      <button class="modal-close" onclick="App.closeModal()">${UI.icon('x')}</button>
      <h3 class="modal-title">Edit User — ${u.name}</h3>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="euName" value="${u.name}"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="euPass" placeholder="Leave unchanged"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label class="form-label">Role</label>
          <select class="form-input" id="euRole">
            <option value="employee" ${u.role==='employee'?'selected':''}>Employee</option>
            <option value="manager" ${u.role==='manager'?'selected':''}>Manager</option>
          </select></div>
        <div class="form-group" style="flex:1"><label class="form-label">Reports To</label>
          <select class="form-input" id="euManager"><option value="">None</option>
            ${managers.map(m => `<option value="${m.id}" ${u.manager_id===m.id?'selected':''}>${m.name}</option>`).join('')}</select></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Pages.editUser(${userId})">Save Changes</button>
      </div>`);
  }

  async function editUser(userId) {
    const name = document.getElementById('euName').value.trim();
    const password = document.getElementById('euPass').value || undefined;
    const role = document.getElementById('euRole').value;
    const manager_id = parseInt(document.getElementById('euManager').value) || null;
    try {
      await Store.updateUser(userId, { name, password, role, manager_id });
      App.closeModal();
      App.toast('User updated', 'success');
      App.navigate('user-management');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  async function deleteUser(userId) {
    if (!confirm('Delete this user?')) return;
    try {
      await Store.deleteUser(userId);
      App.toast('User deleted', 'success');
      App.navigate('user-management');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  // ══════════ APPROVAL CHAIN CONFIG (Admin) ══════════
  async function approvalChain(el) {
    try {
      const chain = await Store.getApprovalChain();
      const users = await Store.getUsers();
      const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

      el.innerHTML = `
        <div class="page-header-row">
          <div><h1 class="page-title">Approval Chain</h1>
            <p class="page-subtitle">Define the multi-level approval sequence for expenses</p></div>
          <button class="btn btn-primary" onclick="Pages.addChainStep()">${UI.icon('plusSmall',14)} Add Step</button>
        </div>
        <div class="card">
          <div class="card-header">Approval Steps</div>
          <p class="card-desc">Expenses will flow through these steps in order. If "Manager Approval Required" is enabled in Company Setup, the employee's direct manager acts as the first approver for any step of type "Manager".</p>
          <div id="chainSteps">
            ${chain.length === 0 ? '<div class="empty-state">No approval steps configured. Expenses will be auto-approved on submission.</div>' :
              chain.map((s, i) => `
                <div class="chain-step" data-id="${s.id}">
                  <div class="chain-order">${i + 1}</div>
                  <div class="chain-body">
                    <div class="form-row">
                      <div class="form-group" style="flex:1">
                        <label class="form-label">Label</label>
                        <input class="form-input chain-label" value="${s.label}" placeholder="e.g. Finance Review">
                      </div>
                      <div class="form-group" style="flex:0 0 160px">
                        <label class="form-label">Type</label>
                        <select class="form-input chain-type" onchange="Pages.chainTypeChanged(this)">
                          <option value="manager" ${s.approver_type==='manager'?'selected':''}>Manager</option>
                          <option value="user" ${s.approver_type==='user'?'selected':''}>Specific User</option>
                        </select>
                      </div>
                      <div class="form-group chain-user-group" style="flex:1;${s.approver_type==='manager'?'display:none':''}">
                        <label class="form-label">Approver</label>
                        <select class="form-input chain-user">
                          <option value="">Select user</option>
                          ${managers.map(m => `<option value="${m.id}" ${s.approver_user_id===m.id?'selected':''}>${m.name} (${m.role})</option>`).join('')}
                        </select>
                      </div>
                    </div>
                  </div>
                  <button class="btn-icon btn-icon-danger" onclick="this.closest('.chain-step').remove()" title="Remove">${UI.icon('trash',14)}</button>
                </div>`).join('')}
          </div>
          <div class="card-footer">
            <button class="btn btn-primary" onclick="Pages.saveChain()">Save Approval Chain</button>
          </div>
        </div>`;

      // Store managers data for addChainStep
      el._managers = managers;
    } catch (err) {
      el.innerHTML = `<div class="error-state">${err.message}</div>`;
    }
  }

  function chainTypeChanged(selectEl) {
    const userGroup = selectEl.closest('.chain-body').querySelector('.chain-user-group');
    userGroup.style.display = selectEl.value === 'manager' ? 'none' : '';
  }

  function addChainStep() {
    const container = document.getElementById('chainSteps');
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();

    const managers = document.getElementById('mainContent')._managers || [];
    const count = container.querySelectorAll('.chain-step').length + 1;

    const div = document.createElement('div');
    div.className = 'chain-step';
    div.innerHTML = `
      <div class="chain-order">${count}</div>
      <div class="chain-body">
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Label</label>
            <input class="form-input chain-label" placeholder="e.g. Director Approval">
          </div>
          <div class="form-group" style="flex:0 0 160px">
            <label class="form-label">Type</label>
            <select class="form-input chain-type" onchange="Pages.chainTypeChanged(this)">
              <option value="user">Specific User</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div class="form-group chain-user-group" style="flex:1">
            <label class="form-label">Approver</label>
            <select class="form-input chain-user">
              <option value="">Select user</option>
              ${managers.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <button class="btn-icon btn-icon-danger" onclick="this.closest('.chain-step').remove()" title="Remove">${UI.icon('trash',14)}</button>`;
    container.appendChild(div);
  }

  async function saveChain() {
    const stepEls = document.querySelectorAll('.chain-step');
    const steps = [];
    stepEls.forEach((el, i) => {
      steps.push({
        step_order: i + 1,
        label: el.querySelector('.chain-label').value || `Step ${i+1}`,
        approver_type: el.querySelector('.chain-type').value,
        approver_user_id: parseInt(el.querySelector('.chain-user').value) || null,
      });
    });
    try {
      await Store.updateApprovalChain(steps);
      App.toast('Approval chain saved', 'success');
      App.navigate('approval-chain');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  // ══════════ APPROVAL RULES (Admin) ══════════
  async function approvalRules(el) {
    try {
      const rules = await Store.getApprovalRules();
      const users = await Store.getUsers();
      const approvers = users.filter(u => u.role === 'manager' || u.role === 'admin');

      el.innerHTML = `
        <div class="page-header-row">
          <div><h1 class="page-title">Conditional Approval Rules</h1>
            <p class="page-subtitle">Define rules that can auto-approve expenses when conditions are met</p></div>
          <button class="btn btn-primary" onclick="Pages.addRule()">${UI.icon('plusSmall',14)} Add Rule</button>
        </div>
        <div class="card">
          <div class="card-header">Active Rules</div>
          <p class="card-desc">These rules are evaluated after each approval step. If any rule's condition is met, the expense is auto-approved regardless of remaining steps.</p>
          <div id="rulesList">
            ${rules.length === 0 ? '<div class="empty-state">No conditional rules. All steps must be completed for approval.</div>' :
              rules.map((r, i) => renderRuleRow(r, i, approvers)).join('')}
          </div>
          <div class="card-footer">
            <button class="btn btn-primary" onclick="Pages.saveRules()">Save Rules</button>
          </div>
        </div>`;

      el._approvers = approvers;
    } catch (err) {
      el.innerHTML = `<div class="error-state">${err.message}</div>`;
    }
  }

  function renderRuleRow(r, i, approvers) {
    return `<div class="rule-row" data-id="${r.id || ''}">
      <div class="form-row" style="align-items:end">
        <div class="form-group" style="flex:0 0 180px">
          <label class="form-label">Rule Type</label>
          <select class="form-input rule-type" onchange="Pages.ruleTypeChanged(this)">
            <option value="percentage" ${r.rule_type==='percentage'?'selected':''}>Percentage</option>
            <option value="specific_approver" ${r.rule_type==='specific_approver'?'selected':''}>Specific Approver</option>
            <option value="hybrid" ${r.rule_type==='hybrid'?'selected':''}>Hybrid (OR)</option>
          </select>
        </div>
        <div class="form-group rule-pct-group" style="flex:0 0 140px;${r.rule_type==='specific_approver'?'display:none':''}">
          <label class="form-label">Threshold %</label>
          <input type="number" class="form-input rule-pct" min="1" max="100" value="${r.percentage_threshold || 60}" placeholder="60">
        </div>
        <div class="form-group rule-approver-group" style="flex:1;${r.rule_type==='percentage'?'display:none':''}">
          <label class="form-label">Specific Approver</label>
          <select class="form-input rule-approver">
            <option value="">Select</option>
            ${approvers.map(a => `<option value="${a.id}" ${r.specific_approver_id===a.id?'selected':''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:0 0 60px">
          <label class="toggle" title="Active">
            <input type="checkbox" class="rule-active" ${r.is_active !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <button class="btn-icon btn-icon-danger" onclick="this.closest('.rule-row').remove()" style="margin-bottom:18px">${UI.icon('trash',14)}</button>
      </div>
    </div>`;
  }

  function ruleTypeChanged(selectEl) {
    const row = selectEl.closest('.rule-row');
    const pct = row.querySelector('.rule-pct-group');
    const approver = row.querySelector('.rule-approver-group');
    const val = selectEl.value;
    pct.style.display = val === 'specific_approver' ? 'none' : '';
    approver.style.display = val === 'percentage' ? 'none' : '';
  }

  function addRule() {
    const container = document.getElementById('rulesList');
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();
    const approvers = document.getElementById('mainContent')._approvers || [];
    const div = document.createElement('div');
    div.innerHTML = renderRuleRow({ rule_type: 'percentage', percentage_threshold: 60, is_active: true }, 0, approvers);
    container.appendChild(div.firstElementChild);
  }

  async function saveRules() {
    const ruleEls = document.querySelectorAll('.rule-row');
    const rules = [];
    ruleEls.forEach(el => {
      rules.push({
        rule_type: el.querySelector('.rule-type').value,
        percentage_threshold: parseInt(el.querySelector('.rule-pct')?.value) || null,
        specific_approver_id: parseInt(el.querySelector('.rule-approver')?.value) || null,
        is_active: el.querySelector('.rule-active').checked,
      });
    });
    try {
      await Store.updateApprovalRules(rules);
      App.toast('Approval rules saved', 'success');
      App.navigate('approval-rules');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  // ══════════ ALL EXPENSES (Admin) ══════════
  let _allExpensesData = [];
  async function allExpenses(el) {
    try {
      _allExpensesData = await Store.getExpenses('all');
      const categories = [...new Set(_allExpensesData.map(e => e.category).filter(Boolean))];

      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">All Expenses</h1>
          <p class="page-subtitle">Company-wide expense oversight</p>
        </div>
        <div class="filters-bar">
          <span class="filter-label">${UI.icon('filter',14)} Filters</span>
          <select class="filter-select" id="aeStatusF" onchange="Pages.filterAllExpenses()">
            <option value="">All Status</option><option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
          <select class="filter-select" id="aeCatF" onchange="Pages.filterAllExpenses()">
            <option value="">All Categories</option>
            ${categories.map(c => `<option>${c}</option>`).join('')}</select>
          <select class="filter-select" id="aeSortF" onchange="Pages.filterAllExpenses()">
            <option value="date-desc">Newest</option><option value="date-asc">Oldest</option>
            <option value="amount-desc">Highest</option><option value="amount-asc">Lowest</option></select>
        </div>
        <div class="card">
          <div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Employee</th><th>Description</th><th>Category</th><th class="text-right">Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="aeTableBody"></tbody>
          </table></div>
        </div>`;
      filterAllExpenses();
    } catch (err) { el.innerHTML = `<div class="error-state">${err.message}</div>`; }
  }

  function filterAllExpenses() {
    const statusF = document.getElementById('aeStatusF')?.value || '';
    const catF = document.getElementById('aeCatF')?.value || '';
    const sortF = document.getElementById('aeSortF')?.value || 'date-desc';

    let exps = [..._allExpensesData];
    if (statusF) exps = exps.filter(e => e.status === statusF);
    if (catF) exps = exps.filter(e => e.category === catF);

    if (sortF === 'date-desc') exps.sort((a,b) => new Date(b.expense_date) - new Date(a.expense_date));
    else if (sortF === 'date-asc') exps.sort((a,b) => new Date(a.expense_date) - new Date(b.expense_date));
    else if (sortF === 'amount-desc') exps.sort((a,b) => b.converted_amount - a.converted_amount);
    else if (sortF === 'amount-asc') exps.sort((a,b) => a.converted_amount - b.converted_amount);

    document.getElementById('aeTableBody').innerHTML = exps.length === 0
      ? '<tr><td colspan="7" class="empty-cell">No expenses match filters</td></tr>'
      : exps.map(e => `<tr>
          <td class="text-muted">${UI.fmtDate(e.expense_date)}</td>
          <td>${e.user_name || '—'}</td>
          <td><strong>${e.description}</strong></td>
          <td class="text-muted">${e.category || '—'}</td>
          <td class="text-right">
            <div class="amount-primary">${UI.fmtCurr(e.converted_amount, e.base_currency)}</div>
            ${e.currency !== e.base_currency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
          </td>
          <td>${UI.statusBadge(e.status)}</td>
          <td class="td-actions">
            <button class="btn-icon" onclick="Pages.showExpenseDetail(${e.id})" title="View">${UI.icon('eye',14)}</button>
            ${e.status === 'PENDING' ? `
              <button class="btn btn-xs btn-approve" onclick="Pages.adminAction(${e.id},'APPROVED')">✓</button>
              <button class="btn btn-xs btn-reject" onclick="Pages.adminAction(${e.id},'REJECTED')">✕</button>
            ` : ''}
          </td>
        </tr>`).join('');
  }

  async function adminAction(expId, action) {
    try {
      await Store.actionExpense(expId, action, 'Admin override');
      App.toast(`Expense ${action.toLowerCase()}`, 'success');
      App.navigate('all-expenses');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  // ══════════ APPROVALS (Manager/Admin) ══════════
  async function approvals(el) {
    try {
      const pending = await Store.getExpenses('pending');
      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Pending Approvals</h1>
          <p class="page-subtitle">${pending.length} expense${pending.length !== 1 ? 's' : ''} awaiting your review</p>
        </div>
        <div id="approvalsList">
          ${pending.length === 0
            ? '<div class="card empty-state" style="padding:48px"><div style="font-size:32px;margin-bottom:12px">✓</div>All caught up — no pending approvals</div>'
            : pending.map(e => `
              <div class="card approval-card">
                <div class="approval-header">
                  <div>
                    <div class="approval-employee">${e.user_name || '—'}</div>
                    <div class="approval-desc">${e.description}</div>
                  </div>
                  <div class="approval-amount">
                    ${e.currency !== e.base_currency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
                    <div class="amount-large">${UI.fmtCurr(e.converted_amount, e.base_currency)}</div>
                  </div>
                </div>
                <div class="approval-meta">
                  <span>📅 ${UI.fmtDate(e.expense_date)}</span>
                  <span>🏷️ ${e.category || '—'}</span>
                  ${e.notes ? `<span>📝 ${e.notes}</span>` : ''}
                </div>
                ${e.approval_steps ? `<div style="margin-bottom:16px">${UI.approvalPipeline(e.approval_steps, e.current_step)}</div>` : ''}
                <div class="approval-actions">
                  <input class="form-input" placeholder="Comment (optional)" id="comment_${e.id}" style="flex:1">
                  <button class="btn btn-sm btn-approve" onclick="Pages.handleApproval(${e.id},'APPROVED')">✓ Approve</button>
                  <button class="btn btn-sm btn-reject" onclick="Pages.handleApproval(${e.id},'REJECTED')">✕ Reject</button>
                  <button class="btn-icon" onclick="Pages.showExpenseDetail(${e.id})" title="Details">${UI.icon('eye',14)}</button>
                </div>
              </div>`).join('')}
        </div>`;
    } catch (err) { el.innerHTML = `<div class="error-state">${err.message}</div>`; }
  }

  async function handleApproval(expId, action) {
    const comment = document.getElementById('comment_' + expId)?.value || '';
    try {
      await Store.actionExpense(expId, action, comment);
      App.toast(`Expense ${action.toLowerCase()}`, action === 'APPROVED' ? 'success' : 'error');
      App.navigate('approvals');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  // ══════════ TEAM EXPENSES (Manager) ══════════
  async function teamExpenses(el) {
    try {
      const team = await Store.getExpenses('team');
      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Team Expenses</h1>
          <p class="page-subtitle">Expenses from your direct reports</p>
        </div>
        <div class="card">
          <div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Employee</th><th>Description</th><th class="text-right">Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${team.length === 0 ? '<tr><td colspan="6" class="empty-cell">No team expenses</td></tr>' :
                team.map(e => `<tr>
                  <td class="text-muted">${UI.fmtDate(e.expense_date)}</td>
                  <td>${e.user_name || '—'}</td>
                  <td><strong>${e.description}</strong></td>
                  <td class="text-right">
                    <div class="amount-primary">${UI.fmtCurr(e.converted_amount, e.base_currency)}</div>
                    ${e.currency !== e.base_currency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
                  </td>
                  <td>${UI.statusBadge(e.status)}</td>
                  <td><button class="btn-icon" onclick="Pages.showExpenseDetail(${e.id})">${UI.icon('eye',14)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table></div>
        </div>`;
    } catch (err) { el.innerHTML = `<div class="error-state">${err.message}</div>`; }
  }

  // ══════════ MY EXPENSES ══════════
  async function myExpenses(el) {
    try {
      const exps = await Store.getExpenses('my');
      el.innerHTML = `
        <div class="page-header-row">
          <div><h1 class="page-title">My Expenses</h1><p class="page-subtitle">${exps.length} submissions</p></div>
          <button class="btn btn-primary" onclick="App.navigate('submit-expense')">${UI.icon('plusSmall',14)} New Expense</button>
        </div>
        <div class="card">
          <div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="text-right">Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${exps.length === 0 ? '<tr><td colspan="6" class="empty-cell">No expenses yet</td></tr>' :
                exps.map(e => `<tr>
                  <td class="text-muted">${UI.fmtDate(e.expense_date)}</td>
                  <td><strong>${e.description}</strong></td>
                  <td class="text-muted">${e.category || '—'}</td>
                  <td class="text-right">
                    <div class="amount-primary">${UI.fmtCurr(e.converted_amount, e.base_currency)}</div>
                    ${e.currency !== e.base_currency ? `<div class="amount-secondary">${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
                  </td>
                  <td>${UI.statusBadge(e.status)}</td>
                  <td><button class="btn-icon" onclick="Pages.showExpenseDetail(${e.id})">${UI.icon('eye',14)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table></div>
        </div>`;
    } catch (err) { el.innerHTML = `<div class="error-state">${err.message}</div>`; }
  }

  // ══════════ SUBMIT EXPENSE ══════════
  function submitExpense(el) {
    const company = Store.getCompanyCache();
    const bc = company?.base_currency || 'INR';

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Submit Expense</h1>
        <p class="page-subtitle">File a new reimbursement request</p>
      </div>
      <div class="grid-2">
        <!-- OCR Panel -->
        <div class="card">
          <div class="card-header">${UI.icon('camera')} Scan Receipt (OCR)</div>
          <div class="ocr-zone" id="ocrZone">
            <input type="file" accept="image/jpeg,image/png,image/webp" id="receiptFile" onchange="Pages.handleOCRFile(this)">
            ${UI.icons.upload}
            <p>Drop receipt image here or click to upload</p>
            <span class="ocr-hint">JPG, PNG supported · Powered by Tesseract.js</span>
          </div>
          <div id="ocrProgressArea" style="display:none"></div>
          <div id="ocrPreviewArea" style="display:none"></div>
        </div>

        <!-- Form -->
        <div class="card" style="position:relative">
          <div id="submitLoading" class="loading-overlay" style="display:none"><div class="spinner"></div><p>Processing…</p></div>
          <div class="card-header">${UI.icon('edit')} Expense Details</div>
          <div class="form-group">
            <label class="form-label">Description / Merchant *</label>
            <input class="form-input" id="expDesc" placeholder="e.g. Client dinner at Taj Hotel">
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Amount *</label>
              <input class="form-input" id="expAmount" type="number" step="0.01" min="0" placeholder="0.00" oninput="Pages.updateConversion()">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Currency</label>
              <select class="form-input" id="expCurrency" onchange="Pages.updateConversion()">
                ${UI.CURRENCIES.map(c => `<option value="${c}" ${c===bc?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Category</label>
              <select class="form-input" id="expCategory">
                ${UI.CATEGORIES.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Date *</label>
              <input class="form-input" id="expDate" type="date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-input" id="expNotes" rows="2" placeholder="Additional context…"></textarea>
          </div>

          <!-- Expense Lines -->
          <div class="form-group">
            <label class="form-label">Line Items <span class="text-muted">(optional)</span></label>
            <div id="expenseLines">
              <div class="line-item">
                <input class="form-input" placeholder="Item description" style="flex:2">
                <input class="form-input" type="number" step="0.01" placeholder="Amount" style="flex:1">
                <button class="btn-icon btn-icon-danger" onclick="this.parentElement.remove()" title="Remove">${UI.icon('minusSmall',14)}</button>
              </div>
            </div>
            <button class="btn btn-xs btn-secondary" onclick="Pages.addExpenseLine()" style="margin-top:6px">${UI.icon('plusSmall',12)} Add Line</button>
          </div>

          <div id="conversionPreview" style="display:none"></div>
          <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="Pages.submitExpenseForm()">Submit Expense</button>
        </div>
      </div>`;

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

  function addExpenseLine() {
    const container = document.getElementById('expenseLines');
    const div = document.createElement('div');
    div.className = 'line-item';
    div.innerHTML = `
      <input class="form-input" placeholder="Item description" style="flex:2">
      <input class="form-input" type="number" step="0.01" placeholder="Amount" style="flex:1">
      <button class="btn-icon btn-icon-danger" onclick="this.parentElement.remove()" title="Remove">${UI.icon('minusSmall',14)}</button>`;
    container.appendChild(div);
  }

  function handleOCRFile(input) {
    if (input.files && input.files[0]) processOCRFile(input.files[0]);
  }

  async function processOCRFile(file) {
    if (!file.type.startsWith('image/')) { App.toast('Please upload an image', 'error'); return; }

    try {
      const dataUrl = await OCR.readAsDataURL(file);
      const preview = document.getElementById('ocrPreviewArea');
      if (preview) { preview.style.display = 'block'; preview.innerHTML = `<img src="${dataUrl}" class="ocr-preview-img">`; }
    } catch {}

    const progressArea = document.getElementById('ocrProgressArea');
    if (progressArea) {
      progressArea.style.display = 'block';
      progressArea.innerHTML = `<div class="ocr-progress"><div class="spinner" style="width:16px;height:16px"></div><div style="flex:1"><div class="ocr-status" id="ocrStatus">Initializing…</div><div class="progress-track" style="margin-top:6px"><div class="progress-fill" id="ocrFill" style="width:5%"></div></div></div></div>`;
    }

    try {
      const result = await OCR.scanReceipt(file, ({ status, progress }) => {
        const s = document.getElementById('ocrStatus');
        const f = document.getElementById('ocrFill');
        if (s) s.textContent = status;
        if (f) f.style.width = Math.round(progress * 100) + '%';
      });

      if (result.merchant) { const el = document.getElementById('expDesc'); if (el) el.value = result.merchant; }
      if (result.amount != null) { const el = document.getElementById('expAmount'); if (el) el.value = result.amount; }
      if (result.currency) { const el = document.getElementById('expCurrency'); if (el) { for (let o of el.options) { if (o.value === result.currency) { o.selected = true; break; } } } }
      if (result.date) { const el = document.getElementById('expDate'); if (el) el.value = result.date; }
      if (result.category) { const el = document.getElementById('expCategory'); if (el) { for (let o of el.options) { if (o.value === result.category) { o.selected = true; break; } } } }

      // Fill line items
      if (result.lines && result.lines.length > 0) {
        const container = document.getElementById('expenseLines');
        container.innerHTML = '';
        result.lines.forEach(l => {
          const div = document.createElement('div');
          div.className = 'line-item';
          div.innerHTML = `<input class="form-input" value="${l.description}" style="flex:2"><input class="form-input" type="number" step="0.01" value="${l.amount}" style="flex:1"><button class="btn-icon btn-icon-danger" onclick="this.parentElement.remove()">${UI.icon('minusSmall',14)}</button>`;
          container.appendChild(div);
        });
      }

      if (progressArea) {
        progressArea.innerHTML = `<div class="ocr-progress ocr-success"><span style="color:var(--color-success);font-size:16px">✓</span><div><div class="ocr-status" style="color:var(--color-success)">Receipt scanned — fields auto-filled</div><div class="text-muted text-sm">${result.rawText ? `${result.rawText.split(/\s+/).length} words extracted` : ''} ${result.merchant ? `· ${result.merchant}` : ''}</div></div></div>`;
      }
      App.toast('Receipt scanned', 'success');
      updateConversion();
    } catch (err) {
      if (progressArea) {
        progressArea.innerHTML = `<div class="ocr-progress ocr-error"><span style="color:var(--color-danger)">✕</span><div class="ocr-status" style="color:var(--color-danger)">OCR failed — ${err.message || 'fill manually'}</div></div>`;
      }
      App.toast('OCR failed', 'error');
    }
  }

  let convTimeout = null;
  async function updateConversion() {
    clearTimeout(convTimeout);
    convTimeout = setTimeout(async () => {
      const bc = Store.getCompanyCache()?.base_currency || 'INR';
      const amt = parseFloat(document.getElementById('expAmount')?.value);
      const curr = document.getElementById('expCurrency')?.value;
      const el = document.getElementById('conversionPreview');
      if (!el) return;
      if (!amt || amt <= 0 || curr === bc) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.className = 'conversion-preview';
      el.innerHTML = `<div class="spinner" style="width:14px;height:14px"></div> Converting…`;
      try {
        const { converted, rate } = await ExternalAPI.convert(amt, curr, bc);
        el.innerHTML = `💱 ${UI.fmtCurr(amt, curr)} ≈ <strong>${UI.fmtCurr(converted, bc)}</strong><span class="text-muted" style="margin-left:auto;font-size:12px">1 ${curr} = ${rate.toFixed(4)} ${bc}</span>`;
      } catch { el.innerHTML = `<span style="color:var(--color-danger)">Could not fetch rate</span>`; }
    }, 300);
  }

  async function submitExpenseForm() {
    const desc = document.getElementById('expDesc')?.value.trim();
    const amount = parseFloat(document.getElementById('expAmount')?.value);
    const currency = document.getElementById('expCurrency')?.value;
    const category = document.getElementById('expCategory')?.value;
    const expense_date = document.getElementById('expDate')?.value;
    const notes = document.getElementById('expNotes')?.value.trim();

    if (!desc) { App.toast('Description required', 'error'); return; }
    if (!amount || amount <= 0) { App.toast('Enter a valid amount', 'error'); return; }
    if (!expense_date) { App.toast('Date required', 'error'); return; }

    const bc = Store.getCompanyCache()?.base_currency || 'INR';
    const loader = document.getElementById('submitLoading');
    if (loader) loader.style.display = 'flex';

    let converted_amount = amount;
    if (currency !== bc) {
      try { const { converted } = await ExternalAPI.convert(amount, currency, bc); converted_amount = converted; }
      catch { App.toast('Using original amount', 'info'); }
    }

    // Collect lines
    const lineEls = document.querySelectorAll('#expenseLines .line-item');
    const lines = [];
    lineEls.forEach(el => {
      const inputs = el.querySelectorAll('input');
      const d = inputs[0]?.value;
      const a = parseFloat(inputs[1]?.value);
      if (d || a) lines.push({ description: d, amount: a || 0 });
    });

    try {
      await Store.createExpense({ description: desc, amount, currency, converted_amount, base_currency: bc, category, expense_date, notes, lines });
      if (loader) loader.style.display = 'none';
      App.toast(`Expense submitted — ${UI.fmtCurr(converted_amount, bc)}`, 'success');
      App.navigate('my-expenses');
    } catch (err) {
      if (loader) loader.style.display = 'none';
      App.toast(err.message, 'error');
    }
  }

  // ══════════ EXPENSE DETAIL MODAL ══════════
  async function showExpenseDetail(expId) {
    try {
      const e = await Store.getExpense(expId);

      const timeline = (e.approval_log || []).map((log, i) => {
        const isLast = i === e.approval_log.length - 1;
        const isDone = log.action.includes('APPROVED');
        const isReject = log.action.includes('REJECTED');
        const isSubmit = log.action === 'SUBMITTED';
        const dotClass = isSubmit ? 'submitted' : isDone ? 'approved' : isReject ? 'rejected' : 'pending';
        const icon = isSubmit || isDone ? '✓' : isReject ? '✕' : '⏳';
        return `<div class="timeline-item">
          <div class="timeline-dot ${dotClass}">${icon}</div>
          <div>
            <div class="timeline-label">${log.action} by ${log.actor_name || 'System'}</div>
            <div class="timeline-date">${UI.fmtDateTime(log.created_at)}</div>
            ${log.comment ? `<div class="timeline-comment">"${log.comment}"</div>` : ''}
          </div>
        </div>`;
      }).join('');

      App.showModal(`
        <button class="modal-close" onclick="App.closeModal()">${UI.icon('x')}</button>
        <h3 class="modal-title">${e.description}</h3>
        <div class="detail-grid">
          <div class="detail-field">
            <div class="detail-label">Amount</div>
            <div class="detail-value-large">${UI.fmtCurr(e.converted_amount, e.base_currency)}</div>
            ${e.currency !== e.base_currency ? `<div class="text-muted text-sm">Original: ${UI.fmtCurr(e.amount, e.currency)}</div>` : ''}
          </div>
          <div class="detail-field">
            <div class="detail-label">Status</div>
            <div>${UI.statusBadge(e.status)}</div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Category</div>
            <div>${e.category || '—'}</div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Date</div>
            <div>${UI.fmtDate(e.expense_date)}</div>
          </div>
          <div class="detail-field full">
            <div class="detail-label">Submitted By</div>
            <div>${e.user_name || '—'}</div>
          </div>
          ${e.notes ? `<div class="detail-field full"><div class="detail-label">Notes</div><div class="text-muted">${e.notes}</div></div>` : ''}
        </div>

        ${e.lines && e.lines.length > 0 ? `
          <div class="detail-section">
            <div class="detail-section-title">Line Items</div>
            <table class="detail-table">
              <thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead>
              <tbody>${e.lines.map(l => `<tr><td>${l.description || '—'}</td><td class="text-right">${UI.fmtCurr(l.amount, e.currency)}</td></tr>`).join('')}</tbody>
            </table>
          </div>` : ''}

        ${e.approval_steps && e.approval_steps.length > 0 ? `
          <div class="detail-section">
            <div class="detail-section-title">Approval Pipeline</div>
            ${UI.approvalPipeline(e.approval_steps, e.current_step)}
          </div>` : ''}

        <div class="detail-section">
          <div class="detail-section-title">Activity Log</div>
          <div class="timeline">${timeline}</div>
        </div>`);
    } catch (err) { App.toast(err.message, 'error'); }
  }

  return {
    dashboard, companySetup, saveCompany,
    userManagement, showAddUserModal, addUser, showEditUserModal, editUser, deleteUser,
    approvalChain, chainTypeChanged, addChainStep, saveChain,
    approvalRules, ruleTypeChanged, addRule, saveRules,
    allExpenses, filterAllExpenses, adminAction,
    approvals, handleApproval,
    teamExpenses, myExpenses,
    submitExpense, addExpenseLine, handleOCRFile, updateConversion, submitExpenseForm,
    showExpenseDetail,
  };
})();

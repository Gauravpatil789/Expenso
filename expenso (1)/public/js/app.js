/* ══════════════════════════════════════════════════════════════
   APP — Main Application Controller
   ══════════════════════════════════════════════════════════════ */

const App = (() => {
  let currentPage = '';

  // ── Init ──
  async function init() {
    const session = await Store.restoreSession();
    if (session) {
      showApp();
    } else {
      showAuth();
    }
    loadSignupCountries();
  }

  // ── Auth ──
  function showAuth() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
  }

  function showLogin() {
    document.getElementById('loginPanel').style.display = 'block';
    document.getElementById('signupPanel').style.display = 'none';
  }

  function showSignup() {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('signupPanel').style.display = 'block';
  }

  function fillLogin(email, pass) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPass').value = pass;
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!email || !pass) { toast('Please enter email and password', 'error'); return false; }

    toggleBtn('loginBtn', true);
    try {
      await Store.login(email, pass);
      toast(`Welcome back, ${Store.getCurrentUser().name.split(' ')[0]}!`, 'success');
      showApp();
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
    }
    toggleBtn('loginBtn', false);
    return false;
  }

  async function handleSignup(event) {
    event.preventDefault();
    const companyName = document.getElementById('signupCompany').value.trim();
    const country = document.getElementById('signupCountry').value;
    const currency = document.getElementById('signupCurrency').value;
    const adminName = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPass').value;

    if (!companyName || !adminName || !email || !password) {
      toast('All fields are required', 'error');
      return false;
    }

    toggleBtn('signupBtn', true);
    try {
      await Store.signup(companyName, country, currency, adminName, email, password);
      toast('Account created! Welcome to Expenso.', 'success');
      showApp();
    } catch (err) {
      toast(err.message || 'Signup failed', 'error');
    }
    toggleBtn('signupBtn', false);
    return false;
  }

  async function loadSignupCountries() {
    try {
      const countries = await ExternalAPI.fetchCountries();
      const sel = document.getElementById('signupCountry');
      if (!sel) return;
      sel.innerHTML = '<option value="">Select a country</option>' +
        countries.map(c => {
          const curr = Object.keys(c.currencies)[0];
          return `<option value="${c.name.common}" data-currency="${curr}">${c.name.common} (${curr})</option>`;
        }).join('');
      sel.addEventListener('change', () => {
        const opt = sel.options[sel.selectedIndex];
        document.getElementById('signupCurrency').value = opt.dataset.currency || '';
      });
    } catch {}
  }

  function logout() {
    Store.logout();
    showAuth();
    showLogin();
  }

  // ── App Shell ──
  function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';
    renderSidebar();
    const user = Store.getCurrentUser();
    const defaultPage = user.role === 'admin' ? 'dashboard'
      : user.role === 'manager' ? 'approvals' : 'my-expenses';
    navigate(defaultPage);
  }

  // ── Sidebar ──
  async function renderSidebar() {
    const user = Store.getCurrentUser();
    const role = user.role;
    let pendingCount = 0;
    if (role === 'manager' || role === 'admin') {
      try {
        const res = await Store.getPendingCount();
        pendingCount = res.count;
      } catch {}
    }

    const items = [];
    if (role === 'admin') {
      items.push({ section: 'Overview' });
      items.push({ id: 'dashboard', icon: 'dashboard', label: 'Dashboard' });
      items.push({ section: 'Administration' });
      items.push({ id: 'company-setup', icon: 'settings', label: 'Company Setup' });
      items.push({ id: 'user-management', icon: 'users', label: 'Users' });
      items.push({ id: 'approval-chain', icon: 'workflow', label: 'Approval Chain' });
      items.push({ id: 'approval-rules', icon: 'rules', label: 'Approval Rules' });
      items.push({ section: 'Expenses' });
      items.push({ id: 'all-expenses', icon: 'list', label: 'All Expenses' });
    }
    if (role === 'manager') {
      items.push({ section: 'Overview' });
      items.push({ id: 'dashboard', icon: 'dashboard', label: 'Dashboard' });
      items.push({ section: 'Approvals' });
      items.push({ id: 'approvals', icon: 'check', label: 'Pending', badge: pendingCount });
      items.push({ id: 'team-expenses', icon: 'briefcase', label: 'Team Expenses' });
      items.push({ section: 'Personal' });
      items.push({ id: 'my-expenses', icon: 'receipt', label: 'My Expenses' });
      items.push({ id: 'submit-expense', icon: 'plus', label: 'New Expense' });
    }
    if (role === 'employee') {
      items.push({ section: 'Overview' });
      items.push({ id: 'dashboard', icon: 'dashboard', label: 'Dashboard' });
      items.push({ section: 'Expenses' });
      items.push({ id: 'my-expenses', icon: 'receipt', label: 'My Expenses' });
      items.push({ id: 'submit-expense', icon: 'plus', label: 'New Expense' });
    }

    document.getElementById('sidebarNav').innerHTML = items.map(it => {
      if (it.section) return `<div class="nav-section">${it.section}</div>`;
      return `<button class="nav-item ${currentPage === it.id ? 'active' : ''}" onclick="App.navigate('${it.id}')">
        ${UI.icon(it.icon)} <span>${it.label}</span>
        ${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}
      </button>`;
    }).join('');

    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase();
    document.getElementById('sidebarFooter').innerHTML = `
      <div class="user-card">
        <div class="user-avatar">${initials}</div>
        <div><div class="user-name">${user.name}</div><div class="user-role">${role}</div></div>
      </div>
      <button class="logout-btn" onclick="App.logout()">
        ${UI.icon('logout', 14)} <span>Sign Out</span>
      </button>`;
  }

  // ── Navigation ──
  function navigate(page) {
    currentPage = page;
    renderSidebar();
    document.getElementById('sidebar').classList.remove('open');
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    const renderers = {
      'dashboard': Pages.dashboard,
      'company-setup': Pages.companySetup,
      'user-management': Pages.userManagement,
      'approval-chain': Pages.approvalChain,
      'approval-rules': Pages.approvalRules,
      'all-expenses': Pages.allExpenses,
      'approvals': Pages.approvals,
      'team-expenses': Pages.teamExpenses,
      'my-expenses': Pages.myExpenses,
      'submit-expense': Pages.submitExpense,
    };
    if (renderers[page]) renderers[page](main);
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  // ── Helpers ──
  function toggleBtn(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (text) text.style.display = loading ? 'none' : 'inline';
    if (loader) loader.style.display = loading ? 'inline-block' : 'none';
    btn.disabled = loading;
  }

  function toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    const iconChar = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${iconChar}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 4000);
  }

  function showModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
  }

  return {
    get currentUser() { return Store.getCurrentUser(); },
    init, fillLogin, handleLogin, handleSignup, showLogin, showSignup, logout,
    navigate, toggleSidebar, renderSidebar,
    toast, showModal, closeModal, toggleBtn,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);

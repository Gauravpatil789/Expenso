/* ══════════════════════════════════════════════════════════════
   APP — Main Application Controller
   ══════════════════════════════════════════════════════════════ */

const App = (() => {
  let currentUser = null;
  let currentPage = '';

  // ── Init ──
  function init() {
    Store.initSeed();
    const sid = Store.getSession();
    if (sid) {
      const user = Store.getUser(sid);
      if (user) {
        currentUser = user;
        showApp();
        return;
      }
    }
    showLogin();
  }

  // ── Login ──
  function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
  }

  function fillLogin(email, pass) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPass').value = pass;
  }

  function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pass = document.getElementById('loginPass').value;

    if (!email || !pass) {
      toast('Please enter email and password', 'error');
      return false;
    }

    const btnText = document.querySelector('#loginBtn .btn-text');
    const btnLoader = document.querySelector('#loginBtn .btn-loader');
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'inline-block';

    // Small delay for UX
    setTimeout(() => {
      const users = Store.getUsers();
      const user = users.find(u => u.email === email && u.password === pass);

      if (btnText) btnText.style.display = 'inline';
      if (btnLoader) btnLoader.style.display = 'none';

      if (!user) {
        toast('Invalid email or password', 'error');
        return;
      }

      currentUser = user;
      Store.setSession(user.id);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      showApp();
    }, 500);

    return false;
  }

  function logout() {
    currentUser = null;
    Store.clearSession();
    showLogin();
  }

  // ── App Shell ──
  function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
    renderSidebar();
    const defaultPage = currentUser.role === 'admin' ? 'dashboard'
      : currentUser.role === 'manager' ? 'approvals' : 'my-expenses';
    navigate(defaultPage);
  }

  // ── Sidebar ──
  function renderSidebar() {
    const role = currentUser.role;
    const expenses = Store.getExpenses();
    const pendingCount = role === 'manager'
      ? expenses.filter(e => e.status === 'PENDING' && e.managerId === currentUser.id).length : 0;

    const items = [];
    if (role === 'admin') {
      items.push({ section: 'Overview' });
      items.push({ id: 'dashboard', icon: 'dashboard', label: 'Dashboard' });
      items.push({ section: 'Administration' });
      items.push({ id: 'company-setup', icon: 'settings', label: 'Company Setup' });
      items.push({ id: 'user-management', icon: 'users', label: 'User Management' });
      items.push({ section: 'Expenses' });
      items.push({ id: 'all-expenses', icon: 'list', label: 'All Expenses' });
    }
    if (role === 'manager') {
      items.push({ section: 'Overview' });
      items.push({ id: 'dashboard', icon: 'dashboard', label: 'Dashboard' });
      items.push({ section: 'Manage' });
      items.push({ id: 'approvals', icon: 'checkSquare', label: 'Approvals', badge: pendingCount });
      items.push({ id: 'team-expenses', icon: 'briefcase', label: 'Team Expenses' });
      items.push({ section: 'Personal' });
      items.push({ id: 'my-expenses', icon: 'receipt', label: 'My Expenses' });
      items.push({ id: 'submit-expense', icon: 'plusCircle', label: 'New Expense' });
    }
    if (role === 'employee') {
      items.push({ section: 'Overview' });
      items.push({ id: 'dashboard', icon: 'dashboard', label: 'Dashboard' });
      items.push({ section: 'Expenses' });
      items.push({ id: 'my-expenses', icon: 'receipt', label: 'My Expenses' });
      items.push({ id: 'submit-expense', icon: 'plusCircle', label: 'New Expense' });
    }

    document.getElementById('sidebarNav').innerHTML = items.map(it => {
      if (it.section) {
        return `<div class="nav-section-label">${it.section}</div>`;
      }
      return `
        <button class="nav-item ${currentPage === it.id ? 'active' : ''}"
                data-page="${it.id}" onclick="App.navigate('${it.id}')">
          ${UI.icon(it.icon)}
          <span>${it.label}</span>
          ${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}
        </button>`;
    }).join('');

    // Footer
    const initials = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase();
    document.getElementById('sidebarFooter').innerHTML = `
      <div class="user-info-row">
        <div class="user-avatar">${initials}</div>
        <div>
          <div class="user-name">${currentUser.name}</div>
          <div class="user-role-label">${currentUser.role}</div>
        </div>
      </div>
      <button class="logout-btn" onclick="App.logout()">
        ${UI.icon('logout', 14)}
        <span>Sign Out</span>
      </button>`;
  }

  // ── Navigation ──
  function navigate(page) {
    currentPage = page;
    renderSidebar();
    const main = document.getElementById('mainContent');

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');

    const renderers = {
      'dashboard': Pages.dashboard,
      'company-setup': Pages.companySetup,
      'user-management': Pages.userManagement,
      'all-expenses': Pages.allExpenses,
      'approvals': Pages.approvals,
      'team-expenses': Pages.teamExpenses,
      'my-expenses': Pages.myExpenses,
      'submit-expense': Pages.submitExpense,
    };

    if (renderers[page]) {
      renderers[page](main);
    }
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  // ── Toast ──
  function toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    const iconChar = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${iconChar}</span><span>${msg}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  // ── Modal ──
  function showModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
  }

  // ── Public API ──
  return {
    get currentUser() { return currentUser; },
    init, fillLogin, handleLogin, logout,
    navigate, toggleSidebar, renderSidebar,
    toast, showModal, closeModal,
  };
})();

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', App.init);

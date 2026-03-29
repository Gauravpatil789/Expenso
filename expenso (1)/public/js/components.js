/* ══════════════════════════════════════════════════════════════
   COMPONENTS — Reusable UI Helpers (Light Enterprise)
   ══════════════════════════════════════════════════════════════ */

const UI = (() => {
  function fmtCurr(amount, currency) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: currency || 'INR',
        maximumFractionDigits: 2, minimumFractionDigits: 0
      }).format(amount || 0);
    } catch { return `${currency} ${Number(amount || 0).toFixed(2)}`; }
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function statusBadge(status) {
    const cls = { PENDING: 'status-pending', APPROVED: 'status-approved', REJECTED: 'status-rejected' }[status] || 'status-pending';
    const labels = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
    return `<span class="status-badge ${cls}">${labels[status] || status}</span>`;
  }

  function roleBadge(role) {
    const cls = { admin: 'role-admin', manager: 'role-manager', employee: 'role-employee' }[role] || 'role-employee';
    return `<span class="role-badge ${cls}">${role}</span>`;
  }

  // SVG Icons (minimal line icons)
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 10h8"/><path d="M8 14h8"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    workflow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3v12"/><path d="M18 9v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 6h6a3 3 0 0 1 3 3v3"/></svg>',
    rules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    upload: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 18 15 12 9 6"/></svg>',
    plusSmall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    minusSmall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  };

  function icon(name, size = 18) {
    return `<span class="icon" style="width:${size}px;height:${size}px">${icons[name] || ''}</span>`;
  }

  const CURRENCIES = ['INR','USD','EUR','GBP','JPY','AUD','CAD','CHF','SGD','CNY','SEK','NOK','DKK','NZD','ZAR','BRL','MXN','KRW','THB','MYR','AED','SAR','HKD','TWD','PHP','IDR','VND','PKR','BDT','LKR'];
  const CATEGORIES = ['Meals','Travel','Accommodation','Office','Software','Communication','Entertainment','Other'];

  // Approval step pipeline visualization
  function approvalPipeline(steps, currentStep) {
    if (!steps || steps.length === 0) return '<div class="pipeline-empty">No approval steps configured</div>';
    return `<div class="pipeline">${steps.map((s, i) => {
      const isActive = s.step_order === currentStep && s.status === 'PENDING';
      const isDone = s.status === 'APPROVED';
      const isRejected = s.status === 'REJECTED';
      const dotClass = isDone ? 'done' : isRejected ? 'rejected' : isActive ? 'active' : 'waiting';
      const label = isDone ? '✓' : isRejected ? '✕' : isActive ? '●' : (i + 1);
      return `<div class="pipeline-step ${dotClass}">
        <div class="pipeline-dot">${label}</div>
        <div class="pipeline-info">
          <div class="pipeline-label">${s.approver_label || `Step ${i+1}`}</div>
          <div class="pipeline-approver">${s.approver_name || '—'}</div>
          ${s.comment ? `<div class="pipeline-comment">"${s.comment}"</div>` : ''}
        </div>
        ${i < steps.length - 1 ? '<div class="pipeline-line"></div>' : ''}
      </div>`;
    }).join('')}</div>`;
  }

  return {
    fmtCurr, fmtDate, fmtDateTime,
    statusBadge, roleBadge,
    icons, icon,
    approvalPipeline,
    CURRENCIES, CATEGORIES,
  };
})();

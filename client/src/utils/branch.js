export const BRANCH_STORAGE_KEY = 'vth_selected_branch_id';

function getCurrentUserRole() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return String(parsed?.role || '').toLowerCase();
  } catch {
    return '';
  }
}

export function getSelectedBranchId() {
  if (typeof window === 'undefined') return 'all';
  const value = localStorage.getItem(BRANCH_STORAGE_KEY);
  return value && value !== 'undefined' && value !== 'null' ? value : 'all';
}

export function setSelectedBranchId(value) {
  if (typeof window === 'undefined') return;
  const normalized = value && value !== 'undefined' && value !== 'null' ? String(value) : 'all';
  localStorage.setItem(BRANCH_STORAGE_KEY, normalized);
  window.dispatchEvent(new Event('vth_branch_changed'));
}

export function branchParams(selectedBranchId) {
  // Staff must stay token-scoped to their assigned branch.
  if (getCurrentUserRole() === 'staff') return {};

  const normalized = selectedBranchId && selectedBranchId !== 'undefined' && selectedBranchId !== 'null'
    ? String(selectedBranchId)
    : getSelectedBranchId();

  // Admin/manager can choose branch scope from settings; default remains all.
  return normalized && normalized !== 'all' ? { branch_id: normalized } : { branch_id: 'all' };
}


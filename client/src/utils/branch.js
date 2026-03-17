export const BRANCH_STORAGE_KEY = 'vth_selected_branch_id';

export function getSelectedBranchId() {
  if (typeof window === 'undefined') return 'all';
  return localStorage.getItem(BRANCH_STORAGE_KEY) || 'all';
}

export function setSelectedBranchId(value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BRANCH_STORAGE_KEY, value || 'all');
}

export function branchParams(selectedBranchId) {
  const v = selectedBranchId || 'all';
  if (v === 'all') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? { branch_id: n } : undefined;
}


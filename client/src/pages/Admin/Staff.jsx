import { useState, useEffect } from 'react';
import { getStaff, createStaff, updateStaff, toggleBlockStaff, deleteStaff, resetStaffPassword, getBranches } from '../../services/api';
import Loading from '../../components/Loading';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { RiLockPasswordLine } from 'react-icons/ri';

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('vth_selected_branch_id') || '';
};

export default function Staff() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', branch: 'Ahmedabad', branch_id: '' });
  const [branches, setBranches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pwModal, setPwModal] = useState({ open: false, staff: null });
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const branchId = getSelectedBranchId();
    const params = branchId ? { branch_id: branchId } : undefined;
    getStaff(params).then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    getBranches().then((r) => setBranches(r.data || [])).catch(() => setBranches([]));
  }, []);

  const openAdd = () => {
    const selectedId = getSelectedBranchId();
    const defaultBranch = branches.find((b) => String(b.id) === selectedId) || branches[0] || null;
    const branchLabel = defaultBranch ? defaultBranch.name : 'Ahmedabad';
    setForm({ name: '', email: '', password: '', role: 'staff', branch: branchLabel, branch_id: defaultBranch?.id || '' });
    setModal({ open: true, data: null });
  };
  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      email: row.email || '',
      password: '',
      role: row.role || 'staff',
      branch: row.branch || 'Ahmedabad',
      branch_id: row.branch_id || '',
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast('Name and email required', 'error'); return; }
    setSaving(true);
    if (modal.data) {
      updateStaff(modal.data.id, { name: form.name, email: form.email, role: 'staff', branch: form.branch, branch_id: form.branch_id || null })
        .then(() => { toast('Staff updated'); setModal({ open: false, data: null }); load(); })
        .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
        .finally(() => setSaving(false));
    } else {
      if (!form.password) { toast('Password required for new staff', 'error'); setSaving(false); return; }
      createStaff({ ...form, branch_id: form.branch_id || null })
        .then(() => { toast('Staff added'); setModal({ open: false, data: null }); load(); })
        .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
        .finally(() => setSaving(false));
    }
  };

  const handleBlock = (row) => {
    toggleBlockStaff(row.id, !row.is_blocked)
      .then(() => { toast(row.is_blocked ? 'Unblocked' : 'Blocked'); load(); })
      .catch(() => toast('Failed', 'error'));
  };

  const openResetPw = (row) => {
    setNewPw('');
    setShowPw(false);
    setPwModal({ open: true, staff: row });
  };

  const handleResetPw = (e) => {
    e.preventDefault();
    if (!newPw || newPw.length < 4) { toast('Password must be at least 4 characters', 'error'); return; }
    setPwSaving(true);
    resetStaffPassword(pwModal.staff.id, newPw)
      .then(() => { toast(`Password reset for ${pwModal.staff.name}`); setPwModal({ open: false, staff: null }); })
      .catch((err) => toast(err.response?.data?.message || 'Reset failed', 'error'))
      .finally(() => setPwSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete staff "${row.name}"? This cannot be undone.`)) return;
    deleteStaff(row.id)
      .then(() => { toast('Staff deleted'); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Staff</h1>
        <Button onClick={openAdd}>+ Add Staff</Button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <Loading /> : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No staff. Add manager or staff members.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Branch</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{row.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.email || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.branch || '-'}</td>
                    <td className="px-5 py-3.5 text-center">
                      {row.is_blocked
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Blocked</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(row)} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Edit</button>
                        <button onClick={() => openResetPw(row)} title="Reset Password" className="px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition flex items-center gap-1">
                          <RiLockPasswordLine /> Password
                        </button>
                        <button onClick={() => handleBlock(row)} className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${row.is_blocked ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}>{row.is_blocked ? 'Unblock' : 'Block'}</button>
                        <button onClick={() => handleDelete(row)} className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {pwModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <RiLockPasswordLine className="text-base" /> Reset Password
              </h2>
              <button onClick={() => setPwModal({ open: false, staff: null })} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
            </div>
            <form onSubmit={handleResetPw} className="px-6 py-5 space-y-4">
              <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                <p className="text-xs text-violet-500 font-medium">Resetting password for</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{pwModal.staff?.name}</p>
                <p className="text-xs text-slate-500">{pwModal.staff?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm pr-16 focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none"
                    required
                    minLength={4}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimum 4 characters</p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setPwModal({ open: false, staff: null })} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={pwSaving} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition disabled:opacity-60">
                  {pwSaving ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        title={modal.data ? 'Edit Staff' : 'Add Staff'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={!!modal.data}
            />
          </div>
          {!modal.data && (
            <Input
              label="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <select
              value={form.branch_id}
              onChange={(e) => {
                const val = e.target.value;
                const b = branches.find((br) => String(br.id) === val);
                setForm((prev) => ({
                  ...prev,
                  branch_id: val,
                  branch: b ? b.name : prev.branch,
                }));
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal({ open: false, data: null })}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

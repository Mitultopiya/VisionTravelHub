import { useState, useEffect } from 'react';
import { getCities, createCity, updateCity, deleteCity, getBranches } from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../context/ToastContext';
import { getSelectedBranchId, branchParams } from '../../../utils/branch';

export default function Cities() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', country: 'India' });
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());

  const load = () => {
    setLoading(true);
    getCities(branchParams(branchId)).then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    getBranches().then((r) => setBranches(r.data || [])).catch(() => setBranches([]));
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  const openAdd = () => { setForm({ name: '', country: 'India', branch_id: branchId !== 'all' ? String(branchId) : '' }); setModal({ open: true, data: null }); };
  const openEdit = (row) => { setForm({ name: row.name || '', country: row.country || 'India', branch_id: row.branch_id ? String(row.branch_id) : (branchId !== 'all' ? String(branchId) : '') }); setModal({ open: true, data: row }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, branch_id: form.branch_id ? Number(form.branch_id) : undefined };
    (modal.data ? updateCity(modal.data.id, payload) : createCity(payload))
      .then(() => { toast(modal.data ? 'City updated' : 'City added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteCity(row.id).then(() => { toast('City deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">States</h1>
        <Button onClick={openAdd}>+ Add State</Button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <Loading /> : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No states. Add your first state.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Branch</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{row.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.branch_name || '-'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(row)} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Edit</button>
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
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit State' : 'Add State'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
            <select
              value={form.branch_id || (branchId !== 'all' ? String(branchId) : '')}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">— Select Branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
          <Input label="State Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

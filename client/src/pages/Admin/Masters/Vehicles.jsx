import { useState, useEffect } from 'react';
import { getVehicles, getCities, createVehicle, updateVehicle, deleteVehicle } from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../context/ToastContext';

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('vth_selected_branch_id') || '';
};

export default function Vehicles() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', type: '', capacity: '', price: '', city_id: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const branchId = getSelectedBranchId();
    const params = branchId ? { branch_id: branchId } : undefined;
    Promise.all([getVehicles(params), getCities(params)])
      .then(([v, c]) => {
        setList(v.data || []);
        setCities(c.data || []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ name: '', type: '', capacity: '', price: '', city_id: '' });
    setModal({ open: true, data: null });
  };
  const openEdit = (row) => {
    setForm({
      name: row.name || '',
      type: row.type || '',
      capacity: row.capacity ?? '',
      price: row.price != null ? String(row.price) : '',
      city_id: row.city_id ?? '',
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const branchId = getSelectedBranchId();
    const payload = {
      ...form,
      capacity: form.capacity ? Number(form.capacity) : null,
      price: form.price ? Number(form.price) : null,
      city_id: form.city_id ? Number(form.city_id) : null,
      ...(branchId ? { branch_id: Number(branchId) } : {}),
    };
    (modal.data ? updateVehicle(modal.data.id, payload) : createVehicle(payload))
      .then(() => { toast(modal.data ? 'Vehicle updated' : 'Vehicle added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteVehicle(row.id).then(() => { toast('Vehicle deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  const getCityName = (id) => cities.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Vehicles</h1>
        <Button onClick={openAdd}>+ Add Vehicle</Button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <Loading /> : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No vehicles. Add your first vehicle.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Type</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Capacity</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Price</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">City</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{row.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.type || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-center text-slate-600">{row.capacity ?? '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-right font-medium text-slate-800">{row.price != null ? `₹${Number(row.price).toLocaleString()}` : '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{getCityName(row.city_id)}</td>
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
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="e.g. SUV, Bus" />
          <Input label="Capacity" type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Seats" />
          <Input label="Price" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Vehicle price" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <select
              value={form.city_id}
              onChange={(e) => setForm({ ...form, city_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Select —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

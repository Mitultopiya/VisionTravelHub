import { useState, useEffect, useMemo } from 'react';
import { getCities, createCity, updateCity, deleteCity } from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { useToast } from '../../../context/ToastContext';
import { getSelectedBranchId, branchParams } from '../../../utils/branch';
import { getUniqueStates } from '../../../utils/cities';

const STATE_OPTIONS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export default function Cities() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', country: '' });
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [openGroups, setOpenGroups] = useState({});

  const load = () => {
    setLoading(true);
    getCities(branchParams(branchId)).then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  const groupedCities = useMemo(() => {
    const states = getUniqueStates(list);
    return states.map((stateName) => ({
      stateName,
      cities: list.filter((row) => String(row.country || '').trim() === stateName),
    }));
  }, [list]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = {};
      groupedCities.forEach(({ stateName }, index) => {
        next[stateName] = prev[stateName] ?? index === 0;
      });
      return next;
    });
  }, [groupedCities]);

  const openAdd = () => { setForm({ name: '', country: '' }); setModal({ open: true, data: null }); };
  const openEdit = (row) => { setForm({ name: row.name || '', country: row.country || '' }); setModal({ open: true, data: row }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, country: form.country || null };
    (modal.data ? updateCity(modal.data.id, payload) : createCity(payload))
      .then(() => { toast(modal.data ? 'City updated' : 'City added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteCity(row.id)
      .then(() => {
        toast('City deleted');
        load();
      })
      .catch((err) => {
        const apiMessage = err?.response?.data?.message;
        const apiDetail = err?.response?.data?.detail;
        const detailText = apiDetail ? ` (${apiDetail})` : '';
        toast(apiMessage ? `${apiMessage}${detailText}` : 'Delete failed', 'error');
      });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Cities</h1>
        <Button onClick={openAdd}>+ Add City</Button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <Loading /> : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No cities yet. Add your first city.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedCities.map(({ stateName, cities }) => (
              <div key={stateName} className="py-2">
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [stateName]: !prev[stateName] }))}
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition text-left"
                >
                  <div className="flex items-center gap-3">
                    {openGroups[stateName] ? (
                      <FaChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <FaChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <h2 className="text-sm font-semibold text-slate-800">{stateName}</h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    {cities.length} cit{cities.length === 1 ? 'y' : 'ies'}
                  </span>
                </button>
                {openGroups[stateName] && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full min-w-[280px]">
                      <thead>
                        <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                          <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">State</th>
                          <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">City</th>
                          <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cities.map((row, i) => (
                          <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                            <td className="px-5 py-3.5 text-sm text-slate-600">{row.country || '-'}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{row.name || '-'}</td>
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
            ))}
          </div>
        )}
      </div>
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit City' : 'Add City'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
            <select
              value={form.country || ''}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">-- Select State --</option>
              {STATE_OPTIONS.map((stateName) => (
                <option key={stateName} value={stateName}>{stateName}</option>
              ))}
            </select>
          </div>
          <Input
            label="City Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Ahmedabad"
            required
          />
          <p className="text-xs text-slate-500">
            Example: Select State = Gujarat, City Name = Ahmedabad.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

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

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const makeEmptyMonthPrices = () => monthNames.reduce((acc, m) => {
    acc[m] = '';
    return acc;
  }, {});

  const [form, setForm] = useState({
    name: '',
    type: '',
    capacity: '',
    city_id: '',
    base_price: '',
    markup_price: '',
    price: '',
    month_prices: makeEmptyMonthPrices(),
    contact_person: '',
    contact_mobile: '',
  });
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
    setForm({
      name: '',
      type: '',
      capacity: '',
      city_id: '',
      base_price: '',
      markup_price: '',
      price: '',
      month_prices: makeEmptyMonthPrices(),
      contact_person: '',
      contact_mobile: '',
    });
    setModal({ open: true, data: null });
  };
  const openEdit = (row) => {
    let contact_person = '';
    let contact_mobile = '';
    if (row.contact) {
      const parts = String(row.contact).split('|');
      contact_person = parts[0] || '';
      contact_mobile = parts[1] || '';
    }
    const month_prices = makeEmptyMonthPrices();
    if (row.month_prices && typeof row.month_prices === 'object') {
      monthNames.forEach((m) => {
        if (row.month_prices[m] != null) {
          month_prices[m] = String(row.month_prices[m]);
        }
      });
    }
    setForm({
      name: row.name || '',
      type: row.type || '',
      capacity: row.capacity ?? '',
      city_id: row.city_id ?? '',
      base_price: row.base_price != null ? String(row.base_price) : '',
      markup_price: row.markup_price != null ? String(row.markup_price) : '',
      price: row.price != null ? String(row.price) : '',
      month_prices,
      contact_person,
      contact_mobile,
    });
    setModal({ open: true, data: row });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const branchId = getSelectedBranchId();
    const contactCombined = form.contact_person || form.contact_mobile
      ? `${form.contact_person || ''}|${form.contact_mobile || ''}`
      : undefined;
    const base = Number(form.base_price || 0);
    const markup = Number(form.markup_price || 0);
    const finalPrice = base + markup || Number(form.price || 0) || 0;
    const payload = {
      ...form,
      contact: contactCombined,
      capacity: form.capacity ? Number(form.capacity) : null,
      base_price: form.base_price ? Number(form.base_price) : null,
      markup_price: form.markup_price ? Number(form.markup_price) : null,
      price: finalPrice || null,
      city_id: form.city_id ? Number(form.city_id) : null,
      month_prices: form.month_prices,
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No vehicles. Add your first vehicle.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(
              list.reduce((acc, row) => {
                const state = getCityName(row.city_id);
                if (!acc[state]) acc[state] = [];
                acc[state].push(row);
                return acc;
              }, {})
            ).map(([stateName, vehiclesInState]) => (
              <div key={stateName} className="px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {stateName}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {vehiclesInState.length} vehicle{vehiclesInState.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                        <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">
                          Name
                        </th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">
                          Type
                        </th>
                        <th className="text-center px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">
                          Capacity
                        </th>
                        <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">
                          Price
                        </th>
                        <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vehiclesInState.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">
                            {row.name || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">
                            {row.type || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-center text-slate-600">
                            {row.capacity ?? '-'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-right font-medium text-slate-800">
                            {row.price != null ? `₹${Number(row.price).toLocaleString()}` : '-'}
                            {(row.base_price != null || row.markup_price != null) && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {`Base: ₹${Number(row.base_price || 0).toLocaleString()} • Markup: ₹${Number(row.markup_price || 0).toLocaleString()}`}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEdit(row)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(row)}
                                className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="e.g. SUV, Bus" />
          <Input label="Capacity" type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Seats" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Base Price"
              type="number"
              min="0"
              step="0.01"
              value={form.base_price}
              onChange={(e) => {
                const val = e.target.value;
                const num = val === '' ? '' : Number(val);
                const markup = Number(form.markup_price || 0);
                const finalPrice = (num || 0) + markup;
                const finalStr = String(finalPrice || '');
                const month_prices = Object.fromEntries(monthNames.map((m) => [m, finalStr]));
                setForm((prev) => ({
                  ...prev,
                  base_price: val,
                  price: finalStr,
                  month_prices,
                }));
              }}
            />
            <Input
              label="Markup Price"
              type="number"
              min="0"
              step="0.01"
              value={form.markup_price}
              onChange={(e) => {
                const val = e.target.value;
                const num = val === '' ? '' : Number(val);
                const base = Number(form.base_price || 0);
                const finalPrice = base + (num || 0);
                const finalStr = String(finalPrice || '');
                const month_prices = Object.fromEntries(monthNames.map((m) => [m, finalStr]));
                setForm((prev) => ({
                  ...prev,
                  markup_price: val,
                  price: finalStr,
                  month_prices,
                }));
              }}
            />
          </div>
          <Input
            label="Final Price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => {
              const finalStr = e.target.value;
              const month_prices = Object.fromEntries(monthNames.map((m) => [m, finalStr]));
              setForm((prev) => ({
                ...prev,
                price: finalStr,
                month_prices,
              }));
            }}
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Month-wise Pricing</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {monthNames.map((month) => (
                <div key={month}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{month}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary-500"
                    value={form.month_prices?.[month] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        month_prices: {
                          ...(prev.month_prices || {}),
                          [month]: val,
                        },
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Person Name"
              value={form.contact_person}
              onChange={(e) => {
                const raw = e.target.value;
                const cleaned = raw.replace(/[^a-zA-Z\\s]/g, '');
                setForm({ ...form, contact_person: cleaned });
              }}
            />
            <Input
              label="Contact Person Mobile"
              value={form.contact_mobile}
              onChange={(e) => {
                const raw = e.target.value;
                const cleaned = raw.replace(/\\D/g, '');
                setForm({ ...form, contact_mobile: cleaned });
              }}
            />
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

import { useEffect, useMemo, useState } from 'react';
import {
  createItineraryTemplate,
  deleteItineraryTemplate,
  getCities,
  getItineraryTemplateCities,
  getItineraryTemplates,
  updateItineraryTemplate,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { branchParams, getSelectedBranchId } from '../../utils/branch';
import { filterCitiesByState, getUniqueStates } from '../../utils/cities';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/DataTable';
import Loading from '../../components/Loading';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

const defaultCityOptions = {
  kerala: ['Munnar', 'Thekkady', 'Alleppey', 'Kovalam', 'Kochi'],
  goa: ['North Goa', 'South Goa', 'Panaji'],
  himachal: ['Shimla', 'Manali', 'Dharamshala'],
};

const emptyRow = () => ({ city_name: '', night_count: 1, use_custom: false });
const emptyForm = () => ({
  title: '',
  state_name: '',
  is_active: true,
  days: [emptyRow()],
});

export default function Itinerary() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allCities, setAllCities] = useState([]);
  const [stateCities, setStateCities] = useState([]);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState(() => emptyForm());

  const totalNights = useMemo(
    () => form.days.reduce((sum, d) => sum + Math.max(0, Number(d.night_count || 0)), 0),
    [form.days]
  );
  const planPreview = useMemo(() => {
    const valid = form.days.filter((d) => d.city_name && Number(d.night_count) > 0);
    if (!valid.length) return '';
    const body = valid.map((d) => `${Number(d.night_count)}N ${d.city_name}`).join(' / ');
    return `${body} (${totalNights} Nights)`;
  }, [form.days, totalNights]);

  const loadTemplates = () => {
    setLoading(true);
    getItineraryTemplates(branchParams(branchId))
      .then((r) => setList(r.data || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, [branchId]);

  useEffect(() => {
    getCities(branchParams(branchId)).then((r) => setAllCities(r.data || [])).catch(() => setAllCities([]));
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, [branchId]);

  const states = useMemo(() => getUniqueStates(allCities), [allCities]);

  useEffect(() => {
    if (!form.state_name) {
      setStateCities([]);
      return;
    }
    const baseOptions = filterCitiesByState(allCities, form.state_name).map((city) => ({
      id: city.id,
      name: city.name,
    }));
    getItineraryTemplateCities({ state_name: form.state_name, ...(branchParams(branchId) || {}) })
      .then((r) => setStateCities([...(r.data || []), ...baseOptions]))
      .catch(() => setStateCities(baseOptions));
  }, [allCities, form.state_name, branchId]);

  const openCreate = () => {
    setForm(emptyForm());
    setModal({ open: true, data: null });
  };

  const openEdit = (row) => {
    setForm({
      title: row.title || '',
      state_name: row.state_name || '',
      is_active: !!row.is_active,
      days: Array.isArray(row.days) && row.days.length
        ? row.days.map((d) => ({ city_id: d.city_id || null, city_name: d.city_name || '', night_count: Number(d.night_count || 1), use_custom: false }))
        : [emptyRow()],
    });
    setModal({ open: true, data: row });
  };

  const addRow = () => setForm((prev) => ({ ...prev, days: [...prev.days, emptyRow()] }));
  const removeRow = (idx) => {
    setForm((prev) => ({ ...prev, days: prev.days.length > 1 ? prev.days.filter((_, i) => i !== idx) : prev.days }));
  };
  const updateDay = (idx, key, value) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === idx ? { ...d, [key]: value } : d)),
    }));
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.state_name) return 'State is required.';
    if (!form.days.length) return 'Add at least one city row.';
    for (const d of form.days) {
      if (!String(d.city_name || '').trim()) return 'City is required in each row.';
      if (Number(d.night_count) <= 0) return 'Nights must be greater than 0 in each row.';
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast(error, 'error');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      state_name: form.state_name,
      branch_id: modal.data?.branch_id ? Number(modal.data.branch_id) : undefined,
      is_active: Boolean(form.is_active),
      days: form.days.map((d) => ({
        city_id: d.city_id ? Number(d.city_id) : null,
        city_name: String(d.city_name || '').trim(),
        night_count: Number(d.night_count),
      })),
    };
    const req = modal.data
      ? updateItineraryTemplate(modal.data.id, payload)
      : createItineraryTemplate(payload);
    req
      .then(() => {
        toast(modal.data ? 'Itinerary template updated' : 'Itinerary template created');
        setModal({ open: false, data: null });
        loadTemplates();
      })
      .catch((err) => toast(err.response?.data?.message || 'Save failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Disable itinerary template "${row.title}"?`)) return;
    deleteItineraryTemplate(row.id)
      .then(() => {
        toast('Itinerary template disabled');
        loadTemplates();
      })
      .catch((err) => toast(err.response?.data?.message || 'Delete failed', 'error'));
  };

  const cityOptions = useMemo(() => {
    const defaults = form.state_name ? (defaultCityOptions[String(form.state_name || '').toLowerCase()] || []) : [];
    const fromApi = (stateCities || []).map((c) => c.name).filter(Boolean);
    return [...new Set([...fromApi, ...defaults])];
  }, [form.state_name, stateCities]);

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'state_name', label: 'State' },
    { key: 'total_nights', label: 'Nights' },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'plan',
      label: 'Preview',
      render: (r) => <span className="text-xs text-slate-600">{r.plan || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Itinerary Templates</h1>
        <Button onClick={openCreate} className="w-full sm:w-auto">+ Create Template</Button>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={columns}
            data={list}
            emptyMessage="No itinerary templates found."
            actions={(row) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Disable</Button>
              </div>
            )}
          />
        )}
      </Card>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        title={modal.data ? 'Edit Itinerary Template' : 'Create Itinerary Template'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="2N Munnar / 1N Thekkady / ..."
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
              <select
                value={form.state_name}
                onChange={(e) => setForm({ ...form, state_name: e.target.value, days: [emptyRow()] })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Select State</option>
                {states.map((stateName) => (
                  <option key={stateName} value={stateName}>{stateName}</option>
                ))}
              </select>
            </div>
            <Input label="Total Nights" value={totalNights} readOnly />
          </div>

          <div className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-semibold text-slate-800">Plan Builder</h3>
              <Button type="button" size="sm" onClick={addRow}>+ Add City</Button>
            </div>

            {form.days.map((d, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-8">
                  <label className="block text-xs font-medium text-slate-600 mb-1">City *</label>
                  <select
                    value={d.use_custom ? '__custom__' : d.city_name}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setForm((prev) => ({
                          ...prev,
                          days: prev.days.map((day, i) => (i === idx ? { ...day, city_name: '', use_custom: true } : day)),
                        }));
                        return;
                      }
                      setForm((prev) => ({
                        ...prev,
                        days: prev.days.map((day, i) => (i === idx ? { ...day, city_name: e.target.value, use_custom: false } : day)),
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select City</option>
                    {Array.from(new Set([...cityOptions, d.city_name].filter(Boolean))).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">Other (type city)</option>
                  </select>
                  {d.use_custom && (
                    <input
                      type="text"
                      value={d.city_name}
                      onChange={(e) => updateDay(idx, 'city_name', e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Enter city name"
                      required
                    />
                  )}
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nights *</label>
                  <input
                    type="number"
                    min={1}
                    value={d.night_count}
                    onChange={(e) => updateDay(idx, 'night_count', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <Button type="button" variant="danger" size="sm" onClick={() => removeRow(idx)} disabled={form.days.length === 1}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Live Preview</p>
            <p className="text-sm text-slate-800">{planPreview || 'Plan preview will appear here...'}</p>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active template
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

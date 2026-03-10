import { useState, useEffect } from 'react';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerFamily,
  removeCustomerFamily,
  setCustomerFamily,
} from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

const emptyCustomer = { name: '', mobile: '', email: '', address: '', passport: '', family_count: 0, notes: '' };

export default function Customers() {
  const { toast } = useToast();
  const [list, setList] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null });
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [familyForm, setFamilyForm] = useState({ name: '', relation: '', mobile: '' });
  const [familyRows, setFamilyRows] = useState([]);

  const load = () => {
    setLoading(true);
    getCustomers({ page, limit: 10, search: search || undefined })
      .then((r) => setList({ data: r.data.data || [], total: r.data.total || 0 }))
      .catch(() => toast('Failed to load customers', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openAdd = () => {
    setForm(emptyCustomer);
    setFamilyRows([]);
    setModal({ open: true, mode: 'add', data: null });
  };

  const openEdit = (row) => {
    getCustomer(row.id)
      .then((r) => {
        const c = r.data;
        setForm({
          name: c.name || '',
          mobile: c.mobile || '',
          email: c.email || '',
          address: c.address || '',
          passport: c.passport || '',
          family_count: c.family_count ?? (Array.isArray(c.family) ? c.family.length : 0),
          notes: c.notes || '',
        });
        const fam = Array.isArray(c.family)
          ? c.family.map((f) => ({ name: f.name || '', relation: f.relation || '', mobile: f.mobile || '' }))
          : [];
        setFamilyRows(fam);
        setModal({ open: true, mode: 'edit', data: c });
      })
      .catch(() => {
        setForm({
          name: row.name || '',
          mobile: row.mobile || '',
          email: row.email || '',
          address: row.address || '',
          passport: row.passport || '',
          family_count: row.family_count ?? 0,
          notes: row.notes || '',
        });
        setFamilyRows([]);
        setModal({ open: true, mode: 'edit', data: row });
      });
  };

  const openDetail = (row) => {
    getCustomer(row.id).then((r) => setDetail(r.data)).catch(() => toast('Failed to load customer', 'error'));
  };

  const handleFamilyCountChange = (value) => {
    const count = Math.max(0, Number(value) || 0);
    setForm((prev) => ({ ...prev, family_count: value }));
    setFamilyRows((prev) => {
      const next = [...prev];
      if (count > next.length) {
        for (let i = next.length; i < count; i += 1) {
          next.push({ name: '', relation: '', mobile: '' });
        }
      } else if (count < next.length) {
        next.length = count;
      }
      return next;
    });
  };

  const updateFamilyRow = (index, field, value) => {
    setFamilyRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, family_count: Number(form.family_count) || 0 };
    if (modal.mode === 'add') {
      createCustomer(payload)
        .then(async (res) => {
          const created = res.data;
          const rowsToSave = (familyRows || []).filter((r) => r.name && r.name.trim());
          if (created?.id && rowsToSave.length) {
            await Promise.all(
              rowsToSave.map((r) =>
                    addCustomerFamily(created.id, {
                      name: r.name.trim(),
                      relation: r.relation || '',
                      mobile: r.mobile || '',
                    }).catch(() => {})
              )
            );
          }
          toast('Customer created');
          setModal({ open: false, mode: 'add', data: null });
          setFamilyRows([]);
          load();
        })
        .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
        .finally(() => setSaving(false));
      return;
    }

    updateCustomer(modal.data.id, payload)
      .then(async () => {
        const rowsToSave = (familyRows || []).filter((r) => r.name && r.name.trim());
        if (rowsToSave.length) {
          await Promise.all(
            rowsToSave.map((r) =>
              addCustomerFamily(modal.data.id, {
                name: r.name.trim(),
                relation: r.relation || '',
                mobile: r.mobile || '',
              }).catch(() => {})
            )
          );
        }
        toast('Customer updated');
        setModal({ open: false, mode: 'add', data: null });
        setFamilyRows([]);
        load();
        if (detail?.id === modal.data?.id) getCustomer(modal.data.id).then((r) => setDetail(r.data));
      })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete customer "${row.name}"?`)) return;
    deleteCustomer(row.id)
      .then(() => { toast('Customer deleted'); setDetail(null); load(); })
      .catch(() => toast('Delete failed', 'error'));
  };

  const handleAddFamily = (e) => {
    e.preventDefault();
    if (!detail || !familyForm.name.trim()) return;
    addCustomerFamily(detail.id, familyForm)
      .then(() => {
        toast('Family member added');
        setFamilyForm({ name: '', relation: '', mobile: '' });
        getCustomer(detail.id).then((r) => setDetail(r.data));
      })
      .catch(() => toast('Failed', 'error'));
  };

  const handleRemoveFamily = (fid) => {
    if (!window.confirm('Remove this family member?')) return;
    removeCustomerFamily(detail.id, fid)
      .then(() => { toast('Removed'); getCustomer(detail.id).then((r) => setDetail(r.data)); })
      .catch(() => toast('Failed', 'error'));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Customers</h1>
        <Button onClick={openAdd}>+ Add Customer</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <input
            type="search"
            placeholder="Search by name, email, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
          />
        </div>
        {loading ? <Loading /> : list.data.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No customers yet. Add your first customer.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Mobile</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Family</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{row.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.email || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.mobile || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-center text-slate-600">{row.family_count ?? 0}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openDetail(row)} className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition">View</button>
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
        {list.total > 10 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Total {list.total} customers</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page * 10 >= list.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false, mode: 'add', data: null })} title={modal.mode === 'add' ? 'Add Customer' : 'Edit Customer'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Passport" value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} />
            <Input
              label="Family count"
              type="number"
              min="0"
              value={form.family_count}
              onChange={(e) => handleFamilyCountChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Family members (name, relation, mobile)</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setFamilyRows((prev) => [...prev, { name: '', relation: '', mobile: '' }])
                }
              >
                + Add Member
              </Button>
            </div>
            {familyRows.length > 0 && (
              <div className="space-y-2">
                {familyRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <Input
                      label={`Member ${idx + 1} name`}
                      value={row.name}
                      onChange={(e) => updateFamilyRow(idx, 'name', e.target.value)}
                    />
                    <Input
                      label="Relation"
                      value={row.relation}
                      onChange={(e) => updateFamilyRow(idx, 'relation', e.target.value)}
                    />
                    <Input
                      label="Mobile"
                      value={row.mobile}
                      onChange={(e) => updateFamilyRow(idx, 'mobile', e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setFamilyRows((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false, mode: 'add', data: null })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : modal.mode === 'add' ? 'Create Customer' : 'Update'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail.name} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Email</span><br />{detail.email || '-'}</p>
              <p><span className="text-slate-500">Mobile</span><br />{detail.mobile || '-'}</p>
              <p className="col-span-2"><span className="text-slate-500">Address</span><br />{detail.address || '-'}</p>
              <p><span className="text-slate-500">Passport</span><br />{detail.passport || '-'}</p>
              <p><span className="text-slate-500">Family count</span><br />{detail.family_count ?? 0}</p>
              {detail.notes && <p className="col-span-2"><span className="text-slate-500">Notes</span><br />{detail.notes}</p>}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => { setModal({ open: true, mode: 'edit', data: detail }); setDetail(null); }}>Edit Customer</Button>
            </div>
            <hr />
            <h4 className="font-medium text-slate-800 mb-1">Family Members</h4>
            <ul className="space-y-2 mt-1">
              {(detail.family || []).map((f) => (
                <li key={f.id} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {f.name}
                      {f.relation && ` (${f.relation})`}
                    </p>
                    {f.mobile && (
                      <p className="text-xs text-slate-500">
                        Mobile: {f.mobile}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveFamily(f.id)}>Remove</Button>
                </li>
              ))}
              {(!detail.family || detail.family.length === 0) && <li className="text-slate-500 text-sm">No family members added.</li>}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}

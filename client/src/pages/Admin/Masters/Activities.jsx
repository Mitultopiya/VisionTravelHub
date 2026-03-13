import { useState, useEffect } from 'react';
import { getActivities, getCities, createActivity, updateActivity, deleteActivity, uploadMastersFile, uploadBaseUrl } from '../../../services/api';
import Loading from '../../../components/Loading';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import FileUpload from '../../../components/FileUpload';
import { useToast } from '../../../context/ToastContext';

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('vth_selected_branch_id') || '';
};

export default function Activities() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [form, setForm] = useState({ name: '', description: '', city_id: '', image_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    const branchId = getSelectedBranchId();
    const params = branchId ? { branch_id: branchId } : undefined;
    Promise.all([getActivities(params), getCities(params)]).then(([a, c]) => {
      setList(a.data || []);
      setCities(c.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name: '', description: '', city_id: '', image_url: '' }); setModal({ open: true, data: null }); };
  const openEdit = (row) => { setForm({ name: row.name || '', description: row.description || '', city_id: row.city_id ?? '', image_url: row.image_url || '' }); setModal({ open: true, data: row }); };

  const handleImageSelect = (file) => {
    if (!file || !file.type?.startsWith('image/')) { toast('Please choose an image (JPG, PNG, GIF, WebP)', 'error'); return; }
    setUploading(true);
    uploadMastersFile('activities', file)
      .then((res) => {
        const url = res.data?.url || '';
        setForm((f) => ({ ...f, image_url: url }));
        toast('Image uploaded');
      })
      .catch((err) => toast(err.response?.data?.message || 'Upload failed', 'error'))
      .finally(() => setUploading(false));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const branchId = getSelectedBranchId();
    const payload = {
      ...form,
      city_id: form.city_id ? Number(form.city_id) : null,
      image_url: form.image_url || null,
      ...(branchId ? { branch_id: Number(branchId) } : {}),
    };
    (modal.data ? updateActivity(modal.data.id, payload) : createActivity(payload))
      .then(() => { toast(modal.data ? 'Activity updated' : 'Activity added'); setModal({ open: false, data: null }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    deleteActivity(row.id).then(() => { toast('Activity deleted'); load(); }).catch(() => toast('Delete failed', 'error'));
  };

  const getCityName = (id) => cities.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Activities</h1>
        <Button onClick={openAdd}>+ Add Activity</Button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <Loading /> : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No activities. Add your first activity.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Image</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">City</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-5 py-3">
                      {row.image_url
                        ? <img src={(uploadBaseUrl || '') + row.image_url} alt="" className="h-10 w-10 object-cover rounded-lg border border-slate-200" />
                        : <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No img</div>}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{row.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[200px] truncate">{row.description || '-'}</td>
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
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Activity' : 'Add Activity'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <select value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">— Select —</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Activity Image</label>
            <div className="flex flex-wrap items-center gap-3">
              <FileUpload onSelect={handleImageSelect} accept=".jpg,.jpeg,.png,.gif,.webp,image/*" />
              {uploading && <span className="text-sm text-slate-500">Uploading…</span>}
              {form.image_url && (
                <div className="flex items-center gap-2">
                  <img src={(uploadBaseUrl || '') + form.image_url} alt="Activity" className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, image_url: '' }))}>Remove</Button>
                </div>
              )}
            </div>
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

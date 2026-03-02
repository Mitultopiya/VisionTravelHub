import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
} from '../../services/api';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Manage Users', icon: '👥' },
  { to: '/admin/packages', label: 'Manage Packages', icon: '📦' },
  { to: '/admin/bookings', label: 'View Bookings', icon: '📋' },
];

const emptyPackage = {
  title: '',
  description: '',
  price: '',
  location: '',
  days: '',
  image_url: '',
};

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPackage);

  const load = async () => {
    try {
      const { data } = await getPackages();
      setPackages(data);
    } catch (e) {
      setAlert({ type: 'error', message: 'Failed to load packages' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
    setForm(emptyPackage);
  };

  const openEdit = (pkg) => {
    setEditing(pkg.id);
    setShowForm(true);
    setForm({
      title: pkg.title,
      description: pkg.description || '',
      price: pkg.price,
      location: pkg.location || '',
      days: pkg.days ?? '',
      image_url: pkg.image_url || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    try {
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        days: form.days ? Number(form.days) : null,
      };
      if (editing) {
        await updatePackage(editing, payload);
        setAlert({ type: 'success', message: 'Package updated.' });
      } else {
        await createPackage(payload);
        setAlert({ type: 'success', message: 'Package created.' });
      }
      setEditing(null);
      setShowForm(false);
      setForm(emptyPackage);
      load();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Operation failed' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this package?')) return;
    try {
      await deletePackage(id);
      setAlert({ type: 'success', message: 'Package deleted.' });
      load();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Delete failed' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title="Manage Packages" />
      <div className="flex">
        <Sidebar items={adminNav} />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Packages</h2>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              Add Package
            </button>
          </div>

          {alert && (
            <div className="mb-4">
              <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="mb-6 p-4 bg-white rounded-lg border border-slate-200 space-y-3"
            >
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Price"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
                <input
                  type="number"
                  placeholder="Days"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <input
                type="text"
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
              <input
                type="url"
                placeholder="Image URL"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="h-24 w-auto rounded object-cover"
                  onError={(e) => (e.target.style.display = 'none')}
                />
              )}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-lg">
                  {editing ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setShowForm(false);
                    setForm(emptyPackage);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <Loading />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">Title</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">Location</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">Price</th>
                      <th className="text-right px-4 py-3 text-slate-600 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{pkg.title}</td>
                        <td className="px-4 py-3 text-slate-600">{pkg.location || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">${pkg.price}</td>
                        <td className="px-4 py-3 text-right flex gap-2 justify-end">
                          <button
                            onClick={() => openEdit(pkg)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(pkg.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

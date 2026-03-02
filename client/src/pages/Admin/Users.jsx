import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import { getUsers, createUser, deleteUser } from '../../services/api';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Manage Users', icon: '👥' },
  { to: '/admin/packages', label: 'Manage Packages', icon: '📦' },
  { to: '/admin/bookings', label: 'View Bookings', icon: '📋' },
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });

  const loadUsers = async () => {
    try {
      const { data } = await getUsers();
      setUsers(data);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setAlert(null);
    try {
      await createUser(form);
      setAlert({ type: 'success', message: 'User created successfully.' });
      setForm({ name: '', email: '', password: '', role: 'user' });
      setShowForm(false);
      loadUsers();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Failed to create user' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      setAlert({ type: 'success', message: 'User deleted.' });
      loadUsers();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Failed to delete' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title="Manage Users" />
      <div className="flex">
        <Sidebar items={adminNav} />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Users</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              {showForm ? 'Cancel' : 'Add User'}
            </button>
          </div>

          {alert && (
            <div className="mb-4">
              <Alert
                type={alert.type}
                message={alert.message}
                onClose={() => setAlert(null)}
              />
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleCreate}
              className="mb-6 p-4 bg-white rounded-lg border border-slate-200 space-y-3"
            >
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-lg">
                Create User
              </button>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <Loading />
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Role</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

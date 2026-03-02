import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import { getAllBookings, updateBookingStatus } from '../../services/api';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Manage Users', icon: '👥' },
  { to: '/admin/packages', label: 'Manage Packages', icon: '📦' },
  { to: '/admin/bookings', label: 'View Bookings', icon: '📋' },
];

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  const load = async () => {
    try {
      const { data } = await getAllBookings();
      setBookings(data);
    } catch (e) {
      setAlert({ type: 'error', message: 'Failed to load bookings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (id, status) => {
    try {
      await updateBookingStatus(id, status);
      setAlert({ type: 'success', message: 'Status updated.' });
      load();
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Update failed' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title="View Bookings" />
      <div className="flex">
        <Sidebar items={adminNav} />
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">All Bookings</h2>

          {alert && (
            <div className="mb-4">
              <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <Loading />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">User</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">Package</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-medium">Status</th>
                      <th className="text-right px-4 py-3 text-slate-600 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="text-slate-800 font-medium">{b.user_name}</p>
                          <p className="text-slate-500 text-sm">{b.user_email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{b.package_title}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {b.booking_date || new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[b.status] || 'bg-slate-200'}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <select
                            value={b.status}
                            onChange={(e) => handleStatusChange(b.id, e.target.value)}
                            className="text-sm border border-slate-300 rounded px-2 py-1"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
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

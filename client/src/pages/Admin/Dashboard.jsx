import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import { getPackages } from '../../services/api';
import { getAllBookings } from '../../services/api';
import { getUsers } from '../../services/api';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Manage Users', icon: '👥' },
  { to: '/admin/packages', label: 'Manage Packages', icon: '📦' },
  { to: '/admin/bookings', label: 'View Bookings', icon: '📋' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, packages: 0, bookings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [u, p, b] = await Promise.all([
          getUsers(),
          getPackages(),
          getAllBookings(),
        ]);
        setStats({
          users: u.data?.length ?? 0,
          packages: p.data?.length ?? 0,
          bookings: b.data?.length ?? 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title="Admin Dashboard" />
      <div className="flex">
        <Sidebar items={adminNav} />
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            Dashboard
          </h2>
          {loading ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/admin/users"
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
              >
                <p className="text-slate-500 text-sm font-medium">Total Users</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {stats.users}
                </p>
              </Link>
              <Link
                to="/admin/packages"
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
              >
                <p className="text-slate-500 text-sm font-medium">Packages</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {stats.packages}
                </p>
              </Link>
              <Link
                to="/admin/bookings"
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
              >
                <p className="text-slate-500 text-sm font-medium">Bookings</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {stats.bookings}
                </p>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

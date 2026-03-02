import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import { getPackages } from '../../services/api';
import { getMyBookings } from '../../services/api';

const userNav = [
  { to: '/user', label: 'Dashboard', icon: '📊' },
  { to: '/user/packages', label: 'View Packages', icon: '📦' },
  { to: '/user/bookings', label: 'My Bookings', icon: '📋' },
];

export default function UserDashboard() {
  const [packagesCount, setPackagesCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, b] = await Promise.all([getPackages(), getMyBookings()]);
        setPackagesCount(p.data?.length ?? 0);
        setBookingsCount(b.data?.length ?? 0);
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
      <Navbar title="Dashboard" />
      <div className="flex">
        <Sidebar items={userNav} />
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Welcome</h2>
          {loading ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/user/packages"
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
              >
                <p className="text-slate-500 text-sm font-medium">Available Packages</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{packagesCount}</p>
                <p className="text-primary-600 text-sm mt-2">View all →</p>
              </Link>
              <Link
                to="/user/bookings"
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
              >
                <p className="text-slate-500 text-sm font-medium">My Bookings</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{bookingsCount}</p>
                <p className="text-primary-600 text-sm mt-2">View all →</p>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

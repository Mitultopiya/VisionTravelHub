import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import { getMyBookings } from '../../services/api';

const userNav = [
  { to: '/user', label: 'Dashboard', icon: '📊' },
  { to: '/user/packages', label: 'View Packages', icon: '📦' },
  { to: '/user/bookings', label: 'My Bookings', icon: '📋' },
];

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function UserMyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await getMyBookings();
        setBookings(data);
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
      <Navbar title="My Bookings" />
      <div className="flex">
        <Sidebar items={userNav} />
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">My Bookings</h2>

          {loading ? (
            <Loading />
          ) : bookings.length === 0 ? (
            <p className="text-slate-500">You have no bookings yet.</p>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-semibold text-slate-800">{b.title}</h3>
                    <p className="text-slate-500 text-sm">{b.location && `📍 ${b.location}`}</p>
                    <p className="text-slate-600 text-sm mt-1">
                      ${b.price} {b.days && `• ${b.days} days`}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Booked: {new Date(b.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[b.status] || 'bg-slate-200'}`}
                  >
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

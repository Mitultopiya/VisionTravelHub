import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import { getPackages, createBooking } from '../../services/api';

const userNav = [
  { to: '/user', label: 'Dashboard', icon: '📊' },
  { to: '/user/packages', label: 'View Packages', icon: '📦' },
  { to: '/user/bookings', label: 'My Bookings', icon: '📋' },
];

export default function UserPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [bookingId, setBookingId] = useState(null);

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

  const handleBook = async (packageId) => {
    setAlert(null);
    try {
      await createBooking(packageId);
      setAlert({ type: 'success', message: 'Booking created successfully.' });
      setBookingId(packageId);
    } catch (e) {
      setAlert({ type: 'error', message: e.response?.data?.message || 'Booking failed' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title="View Packages" />
      <div className="flex">
        <Sidebar items={userNav} />
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Travel Packages</h2>

          {alert && (
            <div className="mb-4">
              <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
            </div>
          )}

          {loading ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  {pkg.image_url ? (
                    <img
                      src={pkg.image_url}
                      alt={pkg.title}
                      className="w-full h-40 object-cover"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  ) : (
                    <div className="w-full h-40 bg-slate-200 flex items-center justify-center text-slate-400">
                      No image
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800">{pkg.title}</h3>
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2">{pkg.description}</p>
                    {pkg.location && (
                      <p className="text-slate-500 text-sm mt-1">📍 {pkg.location}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-primary-600 font-semibold">${pkg.price}</span>
                      {pkg.days && (
                        <span className="text-slate-500 text-sm">{pkg.days} days</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleBook(pkg.id)}
                      className="mt-3 w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

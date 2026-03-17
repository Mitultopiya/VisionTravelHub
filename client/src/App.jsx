import { Routes, Route, Navigate } from 'react-router-dom';
import { getStoredUser } from './utils/auth';

import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import StaffLayout from './components/StaffLayout';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminCustomers from './pages/Admin/Customers';
import AdminPackages from './pages/Admin/Packages';
import AdminPackageBuilder from './pages/Admin/PackageBuilder';
import AdminBookings from './pages/Admin/Bookings';
import AdminPreferredItems from './pages/Admin/PreferredItems';
import AdminQuotations from './pages/Admin/Quotations';
import AdminInvoices from './pages/Admin/Invoices';
import AdminPaymentSlips from './pages/Admin/PaymentSlips';
import AdminReports from './pages/Admin/Reports';
import AdminStaff from './pages/Admin/Staff';
import AdminSettings from './pages/Admin/Settings';
import AdminCities from './pages/Admin/Masters/Cities';
import AdminHotels from './pages/Admin/Masters/Hotels';
import AdminVehicles from './pages/Admin/Masters/Vehicles';
import AdminActivities from './pages/Admin/Masters/Activities';
import StaffDashboard from './pages/Staff/Dashboard';
import StaffMyBookings from './pages/Staff/MyBookings';
import StaffBookingDetails from './pages/Staff/BookingDetails';

function ProtectedRoute({ children, allowRoles }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  if (allowRoles && !allowRoles.includes(user.role)) {
    if (user.role === 'staff') return <Navigate to="/staff" replace />;
    return <Navigate to="/admin" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const user = getStoredUser();
  if (user) {
    if (user.role === 'staff') return <Navigate to="/staff" replace />;
    return <Navigate to="/admin" replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      <Route path="/admin" element={<ProtectedRoute allowRoles={['admin', 'manager']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="packages" element={<AdminPackages />} />
        <Route path="package-builder" element={<AdminPackageBuilder />} />
        <Route path="package-builder/:id" element={<AdminPackageBuilder />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="preferred-items" element={<AdminPreferredItems />} />
        <Route path="quotations" element={<AdminQuotations />} />
        <Route path="invoice" element={<AdminInvoices />} />
        <Route path="payment-slip" element={<AdminPaymentSlips />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="masters/cities" element={<AdminCities />} />
        <Route path="masters/hotels" element={<AdminHotels />} />
        <Route path="masters/vehicles" element={<AdminVehicles />} />
        <Route path="masters/activities" element={<AdminActivities />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="settings/:section" element={<AdminSettings />} />
      </Route>

      <Route path="/staff" element={<ProtectedRoute allowRoles={['staff']}><StaffLayout /></ProtectedRoute>}>
        <Route index element={<StaffDashboard />} />
        <Route path="bookings" element={<StaffMyBookings />} />
        <Route path="bookings/:id" element={<StaffBookingDetails />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  FaChartBar,
  FaUsers,
  FaCube,
  FaCog,
  FaFileInvoice,
  FaChartLine,
  FaUserFriends,
  FaMapMarkerAlt,
  FaHotel,
  FaTruck,
  FaStar,
  FaBuilding,
  FaUniversity,
  FaQrcode,
} from 'react-icons/fa';
import Sidebar from './Sidebar';
import Header from './Header';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: FaChartBar },
  {
    label: 'Customers',
    icon: FaUsers,
    children: [
      { to: '/admin/customers', label: 'Customers', icon: FaUsers },
      { to: '/admin/invoice', label: 'Invoice', icon: FaFileInvoice },
      { to: '/admin/payment-slip', label: 'Payment Slip', icon: FaFileInvoice },
    ],
  },
  { to: '/admin/packages', label: 'Packages', icon: FaCube },
  { to: '/admin/package-builder', label: 'Package Builder', icon: FaCog },
  {
    label: 'Preferred Items',
    icon: FaStar,
    children: [
      { to: '/admin/masters/cities', label: 'States', icon: FaMapMarkerAlt },
      { to: '/admin/masters/hotels', label: 'Hotels', icon: FaHotel },
      { to: '/admin/masters/vehicles', label: 'Vehicles', icon: FaTruck },
      { to: '/admin/masters/activities', label: 'Activities', icon: FaStar },
    ],
  },
  { to: '/admin/reports', label: 'Reports', icon: FaChartLine },
  { to: '/admin/staff', label: 'Staff', icon: FaUserFriends },
  {
    label: 'Settings',
    icon: FaCog,
    children: [
      { to: '/admin/settings/company', label: 'Company Information', icon: FaBuilding },
      { to: '/admin/settings/bank', label: 'Bank Details', icon: FaUniversity },
      { to: '/admin/settings/payment', label: 'Payment Settings', icon: FaQrcode },
      { to: '/admin/settings/branches', label: 'Branch Management', icon: FaMapMarkerAlt },
      { to: '/admin/settings/preview', label: 'PDF Header Preview', icon: FaFileInvoice },
    ],
  },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar items={adminNav} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col min-w-0 flex-1 md:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden overflow-y-auto min-h-screen w-full max-w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

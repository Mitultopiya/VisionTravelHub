import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { FaChartBar, FaUsers, FaCalculator, FaFileInvoice } from 'react-icons/fa';
import Sidebar from './Sidebar';
import Header from './Header';

const staffNav = [
  { to: '/staff', label: 'Dashboard', icon: FaChartBar },
  {
    label: 'Customers',
    icon: FaUsers,
    children: [
      { to: '/staff/customers', label: 'Customers', icon: FaUsers },
      { to: '/staff/invoice', label: 'Invoice', icon: FaFileInvoice },
      { to: '/staff/payment-slip', label: 'Payment Slip', icon: FaFileInvoice },
    ],
  },
  { to: '/staff/rate-calculator', label: 'Rate Calculator', icon: FaCalculator },
];

export default function StaffLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar items={staffNav} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col min-w-0 md:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  FaUsers,
  FaRupeeSign,
  FaExclamationCircle,
  FaBell,
  FaChartLine,
  FaHistory,
  FaWhatsapp,
} from 'react-icons/fa';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getDashboard } from '../../services/api';
import Loading from '../../components/Loading';
import { branchParams } from '../../utils/branch';

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-IN');
}

function fmtCurr(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getWhatsAppReminderUrl(row) {
  const phone = String(row.customer_mobile ?? row.mobile ?? '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  const num = phone.length === 10 ? `91${phone}` : phone;
  const msg = [
    `Hi ${row.customer_name || 'Customer'},`,
    '',
    'Payment reminder from Vision Travel Hub:',
    `Package: ${row.package_name || '—'}`,
    `Total Amount: ${fmtCurr(row.total)}`,
    `Paid: ${fmtCurr(row.paid)}`,
    `Remaining: ${fmtCurr(row.remaining)}`,
    `Due Date: ${fmtDate(row.due_date)}`,
    '',
    'Please clear the pending amount at the earliest. Thank you!',
  ].join('\n');
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-slate-500">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 break-all">{value}</p>
        </div>
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="text-white text-base" />
        </div>
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDashboard(branchParams('all'))
      .then((r) => setData(r.data || {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) return <Loading />;
  const d = data || {};
  const monthlySales = (d.monthlySales || []).map((m) => ({
    month: m.month || '',
    revenue: Number(m.revenue || 0),
  }));
  const pendingAmount = Math.max(0, Number(d.pendingPayments ?? 0));
  const reminders = d.paymentReminders || [];
  const totalCollected = Number(d.totalCollected || 0);
  const totalRevenue = Number(d.monthlyRevenue || 0);
  const paymentSplit = [
    { name: 'Collected', value: totalCollected, color: '#10b981' },
    { name: 'Pending', value: Math.max(0, totalRevenue - totalCollected), color: '#f59e0b' },
  ];
  const recentPayments = d.recentPaymentActivity || [];
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Staff Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Live branch performance, collections, and payment tracking.</p>
        </div>
        <span className="text-xs sm:text-sm text-slate-500">{todayLabel}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <StatCard icon={FaUsers} label="Total Customers" value={fmt(d.totalCustomers ?? 0)} color="bg-teal-500" />
        <StatCard icon={FaRupeeSign} label="Total Revenue" value={fmtCurr(d.monthlyRevenue ?? 0)} color="bg-emerald-500" />
        <StatCard icon={FaExclamationCircle} label="Pending Amount" value={fmtCurr(pendingAmount)} color="bg-amber-500" />
        <StatCard icon={FaBell} label="Pending Invoices" value={fmt(d.pendingPaymentsCount ?? 0)} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 min-w-0">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <FaChartLine className="text-teal-600" />
            <h3 className="text-sm font-semibold text-slate-800">Monthly Revenue Trend</h3>
          </div>
          <div className="p-3 h-72 min-w-0">
            {monthlySales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                <AreaChart data={monthlySales}>
                  <defs>
                    <linearGradient id="staffRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => [fmtCurr(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#0d9488" fill="url(#staffRevenueGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No revenue data available</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <FaChartLine className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">Collections vs Pending</h3>
          </div>
          <div className="p-3 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={paymentSplit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                <Tooltip formatter={(v) => [fmtCurr(v), 'Amount']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {paymentSplit.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FaBell className="text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-800">Payment Reminders</h3>
        </div>
        {reminders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Package</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Remaining</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Due Date</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {reminders.slice(0, 10).map((row, idx) => (
                  <tr key={row.id ?? idx} className="border-b border-slate-100">
                    <td className="px-4 py-3">{row.customer_name || '—'}</td>
                    <td className="px-4 py-3">{row.package_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">{fmtCurr(row.remaining)}</td>
                    <td className="px-4 py-3">{fmtDate(row.due_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${row.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        {row.status || 'Due Soon'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(row.customer_mobile || row.mobile) ? (
                        <a
                          href={getWhatsAppReminderUrl(row)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium bg-[#25D366] hover:bg-[#20bd5a] transition-colors"
                        >
                          <FaWhatsapp className="text-sm" />
                          Send
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">No phone</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">No pending payment reminders.</div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FaHistory className="text-cyan-600" />
          <h3 className="text-sm font-semibold text-slate-800">Recent Payment Activity</h3>
        </div>
        {recentPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Package</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Remaining</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-4 py-3">{row.customer_name || '—'}</td>
                    <td className="px-4 py-3">{row.package_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmtCurr(row.paid_amount)}</td>
                    <td className="px-4 py-3 text-right">{fmtCurr(row.remaining)}</td>
                    <td className="px-4 py-3">{fmtDate(row.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">No recent payment activity.</div>
        )}
      </div>
    </div>
  );
}

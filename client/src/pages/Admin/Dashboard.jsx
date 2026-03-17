import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaUsers,
  FaCalendarCheck,
  FaRupeeSign,
  FaExclamationCircle,
  FaCheckCircle,
  FaPlaneDeparture,
  FaBell,
  FaChartLine,
  FaHistory,
  FaWhatsapp,
  FaBuilding,
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
import { getSelectedBranchId, branchParams } from '../../utils/branch';

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtCurr(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
/** Short format for cards: ₹1.2L, ₹5K, ₹999 */
function fmtCurrShort(n) {
  const num = Number(n ?? 0);
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toFixed(0)}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Build WhatsApp wa.me link with pre-filled payment reminder message */
function getWhatsAppReminderUrl(row) {
  const phone = String(row.customer_mobile ?? row.mobile ?? '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  const num = phone.length === 10 ? '91' + phone : phone.length === 12 && phone.startsWith('91') ? phone : phone || '0';
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

function StatCard({ to, icon: Icon, label, value, color }) {
  const Wrapper = to ? Link : 'div';
  const props = to ? { to } : {};
  return (
    <Wrapper {...props} className={to ? 'block min-w-0' : 'min-w-0'}>
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 md:p-5 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-xs sm:text-sm font-medium text-slate-500 leading-tight break-words">{label}</p>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-slate-800 mt-1 break-all">{value}</p>
          </div>
          <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="text-white text-sm sm:text-base md:text-lg" />
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());

  useEffect(() => {
    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
  }, []);

  useEffect(() => {
    setLoading(true);
    getDashboard(branchParams(branchId))
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading && !data) return <Loading />;
  const d = data || {};
  const branchLabel =
    branchId === 'all'
      ? 'All Branches'
      : (d.branchMetrics || []).find((b) => String(b.branch_id) === String(branchId))?.branch_name || `Branch #${branchId}`;

  const monthlySales = (d.monthlySales || []).map((m) => ({
    month: m.month || '',
    revenue: Number(m.revenue || 0),
  }));

  const totalRevenue = Number(d.monthlyRevenue ?? 0);
  const totalCollected = Number(d.totalCollected ?? 0);
  const pendingAmount = Math.max(0, totalRevenue - totalCollected);
  const pendingCount = Number(d.pendingPaymentsCount ?? 0);

  const chartComparison = [
    { name: 'Paid Invoices', count: Number(d.paidInvoicesCount ?? 0), fill: '#10b981' },
    { name: 'Pending Invoices', count: pendingCount, fill: '#f59e0b' },
  ];

  const reminders = d.paymentReminders || [];
  const recentPayments = d.recentPaymentActivity || [];

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-xs sm:text-sm text-slate-500">Branch: {branchLabel}</p>
      </div>

      {/* Summary cards - single row on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          to="/admin/customers"
          icon={FaUsers}
          label="Total Customers"
          value={fmt(d.totalCustomers ?? 0)}
          color="bg-teal-500"
        />
        <StatCard
          icon={FaRupeeSign}
          label="Total Revenue"
          value={(v => (v >= 10000 ? fmtCurrShort(v) : fmtCurr(v)))(Number(d.monthlyRevenue ?? 0))}
          color="bg-emerald-500"
        />
        <StatCard
          icon={FaExclamationCircle}
          label="Pending Payments"
          value={(v => (v >= 10000 ? fmtCurrShort(v) : fmtCurr(v)))(Number(d.pendingPayments ?? 0))}
          color="bg-amber-500"
        />
        <StatCard
          icon={FaCheckCircle}
          label="Completed Payments"
          value={(v => (v >= 10000 ? fmtCurrShort(v) : fmtCurr(v)))(Number(d.completedPayments ?? d.totalCollected ?? 0))}
          color="bg-green-500"
        />
      </div>

      {/* Pending payment widget */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <FaBell className="text-amber-600 text-base sm:text-lg flex-shrink-0" />
          <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">Pending Payment Summary</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500">Number of pending invoices</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-700 truncate">{pendingCount}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500">Total pending amount</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-700 truncate">{fmtCurr(pendingAmount)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue chart */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
          <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2">
            <FaChartLine className="text-teal-600 flex-shrink-0 text-sm sm:text-base" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">Monthly Revenue</h2>
          </div>
          <div className="p-2 sm:p-4 h-[220px] sm:h-[260px] md:h-72">
            {monthlySales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart data={monthlySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000) + 'K' : v}`} stroke="#64748b" width={36} />
                  <Tooltip
                    formatter={(v) => [fmtCurr(v), 'Revenue']}
                    labelFormatter={(l) => l}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0d9488" fill="url(#revenueGrad)" strokeWidth={2} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No revenue data for the last 12 months</div>
            )}
          </div>
        </div>

        {/* Payments comparison */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
          <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2">
            <FaChartLine className="text-teal-600 flex-shrink-0 text-sm sm:text-base" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">Payments Overview</h2>
          </div>
          <div className="p-2 sm:p-4 h-[220px] sm:h-[260px] md:h-72">
            {chartComparison.some((x) => x.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart data={chartComparison} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" width={28} />
                  <Tooltip
                    formatter={(v) => [v, 'Count']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {chartComparison.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data to display</div>
            )}
          </div>
        </div>
      </div>

      {/* Payment reminders */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
        <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2">
          <FaBell className="text-amber-600 flex-shrink-0 text-sm sm:text-base" />
          <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">Payment Reminders</h2>
        </div>
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          {reminders.length > 0 ? (
            <>
              {/* Card layout for small screens */}
              <div className="block md:hidden divide-y divide-slate-100">
                {reminders.map((row, i) => (
                  <div key={row.id ?? i} className="p-3 sm:p-4 hover:bg-slate-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-slate-800 truncate">{row.customer_name || '—'}</span>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status || 'Due Soon'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mb-2">{row.package_name || '—'}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-500">Total</span>
                      <span className="text-right font-medium">{fmtCurr(row.total)}</span>
                      <span className="text-slate-500">Paid</span>
                      <span className="text-right">{fmtCurr(row.paid)}</span>
                      <span className="text-slate-500">Remaining</span>
                      <span className="text-right font-medium text-amber-700">{fmtCurr(row.remaining)}</span>
                      <span className="text-slate-500">Due</span>
                      <span className="text-right">{fmtDate(row.due_date)}</span>
                    </div>
                    {(row.customer_mobile || row.mobile) && (
                      <a
                        href={getWhatsAppReminderUrl(row)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-2 rounded-lg text-white text-xs font-medium bg-[#25D366] hover:bg-[#20bd5a] transition-colors"
                      >
                        <FaWhatsapp className="text-base" />
                        Send Reminder
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {/* Table for md and up */}
              <table className="w-full text-sm min-w-[700px] hidden md:table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-3 lg:px-4 font-semibold text-slate-700">Customer</th>
                    <th className="text-left py-3 px-3 lg:px-4 font-semibold text-slate-700">Package</th>
                    <th className="text-right py-3 px-3 lg:px-4 font-semibold text-slate-700">Total</th>
                    <th className="text-right py-3 px-3 lg:px-4 font-semibold text-slate-700">Paid</th>
                    <th className="text-right py-3 px-3 lg:px-4 font-semibold text-slate-700">Remaining</th>
                    <th className="text-left py-3 px-3 lg:px-4 font-semibold text-slate-700">Due Date</th>
                    <th className="text-center py-3 px-3 lg:px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-center py-3 px-3 lg:px-4 font-semibold text-slate-700">Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((row, i) => (
                    <tr key={row.id ?? i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-3 lg:px-4 text-slate-800">{row.customer_name || '—'}</td>
                      <td className="py-3 px-3 lg:px-4 text-slate-600">{row.package_name || '—'}</td>
                      <td className="py-3 px-3 lg:px-4 text-right font-medium">{fmtCurr(row.total)}</td>
                      <td className="py-3 px-3 lg:px-4 text-right">{fmtCurr(row.paid)}</td>
                      <td className="py-3 px-3 lg:px-4 text-right font-medium text-amber-700">{fmtCurr(row.remaining)}</td>
                      <td className="py-3 px-3 lg:px-4 text-slate-600">{fmtDate(row.due_date)}</td>
                      <td className="py-3 px-3 lg:px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.status || 'Due Soon'}
                        </span>
                      </td>
                      <td className="py-3 px-3 lg:px-4 text-center">
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
            </>
          ) : (
            <div className="py-8 sm:py-12 text-center text-slate-500 text-xs sm:text-sm">No pending payment reminders</div>
          )}
        </div>
      </div>

      {/* Recent payment activity */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
        <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FaHistory className="text-teal-600 flex-shrink-0 text-sm sm:text-base" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">Recent Payment Activity</h2>
          </div>
          <Link to="/admin/payment-slip" className="text-xs sm:text-sm font-medium text-teal-600 hover:text-teal-700 shrink-0">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          {recentPayments.length > 0 ? (
            <>
              {/* Card layout for small screens */}
              <div className="block md:hidden divide-y divide-slate-100">
                {recentPayments.slice(0, 10).map((row, i) => (
                  <div key={i} className="p-3 sm:p-4 hover:bg-slate-50/50">
                    <div className="flex flex-wrap justify-between gap-2 mb-1">
                      <span className="font-medium text-slate-800 truncate">{row.customer_name || '—'}</span>
                      <span className="text-green-700 font-medium text-sm shrink-0">{fmtCurr(row.paid_amount)}</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mb-1">{row.package_name || '—'}</p>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Remaining: {fmtCurr(row.remaining)}</span>
                      <span>{fmtDate(row.paid_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Table for md and up */}
              <table className="w-full text-sm min-w-[520px] hidden md:table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-3 lg:px-4 font-semibold text-slate-700">Customer</th>
                    <th className="text-left py-3 px-3 lg:px-4 font-semibold text-slate-700">Package</th>
                    <th className="text-right py-3 px-3 lg:px-4 font-semibold text-slate-700">Paid</th>
                    <th className="text-right py-3 px-3 lg:px-4 font-semibold text-slate-700">Remaining</th>
                    <th className="text-left py-3 px-3 lg:px-4 font-semibold text-slate-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-3 lg:px-4 text-slate-800">{row.customer_name || '—'}</td>
                      <td className="py-3 px-3 lg:px-4 text-slate-600">{row.package_name || '—'}</td>
                      <td className="py-3 px-3 lg:px-4 text-right font-medium text-green-700">{fmtCurr(row.paid_amount)}</td>
                      <td className="py-3 px-3 lg:px-4 text-right text-slate-600">{fmtCurr(row.remaining)}</td>
                      <td className="py-3 px-3 lg:px-4 text-slate-600">{fmtDate(row.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="py-8 sm:py-12 text-center text-slate-500 text-xs sm:text-sm">No recent payments</div>
          )}
        </div>
      </div>
    </div>
  );
}

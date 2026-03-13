import { useState, useEffect, useCallback } from 'react';
import {
  getDashboard, getPendingPayments, getStaffPerformanceReport, getRevenueReportFiltered,
} from '../../services/api';
import Loading from '../../components/Loading';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import {
  RiRefreshLine, RiUserLine, RiMoneyRupeeCircleLine, RiFileList3Line,
  RiTimeLine, RiBarChartLine, RiPieChartLine, RiTeamLine,
} from 'react-icons/ri';

/* ── helpers ── */
function fmt(n) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
function fmtShort(n) {
  const num = Number(n || 0);
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toFixed(0)}`;
}
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TEAL_PALETTE = ['#0d9488', '#06b6d4', '#6366f1', '#f59e0b', '#ef4444', '#10b981'];
const STATUS_COLORS = { paid: '#10b981', issued: '#06b6d4', draft: '#94a3b8', overdue: '#ef4444', cancelled: '#f59e0b' };

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, color = 'teal', trend }) {
  const colors = {
    teal: 'from-teal-500 to-cyan-500',
    green: 'from-emerald-500 to-green-500',
    violet: 'from-violet-500 to-purple-500',
    rose: 'from-rose-500 to-red-500',
    amber: 'from-amber-500 to-orange-500',
    blue: 'from-blue-500 to-sky-500',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-3 flex-shrink-0`}>
        <Icon className="text-white text-xl" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="text-teal-600 text-lg" />
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
    </div>
  );
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: <strong>{typeof p.value === 'number' ? fmtShort(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Donut / Pie label ── */
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Reports() {
  const [dashboard, setDashboard] = useState(null);
  const [pending, setPending] = useState([]);
  const [staffPerf, setStaffPerf] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [revStart, setRevStart] = useState('');
  const [revEnd, setRevEnd] = useState('');
  const [revLoading, setRevLoading] = useState(false);

  const getSelectedBranchId = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('vth_selected_branch_id') || '';
  };

  const load = useCallback((quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    const branchId = getSelectedBranchId();
    const params = branchId ? { branch_id: branchId } : undefined;
    Promise.all([
      getDashboard(params).then((r) => r.data).catch(() => null),
      getPendingPayments(params).then((r) => r.data).catch(() => []),
      getStaffPerformanceReport(params).then((r) => r.data).catch(() => []),
      getRevenueReportFiltered('', '', branchId).then((r) => r.data).catch(() => []),
    ]).then(([d, p, s, rv]) => {
      setDashboard(d);
      setPending(Array.isArray(p) ? p : []);
      setStaffPerf(Array.isArray(s) ? s : []);
      setRevenueRows(Array.isArray(rv) ? rv : []);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadRevenue = () => {
    setRevLoading(true);
    const branchId = getSelectedBranchId();
    getRevenueReportFiltered(revStart || undefined, revEnd || undefined, branchId)
      .then((r) => setRevenueRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setRevLoading(false));
  };

  if (loading) return <Loading />;

  /* ── Derived data ── */
  const monthlySales = (dashboard?.monthlySales || []).map((m) => ({
    month: m.month,
    Revenue: Number(m.revenue || 0),
    Invoices: Number(m.count || 0),
  }));

  const paymentModes = (dashboard?.paymentModes || []).map((m) => ({
    name: (m.mode || 'other').charAt(0).toUpperCase() + (m.mode || 'other').slice(1),
    value: Number(m.total || 0),
    count: Number(m.count || 0),
  }));

  const invoiceStatus = (dashboard?.invoiceStatusBreakdown || []).map((s) => ({
    name: (s.status || 'unknown').charAt(0).toUpperCase() + (s.status || 'unknown').slice(1),
    value: Number(s.count || 0),
    total: Number(s.total || 0),
    status: s.status,
  }));

  const totalCollected = Number(dashboard?.totalCollected || 0);
  const totalRevenue = Number(dashboard?.monthlyRevenue || 0);
  const totalDue = Number(dashboard?.pendingPayments || 0);
  const collectionPct = totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: RiBarChartLine },
    { id: 'revenue', label: 'Revenue', icon: RiMoneyRupeeCircleLine },
    { id: 'pending', label: 'Pending Payments', icon: RiTimeLine },
    { id: 'staff', label: 'Staff', icon: RiTeamLine },
  ];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Reports & Analytics</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-100 transition disabled:opacity-60"
        >
          <RiRefreshLine className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon className="text-sm" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={RiUserLine} label="Total Customers" value={dashboard?.totalCustomers ?? 0} sub="Registered customers" color="teal" />
            <StatCard icon={RiMoneyRupeeCircleLine} label="Total Revenue" value={`₹${fmt(totalRevenue)}`} sub="From issued invoices" color="green" />
            <StatCard icon={RiFileList3Line} label="Collected" value={`₹${fmt(totalCollected)}`} sub={`${collectionPct}% of total`} color="blue" />
            <StatCard icon={RiTimeLine} label="Pending Due" value={`₹${fmt(totalDue)}`} sub="Awaiting payment" color="rose" />
          </div>

          {/* Invoice status pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Invoices', val: dashboard?.invoiceStats?.total ?? 0, bg: 'bg-slate-50 text-slate-700 border-slate-200' },
              { label: 'Paid', val: dashboard?.invoiceStats?.paid ?? 0, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Issued', val: dashboard?.invoiceStats?.issued ?? 0, bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
              { label: 'Overdue', val: dashboard?.invoiceStats?.overdue ?? 0, bg: 'bg-red-50 text-red-700 border-red-200' },
              { label: 'Draft', val: dashboard?.invoiceStats?.draft ?? 0, bg: 'bg-slate-50 text-slate-500 border-slate-200' },
            ].map((c) => (
              <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.bg}`}>
                <p className="text-xs font-medium opacity-70">{c.label}</p>
                <p className="text-2xl font-bold mt-0.5">{c.val}</p>
              </div>
            ))}
          </div>

          {/* Monthly revenue chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader icon={RiBarChartLine} title="Monthly Revenue (Last 6 Months)" />
            {monthlySales.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#revGrad)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment mode donut */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <SectionHeader icon={RiPieChartLine} title="Collections by Mode" />
              {paymentModes.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No payment data</div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={paymentModes} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        dataKey="value" labelLine={false} label={renderCustomLabel}>
                        {paymentModes.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `₹${fmt(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {paymentModes.map((m, i) => (
                      <div key={m.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TEAL_PALETTE[i % TEAL_PALETTE.length] }} />
                          <span className="text-xs text-slate-600">{m.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-800">₹{fmt(m.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Invoice status donut */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <SectionHeader icon={RiPieChartLine} title="Invoice Status Breakdown" />
              {invoiceStatus.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No invoice data</div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={invoiceStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        dataKey="value" labelLine={false} label={renderCustomLabel}>
                        {invoiceStatus.map((s, i) => (
                          <Cell key={i} fill={STATUS_COLORS[s.status] || TEAL_PALETTE[i % TEAL_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n, p) => [`${v} invoices`, p.payload.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {invoiceStatus.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.status] || TEAL_PALETTE[i] }} />
                          <span className="text-xs text-slate-600">{s.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quotation stats */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader icon={RiFileList3Line} title="Quotation Stats" />
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total', val: dashboard?.quotationStats?.total ?? 0, color: 'text-slate-700' },
                { label: 'Sent', val: dashboard?.quotationStats?.sent ?? 0, color: 'text-cyan-600' },
                { label: 'Approved', val: dashboard?.quotationStats?.approved ?? 0, color: 'text-emerald-600' },
              ].map((q) => (
                <div key={q.label} className="text-center py-3 rounded-xl bg-slate-50">
                  <p className={`text-2xl font-bold ${q.color}`}>{q.val}</p>
                  <p className="text-xs text-slate-500 mt-1">{q.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── REVENUE TAB ── */}
      {activeTab === 'revenue' && (
        <div className="space-y-5">
          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
              <input type="date" value={revStart} onChange={(e) => setRevStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
              <input type="date" value={revEnd} onChange={(e) => setRevEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 outline-none" />
            </div>
            <button onClick={loadRevenue} disabled={revLoading}
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-60">
              {revLoading ? 'Loading...' : 'Filter'}
            </button>
            <button onClick={() => { setRevStart(''); setRevEnd(''); loadRevenue(); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
              Reset
            </button>
          </div>

          {/* Revenue bar chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader icon={RiBarChartLine} title="Revenue by Invoice" />
            {revenueRows.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data for selected range</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenueRows.slice(0, 20).map(r => ({ name: r.invoice_number, Amount: Number(r.total || 0), customer: r.customer_name }))} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Amount" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Invoice Revenue List</p>
              <p className="text-xs text-slate-500">{revenueRows.length} invoices &nbsp;·&nbsp; Total: <strong className="text-teal-700">₹{fmt(revenueRows.reduce((s, r) => s + Number(r.total || 0), 0))}</strong></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px]">
                <thead>
                  <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase">#</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Invoice No.</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Date</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {revenueRows.map((r, i) => {
                    const statusCls = {
                      paid: 'bg-emerald-100 text-emerald-700',
                      issued: 'bg-cyan-100 text-cyan-700',
                      overdue: 'bg-red-100 text-red-700',
                      draft: 'bg-slate-100 text-slate-500',
                    }[r.status] || 'bg-slate-100 text-slate-500';
                    return (
                      <tr key={r.id || i} className="hover:bg-teal-50/30 transition-colors">
                        <td className="px-5 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-teal-700">{r.invoice_number || '-'}</td>
                        <td className="px-5 py-3 text-sm text-slate-700">{r.customer_name || '-'}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{fmtDate(r.invoice_date)}</td>
                        <td className="px-5 py-3 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusCls}`}>{r.status}</span></td>
                        <td className="px-5 py-3 text-right text-sm font-bold text-slate-800">₹{fmt(r.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PENDING PAYMENTS TAB ── */}
      {activeTab === 'pending' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={RiTimeLine} label="Pending Invoices" value={pending.length} sub="Invoices with due amount" color="rose" />
            <StatCard icon={RiMoneyRupeeCircleLine} label="Total Due" value={`₹${fmt(pending.reduce((s, r) => s + Number(r.due || 0), 0))}`} sub="Across all invoices" color="amber" />
            <StatCard icon={RiMoneyRupeeCircleLine} label="Total Collected" value={`₹${fmt(pending.reduce((s, r) => s + Number(r.paid || 0), 0))}`} sub="Partial payments" color="green" />
          </div>

          {/* Bar chart */}
          {pending.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <SectionHeader icon={RiBarChartLine} title="Due vs Collected (Top 10)" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pending.slice(0, 10).map(r => ({ name: r.customer_name?.split(' ')[0] || '-', Due: Number(r.due || 0), Collected: Number(r.paid || 0) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Collected" fill="#0d9488" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="Due" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-800">Pending Payment Details</p>
            </div>
            {pending.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-sm">No pending payments</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase">#</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Customer</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Invoice No.</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Due Date</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold uppercase">Invoice Total</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold uppercase">Collected</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold uppercase">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pending.map((r, i) => {
                      const pct = Number(r.total) > 0 ? Math.round((Number(r.paid) / Number(r.total)) * 100) : 0;
                      const isOverdue = r.due_date && new Date(r.due_date) < new Date();
                      return (
                        <tr key={r.id || i} className="hover:bg-teal-50/30 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-800">{r.customer_name || '-'}</p>
                            {r.mobile && <p className="text-xs text-slate-400">{r.mobile}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-teal-700">{r.invoice_number || '-'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>{fmtDate(r.due_date)}</span>
                            {isOverdue && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold uppercase">Overdue</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-slate-700">₹{fmt(r.total)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <p className="text-sm font-medium text-emerald-600">₹{fmt(r.paid)}</p>
                            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 ml-auto">
                              <div className="h-1 bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm font-bold text-red-600">₹{fmt(r.due)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-teal-100">
                      <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-500">{pending.length} invoice{pending.length !== 1 ? 's' : ''}</td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-slate-700">₹{fmt(pending.reduce((s, r) => s + Number(r.total || 0), 0))}</td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-emerald-600">₹{fmt(pending.reduce((s, r) => s + Number(r.paid || 0), 0))}</td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-red-600">₹{fmt(pending.reduce((s, r) => s + Number(r.due || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STAFF TAB ── */}
      {activeTab === 'staff' && (
        <div className="space-y-5">
          {staffPerf.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-14 text-center text-slate-400 text-sm">No staff data</div>
          ) : (
            <>
              {/* Bar chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <SectionHeader icon={RiBarChartLine} title="Staff Booking Performance" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={staffPerf.map(s => ({ name: s.name?.split(' ')[0] || '-', Completed: Number(s.completed_count || 0), Cancelled: Number(s.cancelled_count || 0) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Completed" fill="#0d9488" radius={[3, 3, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="Cancelled" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Staff table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Staff</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Branch</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase">Completed</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase">Cancelled</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {staffPerf.map((s, i) => {
                        const total = Number(s.completed_count || 0) + Number(s.cancelled_count || 0);
                        const pct = total > 0 ? Math.round((Number(s.completed_count || 0) / total) * 100) : 0;
                        return (
                          <tr key={s.id || i} className="hover:bg-teal-50/30 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {(s.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                                  <p className="text-xs text-slate-400">{s.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-500">{s.branch || '-'}</td>
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">{s.completed_count || 0}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-500 text-sm font-bold">{s.cancelled_count || 0}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

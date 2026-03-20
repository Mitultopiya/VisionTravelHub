import { useState, useEffect, useRef } from 'react';
import { getAllInvoicePayments, deleteInvoicePayment, downloadPaymentSlipPdf, getCompanySettings } from '../../services/api';
import Loading from '../../components/Loading';
import PaymentCard from '../../components/PaymentCard';
import { useToast } from '../../context/ToastContext';
import {
  RiUserLine, RiMoneyRupeeCircleLine, RiFileList3Line,
  RiArrowDownSLine, RiArrowUpSLine, RiPrinterLine, RiDeleteBin6Line,
  RiSearchLine, RiDownloadLine
} from 'react-icons/ri';

const MODE_COLORS = {
  cash: 'bg-emerald-100 text-emerald-700',
  upi: 'bg-violet-100 text-violet-700',
  bank: 'bg-blue-100 text-blue-700',
  card: 'bg-amber-100 text-amber-700',
  cheque: 'bg-slate-100 text-slate-700',
};

const DEFAULT_COMPANY = {
  name: 'Vision Travel Hub',
  address: '1234 Street, City, State, Zip Code',
  phone: '123-123-1234',
  email: 'yourcompany@email.com',
  gst: '',
};

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ---------- Receipt Modal ---------- */
function SlipModal({ payment, onClose, company = DEFAULT_COMPANY }) {

  const handlePrint = () => {
    if (!payment) return;
    const date = fmtDate(payment.paid_at);
    const time = payment.paid_at
      ? new Date(payment.paid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';
    const logoUrl = `${window.location.origin}/Vision_JPG_Logo.png`;
    const amtFormatted = `Rs.${Number(payment.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const invoiceTotal = payment.invoice_total
      ? `Rs.${Number(payment.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '-';
    const companyGst = payment.company_gst || company.gst || '-';
    const customerGst = payment.customer_gst || '-';
    const placeOfSupply = payment.place_of_supply || '-';
    const mobile = payment.customer_mobile || '';

    const win = window.open('', '_blank', 'width=760,height=900');
    win.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#1e293b;background:#fff;font-size:12px}
  .page{max-width:680px;margin:0 auto;padding:44px 50px}
  /* Header row */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
  .header-left .title{font-size:22px;font-weight:700;color:#1e293b;margin-bottom:6px}
  .header-left .co-name{font-size:11px;font-weight:700;color:#1e293b;margin-bottom:3px}
  .header-left .co-info{font-size:9.5px;color:#64748b;line-height:1.7}
  .header-right img{height:68px;width:auto;object-fit:contain}
  /* Divider */
  .divider{border:none;border-top:1.5px solid #0d9488;margin:16px 0 20px}
  /* Details box */
  .details-box{background:#f7fffe;border:0.8px solid #d1d5db;padding:16px 16px 8px;margin-bottom:18px}
  .details-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}
  .detail-item .lbl{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
  .detail-item .val{font-size:10px;font-weight:700;color:#1e293b}
  .detail-item .val.teal{color:#0d7a6f}
  /* Customer block */
  .section-label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px}
  .cust-name{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:2px}
  .cust-info{font-size:9.5px;color:#64748b;margin-bottom:14px}
  /* Amount box */
  .amt-box{background:#0d9488;color:#fff;padding:16px 24px;text-align:center;margin-bottom:20px}
  .amt-label{font-size:9px;opacity:.8;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px}
  .amt-val{font-size:28px;font-weight:700;letter-spacing:1px}
  /* GST section */
  .section-title{font-size:10px;font-weight:700;color:#0d7a6f;margin-bottom:6px}
  .hr{border:none;border-top:.6px solid #e2e8f0;margin:8px 0 12px}
  .gst-row{display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:7px}
  .gst-row .key{color:#64748b}
  .gst-row .val{font-weight:700;color:#1e293b}
  /* Summary */
  .summary-row{display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:6px}
  .summary-row .key{color:#64748b}
  .summary-row .val{font-weight:700;color:#1e293b}
  /* Footer */
  .footer-text{text-align:center;font-size:9px;color:#94a3b8;margin-top:18px;padding-top:10px;border-top:.6px solid #e2e8f0}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="title">PAYMENT RECEIPT</div>
      <div class="co-name">${company.name}</div>
      <div class="co-info">
        ${company.address}<br>
        ${company.phone} &nbsp;|&nbsp; ${company.email}<br>
        GST No.: ${companyGst}
      </div>
    </div>
    <div class="header-right">
      <img src="${logoUrl}" onerror="this.style.display='none'" />
    </div>
  </div>

  <hr class="divider">

  <!-- Details Box -->
  <div class="details-box">
    <div class="details-grid">
      <div class="detail-item">
        <div class="lbl">Receipt No.</div>
        <div class="val">${payment.id || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="lbl">Invoice No.</div>
        <div class="val teal">${payment.invoice_number || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="lbl">Payment Date</div>
        <div class="val">${date} ${time}</div>
      </div>
      <div class="detail-item">
        <div class="lbl">Payment Mode</div>
        <div class="val">${(payment.mode || '-').toUpperCase()}</div>
      </div>
    </div>
  </div>

  <!-- Customer -->
  <div class="section-label">Received From</div>
  <div class="cust-name">${payment.customer_name || '-'}</div>
  <div class="cust-info">${mobile ? 'Mobile: ' + mobile : ''} ${customerGst !== '-' ? '&nbsp;&nbsp;|&nbsp;&nbsp; GST: ' + customerGst : ''}</div>

  <!-- Amount Box -->
  <div class="amt-box">
    <div class="amt-label">Amount Received</div>
    <div class="amt-val">${amtFormatted}</div>
  </div>

  <!-- GST Section -->
  <div class="section-title">GST &amp; Tax Details</div>
  <hr class="hr">
  <div class="gst-row"><span class="key">Company GST No.</span><span class="val">${companyGst}</span></div>
  <div class="gst-row"><span class="key">Customer GST No.</span><span class="val">${customerGst}</span></div>
  <div class="gst-row"><span class="key">Place of Supply</span><span class="val">${placeOfSupply}</span></div>
  <hr class="hr">

  <!-- Invoice Summary -->
  <div class="summary-row"><span class="key">Invoice Total</span><span class="val">${invoiceTotal}</span></div>
  <div class="summary-row"><span class="key">Amount Paid (this receipt)</span><span class="val">${amtFormatted}</span></div>
  <hr class="hr">

  <!-- Footer -->
  <div class="footer-text">Thank you for your payment. This is a computer-generated receipt and does not require a signature.</div>

</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (!payment) return null;
  const date = fmtDate(payment.paid_at);
  const time = payment.paid_at ? new Date(payment.paid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
  const modeCls = MODE_COLORS[payment.mode] || 'bg-slate-100 text-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-r from-teal-600 to-cyan-600">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <RiFileList3Line className="text-base" /> Payment Receipt
          </h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 text-xs font-semibold bg-white text-teal-700 rounded-lg hover:bg-teal-50 transition flex items-center gap-1.5">
              <RiPrinterLine /> Print
            </button>
            <button
              onClick={() => handleDownloadPdf(payment, () => {})}
              className="px-3 py-1.5 text-xs font-semibold bg-white/20 text-white rounded-lg hover:bg-white/30 transition flex items-center gap-1.5"
            >
              <RiDownloadLine /> PDF
            </button>
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold bg-white/10 text-white rounded-lg hover:bg-white/20 transition">Close</button>
          </div>
        </div>

        {/* Receipt preview – mirrors print structure */}
        <div className="px-7 py-5 overflow-y-auto max-h-[80vh]">
          {/* Header row */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-lg font-bold text-slate-800 leading-tight">PAYMENT RECEIPT</p>
              <p className="text-xs font-semibold text-slate-700 mt-1">{company.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{company.address}</p>
              <p className="text-[10px] text-slate-400">{company.phone} | {company.email}</p>
              <p className="text-[10px] text-slate-400">GST No.: {payment.company_gst || '-'}</p>
            </div>
            <img src="/Vision_JPG_Logo.png" alt="logo" className="h-14 w-auto object-contain" onError={(e) => e.target.style.display = 'none'} />
          </div>

          <div className="border-t-2 border-teal-500 my-3" />

          {/* Details box */}
          <div className="bg-teal-50/60 border border-slate-200 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ['Receipt No.', payment.id || '-', false],
                ['Invoice No.', payment.invoice_number || '-', true],
                ['Payment Date', `${date} ${time}`, false],
                ['Payment Mode', (payment.mode || '-').toUpperCase(), false],
              ].map(([lbl, val, isTeal]) => (
                <div key={lbl}>
                  <p className="text-[8px] uppercase tracking-wider text-slate-400 mb-0.5">{lbl}</p>
                  <p className={`text-xs font-bold ${isTeal ? 'text-teal-700' : 'text-slate-800'}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Customer */}
          <p className="text-[8px] uppercase tracking-wider text-slate-400 mb-1">Received From</p>
          <p className="text-sm font-bold text-slate-800">{payment.customer_name || '-'}</p>
          {payment.customer_mobile && <p className="text-xs text-slate-500">Mobile: {payment.customer_mobile}</p>}
          {payment.customer_gst && <p className="text-xs text-slate-500">GST: {payment.customer_gst}</p>}

          {/* Amount box */}
          <div className="bg-teal-600 rounded-xl px-5 py-4 text-center my-4">
            <p className="text-[9px] text-teal-100 uppercase tracking-widest mb-1">Amount Received</p>
            <p className="text-2xl font-bold text-white">₹{fmt(payment.amount)}</p>
          </div>

          {/* GST section */}
          <p className="text-[10px] font-bold text-teal-700 mb-2">GST &amp; Tax Details</p>
          <div className="border-t border-slate-200 mb-2" />
          {[
            ['Company GST No.', payment.company_gst || '-'],
            ['Customer GST No.', payment.customer_gst || '-'],
            ['Place of Supply', payment.place_of_supply || '-'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">{k}</span>
              <span className="font-semibold text-slate-800">{v}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 my-2" />

          {/* Summary */}
          {[
            ['Invoice Total', `₹${fmt(payment.invoice_total)}`],
            ['Amount Paid (this receipt)', `₹${fmt(payment.amount)}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">{k}</span>
              <span className="font-semibold text-slate-800">{v}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 mt-2 mb-3" />

          <PaymentCard settings={company} className="my-4" />

          <p className="text-center text-[9px] text-slate-400">Thank you for your payment. This is a computer-generated receipt and does not require a signature.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Customer Payment Card ---------- */
function handleDownloadPdf(payment, toast) {
  downloadPaymentSlipPdf(payment.id)
    .then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-receipt-${payment.id}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1200);
    })
    .catch(() => toast('PDF download failed', 'error'));
}

function CustomerCard({ customerName, payments, onReceipt, onDelete, onDownload }) {
  const [open, setOpen] = useState(false);
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const mobile = payments[0]?.customer_mobile || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Customer header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-teal-50/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(customerName || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{customerName || 'Unknown'}</p>
            {mobile && <p className="text-xs text-slate-400">{mobile}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Payments</p>
            <p className="text-sm font-semibold text-slate-700">{payments.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Total Paid</p>
            <p className="text-sm font-bold text-teal-700">₹{fmt(total)}</p>
          </div>
          <div className="text-slate-400">
            {open ? <RiArrowUpSLine className="text-lg" /> : <RiArrowDownSLine className="text-lg" />}
          </div>
        </div>
      </button>

      {/* Payment rows */}
      {open && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Invoice No.</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Mode</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((p, idx) => {
                  const modeCls = MODE_COLORS[p.mode] || 'bg-slate-100 text-slate-600';
                  return (
                    <tr key={p.id} className="hover:bg-teal-50/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-teal-700">{p.invoice_number || '-'}</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-slate-800">₹{fmt(p.amount)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${modeCls}`}>
                          {p.mode || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onReceipt(p)}
                            className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition flex items-center gap-1"
                          >
                            <RiPrinterLine className="text-xs" /> Receipt
                          </button>
                          <button
                            onClick={() => onDownload(p)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1"
                          >
                            <RiDownloadLine className="text-xs" /> PDF
                          </button>
                          <button
                            onClick={() => onDelete(p)}
                            className="p-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition"
                          >
                            <RiDeleteBin6Line />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-teal-50/50">
                  <td colSpan={2} className="px-5 py-2.5 text-xs font-semibold text-slate-500">
                    {payments.length} payment{payments.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-bold text-teal-700">₹{fmt(total)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function PaymentSlips() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [slipModal, setSlipModal] = useState(null);
  const [company, setCompany] = useState(DEFAULT_COMPANY);

  const load = () => {
    setLoading(true);
    Promise.all([
      getAllInvoicePayments().then((r) => r.data || []).catch(() => []),
      getCompanySettings().then((r) => r.data || {}).catch(() => ({})),
    ]).then(([payments, settings]) => {
      setList(payments);
      setCompany({
        name:    settings.company_name    || DEFAULT_COMPANY.name,
        address: settings.company_address || DEFAULT_COMPANY.address,
        phone:   settings.company_phone   || DEFAULT_COMPANY.phone,
        email:   settings.company_email   || DEFAULT_COMPANY.email,
        gst:     settings.company_gst     || '',
      });
    }).catch(() => toast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (row) => {
    if (!window.confirm(`Delete this payment of ₹${fmt(row.amount)}?`)) return;
    deleteInvoicePayment(row.invoice_id, row.id)
      .then(() => { toast('Payment deleted'); load(); })
      .catch(() => toast('Delete failed', 'error'));
  };

  /* Filter payments */
  const filtered = list.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (r.customer_name || '').toLowerCase().includes(q)
      || (r.invoice_number || '').toLowerCase().includes(q)
      || (r.reference || '').toLowerCase().includes(q);
    const matchMode = !filterMode || r.mode === filterMode;
    return matchSearch && matchMode;
  });

  /* Group by customer */
  const groups = filtered.reduce((acc, p) => {
    const key = p.customer_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const sortedGroups = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));

  const totalAmount = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const uniqueModes = [...new Set(list.map((r) => r.mode).filter(Boolean))];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Payment Slips</h1>
        <div className="flex items-center gap-2 text-sm bg-teal-50 border border-teal-100 rounded-xl px-4 py-2">
          <RiMoneyRupeeCircleLine className="text-teal-600 text-lg" />
          <span className="text-slate-500">Total Collected:</span>
          <span className="font-bold text-teal-700 text-base">₹{fmt(totalAmount)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && list.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Payments', value: list.length, sub: `${Object.keys(list.reduce((a, r) => { a[r.customer_name] = 1; return a; }, {})).length} customers`, color: 'from-teal-500 to-cyan-500' },
            { label: 'Cash', value: list.filter(r => r.mode === 'cash').length, sub: `₹${fmt(list.filter(r=>r.mode==='cash').reduce((s,r)=>s+Number(r.amount||0),0))}`, color: 'from-emerald-500 to-green-500' },
            { label: 'UPI', value: list.filter(r => r.mode === 'upi').length, sub: `₹${fmt(list.filter(r=>r.mode==='upi').reduce((s,r)=>s+Number(r.amount||0),0))}`, color: 'from-violet-500 to-purple-500' },
            { label: 'Bank', value: list.filter(r => r.mode === 'bank').length, sub: `₹${fmt(list.filter(r=>r.mode==='bank').reduce((s,r)=>s+Number(r.amount||0),0))}`, color: 'from-blue-500 to-sky-500' },
          ].map((c) => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl px-4 py-3.5 text-white shadow-sm`}>
              <p className="text-xs font-medium opacity-80">{c.label}</p>
              <p className="text-2xl font-bold mt-0.5">{c.value}</p>
              <p className="text-xs opacity-70 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <RiSearchLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by customer, invoice, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
          />
        </div>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
        >
          <option value="">All Modes</option>
          {uniqueModes.map((m) => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <Loading />
      ) : sortedGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <RiUserLine className="text-5xl text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No payment slips found</p>
          <p className="text-slate-400 text-sm mt-1">Payments recorded on invoices will appear here grouped by customer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Customer count row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{sortedGroups.length}</span> customer{sortedGroups.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
              <span className="font-semibold text-slate-700">{filtered.length}</span> payment{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          {sortedGroups.map(([name, pays]) => (
            <CustomerCard
              key={name}
              customerName={name}
              payments={pays}
              onReceipt={setSlipModal}
              onDelete={handleDelete}
              onDownload={(p) => handleDownloadPdf(p, toast)}
            />
          ))}
        </div>
      )}

      {slipModal && <SlipModal payment={slipModal} onClose={() => setSlipModal(null)} company={company} />}
    </div>
  );
}

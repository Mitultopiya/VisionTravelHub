import { useState, useEffect } from 'react';
import {
  getInvoices,
  getInvoice,
  getNextInvoiceNumber,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addInvoicePayment,
  getCustomers,
  getBookings,
  getPackages,
  getStaff,
  getCompanySettings,
  downloadInvoicePdf,
} from '../../services/api';
import { getStoredUser } from '../../utils/auth';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import PaymentCard from '../../components/PaymentCard';
import { useToast } from '../../context/ToastContext';

const COMPANY = {
  name: 'Vision Travel Hub',
  address: '1234 Street, City, State, Zip Code',
  phone: '123-123-1234',
  email: 'yourcompany@email.com',
  gst: 'GST Number',
};

const SUGGESTED_ITEMS = [
  'Hotel Accommodation',
  'Transportation',
  'Flight Tickets',
  'Activities',
  'Visa Charges',
  'Insurance',
  'Service Fee',
  'Extra Add-ons',
];

const STATUS_BADGES = {
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGES[status] || STATUS_BADGES.draft;
  const label = (status || 'draft').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

const emptyItem = () => ({ description: '', quantity: '1', rate: '', amount: '' });

export default function Invoices() {
  const { toast } = useToast();
  const user = getStoredUser();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false });
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [paymentModal, setPaymentModal] = useState({ open: false, invoiceId: null });
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'cash', reference: '' });
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [packages, setPackages] = useState([]);
  const [staff, setStaff] = useState([]);
  const [nextNumber, setNextNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({});
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    booking_id: '',
    package_id: '',
    customer_id: '',
    place_of_supply: '',
    billing_address: '',
    customer_gst: '',
    sales_executive_id: '',
    travel_destination: '',
    travel_start_date: '',
    travel_end_date: '',
    adults: '0',
    children: '0',
    package_name: '',
    hotel_category: '',
    vehicle_type: '',
    discount: '0',
    discount_type: 'flat',
    tax_percent: '0',
    service_charges: '0',
    round_off: '0',
    status: 'draft',
    terms_text: '',
    company_gst: '',
    items: [emptyItem(), emptyItem()],
  });

  const getSelectedBranchId = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('vth_selected_branch_id') || '';
  };

  const load = () => {
    setLoading(true);
    const branchId = getSelectedBranchId();
    const params = branchId ? { branch_id: branchId } : undefined;
    getInvoices(params).then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    getCustomers({ limit: 500 }).then((r) => setCustomers(r.data?.data || r.data || [])).catch(() => {});
    getBookings({ limit: 200 }).then((r) => setBookings(r.data?.data || r.data || [])).catch(() => {});
    getPackages().then((r) => setPackages(r.data || [])).catch(() => {});
    getStaff().then((r) => setStaff(r.data || [])).catch(() => {});
    getCompanySettings().then((r) => setPaymentSettings(r.data || {})).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditingId(null);
    getNextInvoiceNumber()
      .then((r) => setNextNumber(r.data?.invoice_number || ''))
      .catch(() => setNextNumber(''));
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setForm({
      ...form,
      invoice_number: '',
      invoice_date: today,
      due_date: due.toISOString().slice(0, 10),
      booking_id: '',
      package_id: '',
      customer_id: '',
      place_of_supply: '',
      billing_address: '',
      customer_gst: '',
      sales_executive_id: user?.id ? String(user.id) : '',
      travel_destination: '',
      travel_start_date: '',
      travel_end_date: '',
      adults: '0',
      children: '0',
      package_name: '',
      hotel_category: '',
      vehicle_type: '',
      discount: '0',
      discount_type: 'flat',
      tax_percent: '0',
      service_charges: '0',
      round_off: '0',
      status: 'draft',
      terms_text: '',
      company_gst: '',
      items: [emptyItem(), emptyItem()],
    });
    setModal({ open: true });
  };

  const openEdit = (row) => {
    getInvoice(row.id)
      .then((r) => {
        const inv = r.data;
        setForm({
          ...form,
          invoice_number: inv.invoice_number || '',
          invoice_date: inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : form.invoice_date,
          due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : form.due_date,
          booking_id: inv.booking_id ? String(inv.booking_id) : '',
          package_id: '',
          customer_id: inv.customer_id ? String(inv.customer_id) : '',
          place_of_supply: inv.place_of_supply || '',
          billing_address: inv.billing_address || '',
          customer_gst: inv.customer_gst || '',
          sales_executive_id: inv.created_by ? String(inv.created_by) : '',
          travel_destination: inv.travel_destination || '',
          travel_start_date: inv.travel_start_date ? String(inv.travel_start_date).slice(0, 10) : '',
          travel_end_date: inv.travel_end_date ? String(inv.travel_end_date).slice(0, 10) : '',
          adults: String(inv.adults ?? 0),
          children: String(inv.children ?? 0),
          package_name: inv.package_name || '',
          hotel_category: inv.hotel_category || '',
          vehicle_type: inv.vehicle_type || '',
          terms_text: inv.terms_text || '',
          company_gst: inv.company_gst || '',
          discount: String(inv.discount ?? 0),
          discount_type: inv.discount_type || 'flat',
          tax_percent: String(inv.tax_percent ?? 0),
          service_charges: String(inv.service_charges ?? 0),
          round_off: String(inv.round_off ?? 0),
          status: inv.status || 'draft',
          items: (inv.items || []).length ? inv.items.map((i) => ({
            description: i.description || '',
            quantity: String(i.quantity ?? 1),
            rate: String(i.rate ?? 0),
            amount: String(i.amount ?? 0),
          })) : [emptyItem(), emptyItem()],
        });
        setEditingId(inv.id);
        setModal({ open: true });
      })
      .catch(() => toast('Failed to load invoice', 'error'));
  };

  const openDetail = (row) => {
    getInvoice(row.id).then((r) => setDetail(r.data)).catch(() => toast('Failed to load', 'error'));
  };

  const onBookingSelect = (bookingId) => {
    if (!bookingId) return;
    const bk = bookings.find((b) => b.id === Number(bookingId));
    if (!bk) return;
    setForm((f) => ({
      ...f,
      booking_id: String(bk.id),
      package_id: bk.package_id ? String(bk.package_id) : '',
      customer_id: String(bk.customer_id),
      travel_start_date: bk.travel_start_date ? String(bk.travel_start_date).slice(0, 10) : f.travel_start_date,
      travel_end_date: bk.travel_end_date ? String(bk.travel_end_date).slice(0, 10) : f.travel_end_date,
      package_name: bk.package_name || f.package_name,
    }));
    const cust = customers.find((c) => c.id === bk.customer_id);
    if (cust) {
      setForm((f) => ({
        ...f,
        billing_address: cust.address || f.billing_address,
      }));
    }
    if (bk.package_id) onPackageSelect(String(bk.package_id));
  };

  const onCustomerSelect = (customerId) => {
    const cust = customers.find((c) => c.id === Number(customerId));
    if (cust) setForm((f) => ({ ...f, billing_address: cust.address || f.billing_address }));
  };

  const onPackageSelect = (packageId) => {
    if (!packageId) return;
    const pkg = packages.find((p) => p.id === Number(packageId));
    if (!pkg) return;
    const packagePrice = Number(pkg.price || 0);
    const hotelPrice = Number(pkg.default_hotel_price || 0);
    const vehiclePrice = Number(pkg.default_vehicle_price || 0);
    setForm((f) => ({
      ...f,
      package_id: String(pkg.id),
      package_name: pkg.name || pkg.title || f.package_name,
      hotel_category: pkg.default_hotel_name || f.hotel_category,
      vehicle_type: pkg.default_vehicle_name || f.vehicle_type,
      items: [
        { description: `Package: ${pkg.name || pkg.title || 'Package'}`, quantity: '1', rate: String(packagePrice), amount: String(packagePrice) },
        { description: `Hotel: ${pkg.default_hotel_name || 'Default'}`, quantity: '1', rate: String(hotelPrice), amount: String(hotelPrice) },
        { description: `Vehicle: ${pkg.default_vehicle_name || 'Default'}`, quantity: '1', rate: String(vehiclePrice), amount: String(vehiclePrice) },
      ],
    }));
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const updateItem = (i, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      if (field === 'quantity' || field === 'rate') {
        const q = Number(items[i].quantity) || 0;
        const r = Number(items[i].rate) || 0;
        items[i].amount = String(q * r);
      }
      return { ...f, items };
    });
  };
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const subtotal = form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const discountVal = form.discount_type === 'percent' ? (subtotal * Number(form.discount)) / 100 : Number(form.discount) || 0;
  const afterDiscount = Math.max(0, subtotal - discountVal);
  const taxAmt = (afterDiscount * (Number(form.tax_percent) || 0)) / 100;
  const serviceVal = Number(form.service_charges) || 0;
  const beforeRound = afterDiscount + taxAmt + serviceVal;
  const roundVal = Number(form.round_off) || 0;
  const grandTotal = beforeRound + roundVal;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customer_id) { toast('Select customer', 'error'); return; }
    if (!form.invoice_date || !form.due_date) { toast('Invoice date and due date required', 'error'); return; }
    const items = form.items
      .filter((i) => i.description || Number(i.amount))
      .map((i) => ({
        description: i.description || 'Item',
        quantity: Number(i.quantity) || 1,
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || 0,
      }));
    const payload = {
      invoice_number: editingId ? undefined : (form.invoice_number || nextNumber),
      booking_id: form.booking_id || null,
      customer_id: Number(form.customer_id),
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      subtotal,
      discount: discountVal,
      discount_type: form.discount_type,
      tax_percent: Number(form.tax_percent) || 0,
      tax_amount: taxAmt,
      service_charges: serviceVal,
      round_off: roundVal,
      total: grandTotal,
      status: form.status,
      place_of_supply: form.place_of_supply || null,
      billing_address: form.billing_address || null,
      customer_gst: form.customer_gst || null,
      travel_destination: form.travel_destination || null,
      travel_start_date: form.travel_start_date || null,
      travel_end_date: form.travel_end_date || null,
      adults: Number(form.adults) || 0,
      children: Number(form.children) || 0,
      package_name: form.package_name || null,
      hotel_category: form.hotel_category || null,
      vehicle_type: form.vehicle_type || null,
      terms_text: form.terms_text || null,
      company_gst: form.company_gst || null,
      items,
      created_by: form.sales_executive_id ? Number(form.sales_executive_id) : (user?.id || null),
    };
    setSaving(true);
    const req = editingId ? updateInvoice(editingId, payload) : createInvoice(payload);
    req
      .then(() => {
        toast(editingId ? 'Invoice updated' : 'Invoice created');
        setModal({ open: false });
        setEditingId(null);
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete invoice ${row.invoice_number}?`)) return;
    deleteInvoice(row.id)
      .then(() => { toast('Invoice deleted'); if (detail?.id === row.id) setDetail(null); load(); })
      .catch(() => toast('Delete failed', 'error'));
  };

  const handleDownloadPdf = (id) => {
    downloadInvoicePdf(id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast('PDF downloaded');
      })
      .catch(() => toast('Download failed', 'error'));
  };

  const openRecordPayment = (inv) => setPaymentModal({ open: true, invoiceId: inv.id });
  const handleRecordPayment = (e) => {
    e.preventDefault();
    if (!paymentForm.amount || !paymentModal.invoiceId) return;
    addInvoicePayment(paymentModal.invoiceId, {
      amount: Number(paymentForm.amount),
      mode: paymentForm.mode,
      reference: paymentForm.reference || undefined,
    })
      .then(() => {
        toast('Payment recorded');
        setPaymentModal({ open: false, invoiceId: null });
        setPaymentForm({ amount: '', mode: 'cash', reference: '' });
        if (detail?.id === paymentModal.invoiceId) getInvoice(paymentModal.invoiceId).then((r) => setDetail(r.data));
        load();
      })
      .catch(() => toast('Failed', 'error'));
  };

  return (
    <div className="min-w-0 px-3 sm:px-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Invoices</h1>
        <Button onClick={openAdd} className="flex-shrink-0 w-full sm:w-auto">+ New Invoice</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No invoices yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-tl-2xl">Invoice No</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Due</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Paid</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-tr-2xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors group">
                    <td className="px-5 py-3.5 text-sm font-semibold text-teal-700">{row.invoice_number || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-800 font-medium">{row.customer_name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.invoice_date ? String(row.invoice_date).slice(0, 10) : '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.due_date ? String(row.due_date).slice(0, 10) : '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-right font-semibold text-slate-800">₹{Number(row.total || 0).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-sm text-right text-emerald-700 font-medium">₹{Number(row.paid_amount || 0).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-center"><StatusBadge status={row.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openDetail(row)} className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition">View</button>
                        <button onClick={() => openEdit(row)} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Edit</button>
                        <button onClick={() => handleDownloadPdf(row.id)} className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">PDF</button>
                        {row.status !== 'paid' && row.status !== 'cancelled' && (
                          <button onClick={() => openRecordPayment(row)} className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition">Pay</button>
                        )}
                        <button onClick={() => handleDelete(row)} className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modal.open}
        onClose={() => { setModal({ open: false }); setEditingId(null); }}
        title={editingId ? 'Edit Invoice' : 'New Invoice'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section A – Basic Invoice Info */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Basic Invoice Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input label="Invoice Number" value={editingId ? form.invoice_number : (form.invoice_number || nextNumber)} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="Auto" disabled={!!editingId} />
              <Input label="Invoice Date" type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required />
              <Input label="Due Date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Booking</label>
                <select value={form.booking_id} onChange={(e) => { setForm({ ...form, booking_id: e.target.value }); onBookingSelect(e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>#{b.id} – {b.customer_name} – {b.package_name || '-'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Package</label>
                <select
                  value={form.package_id}
                  onChange={(e) => onPackageSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.name || p.title)} — ₹{Number(p.price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <select value={form.customer_id} onChange={(e) => { setForm({ ...form, customer_id: e.target.value }); onCustomerSelect(e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                  <option value="">— Select —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sales Executive</label>
                <select value={form.sales_executive_id} onChange={(e) => setForm({ ...form, sales_executive_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <Input label="Place of Supply (State)" value={form.place_of_supply} onChange={(e) => setForm({ ...form, place_of_supply: e.target.value })} />
            </div>
          </Card>

          {/* Section B – Billing Details */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Billing Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Billing Address" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
              <Input label="Customer GST Number" value={form.customer_gst} onChange={(e) => setForm({ ...form, customer_gst: e.target.value })} />
              <Input label="Company GST No. (shown in PDF)" value={form.company_gst} onChange={(e) => setForm({ ...form, company_gst: e.target.value })} placeholder={COMPANY?.gst || 'GST Number'} />
            </div>
          </Card>

          {/* Section C – Travel Details */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Travel Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input label="Package Name" value={form.package_name} onChange={(e) => setForm({ ...form, package_name: e.target.value })} />
              <Input label="Destination" value={form.travel_destination} onChange={(e) => setForm({ ...form, travel_destination: e.target.value })} />
              <Input label="Adults" type="number" min="0" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
              <Input label="Children" type="number" min="0" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
              <Input label="Travel Start" type="date" value={form.travel_start_date} onChange={(e) => setForm({ ...form, travel_start_date: e.target.value })} />
              <Input label="Travel End" type="date" value={form.travel_end_date} onChange={(e) => setForm({ ...form, travel_end_date: e.target.value })} />
              <Input label="Hotel Category" value={form.hotel_category} onChange={(e) => setForm({ ...form, hotel_category: e.target.value })} />
              <Input label="Vehicle Type" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} />
            </div>
          </Card>

          {/* Section D – Cost Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Cost Breakdown</h3>
              <Button type="button" size="sm" variant="ghost" onClick={addItem}>+ Add Row</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2 pr-2">Particulars / Description</th>
                    <th className="pb-2 w-20">Qty</th>
                    <th className="pb-2 w-28">Rate</th>
                    <th className="pb-2 w-28">Amount</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1 pr-2">
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(i, 'description', e.target.value)}
                        />
                      </td>
                      <td className="py-1">
                        <input type="number" min="0" step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                      </td>
                      <td className="py-1">
                        <input type="number" min="0" step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={item.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} />
                      </td>
                      <td className="py-1 font-medium text-slate-800">₹{(Number(item.amount) || 0).toLocaleString()}</td>
                      <td className="py-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)}>×</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Section E – Tax & Total */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Tax & Total</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex justify-between text-sm gap-2"><span className="text-slate-600 flex-shrink-0">Subtotal</span><span className="truncate text-right">₹{subtotal.toLocaleString()}</span></div>
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">Discount</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm w-20">
                      <option value="flat">Flat</option>
                      <option value="percent">%</option>
                    </select>
                    <Input type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="w-20 sm:w-24" />
                  </div>
                </div>
                <div className="flex justify-between text-sm gap-2"><span className="text-slate-600">Tax %</span><Input type="number" min="0" step="0.01" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} className="w-20 inline-block" /></div>
                <div className="flex justify-between text-sm gap-2"><span className="text-slate-600">Service Charges</span><Input type="number" min="0" step="0.01" value={form.service_charges} onChange={(e) => setForm({ ...form, service_charges: e.target.value })} className="w-20 sm:w-24" /></div>
                <div className="flex justify-between text-sm gap-2"><span className="text-slate-600">Round Off</span><Input type="number" step="0.01" value={form.round_off} onChange={(e) => setForm({ ...form, round_off: e.target.value })} className="w-20 sm:w-24" /></div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4 min-w-0">
                <div className="flex justify-between text-base font-bold text-slate-800 mt-1">
                  <span>Grand Total</span>
                  <span className="text-primary-600">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="mt-2">
                  <label className="block text-sm text-slate-600 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Terms &amp; Conditions</label>
            <p className="text-xs text-slate-400 mb-2">Each line will become a numbered point in the PDF.</p>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder={"50% advance required.\nCancellation as per policy.\nFinal payment before travel."}
              value={form.terms_text}
              onChange={(e) => setForm({ ...form, terms_text: e.target.value })}
            />
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Invoice')}</Button>
          </div>
        </form>
      </Modal>

      {/* View Invoice Modal */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail.invoice_number}`} size="xl">
          <div className="bg-white text-slate-800 rounded-lg min-w-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 border-b border-slate-200 pb-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">INVOICE</h1>
                <p className="text-sm font-semibold text-slate-700 mt-1">{COMPANY.name}</p>
                <p className="text-xs text-slate-600 break-words">{COMPANY.address}</p>
              </div>
              <div className="text-left sm:text-right text-sm flex-shrink-0 space-y-0.5">
                <p><span className="text-slate-500">Invoice No:</span> {detail.invoice_number}</p>
                <p><span className="text-slate-500">Date:</span> {detail.invoice_date ? String(detail.invoice_date).slice(0, 10) : '-'}</p>
                <p><span className="text-slate-500">Due:</span> {detail.due_date ? String(detail.due_date).slice(0, 10) : '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2">Bill To</h3>
                <p className="font-medium">{detail.customer_name}</p>
                <p className="text-sm text-slate-600">{detail.billing_address || detail.customer_address || '-'}</p>
                <p className="text-sm">Mobile: {detail.mobile || '-'}</p>
                <p className="text-sm">Email: {detail.customer_email || '-'}</p>
                {detail.customer_gst && <p className="text-sm">GST: {detail.customer_gst}</p>}
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2">Travel</h3>
                <p className="text-sm">Destination: {detail.travel_destination || '-'}</p>
                <p className="text-sm">Dates: {detail.travel_start_date && detail.travel_end_date ? `${String(detail.travel_start_date).slice(0, 10)} to ${String(detail.travel_end_date).slice(0, 10)}` : '-'}</p>
                <p className="text-sm">Package: {detail.package_name || '-'}</p>
              </div>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden mb-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[320px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 sm:px-4 py-2 min-w-[100px]">Particulars</th>
                    <th className="text-right px-3 sm:px-4 py-2 w-14 sm:w-16">Qty</th>
                    <th className="text-right px-3 sm:px-4 py-2 w-20 sm:w-24">Rate</th>
                    <th className="text-right px-3 sm:px-4 py-2 w-20 sm:w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="px-3 sm:px-4 py-2 break-words">{i.description}</td>
                      <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">{Number(i.quantity)}</td>
                      <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">₹{Number(i.rate || 0).toLocaleString()}</td>
                      <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">₹{Number(i.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 border-t border-slate-200 pt-4 mb-6">
              <div className="text-sm text-slate-600 min-w-0">
                <p>Subtotal: ₹{(detail.items || []).reduce((s, i) => s + Number(i.amount || 0), 0).toLocaleString()}</p>
                <p>Discount: ₹{Number(detail.discount || 0).toLocaleString()}</p>
                <p>Tax: ₹{Number(detail.tax_amount || 0).toLocaleString()}</p>
              </div>
              <div className="text-base sm:text-lg font-bold text-primary-600 flex-shrink-0">Grand Total: ₹{Number(detail.total || 0).toLocaleString()}</div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-600">
                <p>Paid: ₹{Number(detail.paid_amount || 0).toLocaleString()}</p>
                <p>
                  Due:{' '}
                  ₹{Number(
                    (detail.due_amount != null ? detail.due_amount : (Number(detail.total || 0) - Number(detail.paid_amount || 0))) || 0
                  ).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button variant="secondary" size="sm" onClick={() => setDetail(null)}>Close</Button>
                <Button variant="secondary" size="sm" onClick={() => openEdit(detail)}>Edit</Button>
                <Button variant="secondary" size="sm" onClick={() => handleDownloadPdf(detail.id)}>Download PDF</Button>
                {detail.status !== 'paid' && detail.status !== 'cancelled' && (
                  <Button variant="secondary" size="sm" onClick={() => openRecordPayment(detail)}>Record Payment</Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => window.print()}>Print</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      <Modal open={paymentModal.open} onClose={() => setPaymentModal({ open: false, invoiceId: null })} title="Record Payment" size="md">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <PaymentCard settings={paymentSettings} className="mb-2" />
          <Input label="Amount *" type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mode *</label>
            <select value={paymentForm.mode} onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
            </select>
          </div>
          <Input label="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentModal({ open: false, invoiceId: null })}>Cancel</Button>
            <Button type="submit">Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

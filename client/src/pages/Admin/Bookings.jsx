import { useState, useEffect } from 'react';
import {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  getCustomers,
  getPackages,
  getHotels,
  getVehicles,
  getStaff,
  addBookingNote,
  addPayment,
} from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../context/ToastContext';

const STATUS_OPTIONS = ['inquiry', 'quotation_sent', 'confirmed', 'ongoing', 'completed', 'cancelled'];

export default function Bookings() {
  const { toast } = useToast();
  const [list, setList] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, mode: 'add' });
  const [detail, setDetail] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({
    customer_id: '', package_id: '', travel_start_date: '', travel_end_date: '', total_amount: '', status: 'inquiry',
    assigned_hotel_id: '', assigned_vehicle_id: '', assigned_staff_id: '', internal_notes: '',
  });
  const [noteText, setNoteText] = useState('');
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'cash', reference: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getBookings({ status: status || undefined, page, limit: 10 })
      .then((r) => setList({ data: r.data.data || [], total: r.data.total || 0 }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status, page]);
  useEffect(() => {
    Promise.all([getCustomers({ limit: 500 }), getPackages(), getHotels(), getVehicles(), getStaff()]).then(
      ([c, p, h, v, s]) => {
        setCustomers(c.data?.data || c.data || []);
        setPackages(p.data || []);
        setHotels(h.data || []);
        setVehicles(v.data || []);
        setStaff(s.data || []);
      }
    ).catch(() => {});
  }, []);

  const computeDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  };

  const recalcTotal = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...(patch || {}) };
      const days = computeDays(next.travel_start_date, next.travel_end_date);
      if (!days) {
        return next;
      }
      const hotel = hotels.find((h) => String(h.id) === String(next.assigned_hotel_id));
      const vehicle = vehicles.find((v) => String(v.id) === String(next.assigned_vehicle_id));
      const hotelRate = hotel ? Number(hotel.price || 0) : 0;
      const vehicleRate = vehicle ? Number(vehicle.price || 0) : 0;
      const total = days * (hotelRate + vehicleRate);
      return {
        ...next,
        total_amount: total ? String(total) : next.total_amount,
      };
    });
  };

  const openAdd = () => {
    setForm({
      customer_id: '', package_id: '', travel_start_date: '', travel_end_date: '', total_amount: '', status: 'inquiry',
      assigned_hotel_id: '', assigned_vehicle_id: '', assigned_staff_id: '', internal_notes: '',
    });
    setModal({ open: true, mode: 'add' });
  };

  const openDetail = (row) => {
    getBooking(row.id).then((r) => setDetail(r.data)).catch(() => toast('Failed to load booking', 'error'));
  };

  const handleCreateBooking = (e) => {
    e.preventDefault();
    if (!form.customer_id || !form.package_id) { toast('Select customer and package', 'error'); return; }
    setSaving(true);
    const payload = {
      customer_id: Number(form.customer_id),
      package_id: Number(form.package_id),
      travel_start_date: form.travel_start_date || null,
      travel_end_date: form.travel_end_date || null,
      total_amount: Number(form.total_amount) || 0,
      status: form.status,
      assigned_hotel_id: form.assigned_hotel_id ? Number(form.assigned_hotel_id) : null,
      assigned_vehicle_id: form.assigned_vehicle_id ? Number(form.assigned_vehicle_id) : null,
      assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
      internal_notes: form.internal_notes || null,
    };
    createBooking(payload)
      .then(() => { toast('Booking created'); setModal({ open: false }); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleUpdateStatus = (bookingId, newStatus) => {
    updateBooking(bookingId, { status: newStatus })
      .then(() => { toast('Status updated'); if (detail?.id === bookingId) getBooking(bookingId).then((r) => setDetail(r.data)); load(); })
      .catch(() => toast('Update failed', 'error'));
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!detail || !noteText.trim()) return;
    addBookingNote(detail.id, noteText).then(() => { setNoteText(''); getBooking(detail.id).then((r) => setDetail(r.data)); toast('Note added'); }).catch(() => toast('Failed', 'error'));
  };

  const handleAddPayment = (e) => {
    e.preventDefault();
    if (!detail || !paymentForm.amount) return;
    addPayment({ booking_id: detail.id, amount: Number(paymentForm.amount), mode: paymentForm.mode, reference: paymentForm.reference })
      .then(() => { setPaymentForm({ amount: '', mode: 'cash', reference: '' }); getBooking(detail.id).then((r) => setDetail(r.data)); toast('Payment recorded'); })
      .catch(() => toast('Failed', 'error'));
  };

  const columns = [
    { key: 'id', label: 'ID', render: (r) => `#${r.id}` },
    { key: 'customer_name', label: 'Customer' },
    { key: 'package_name', label: 'Package' },
    { key: 'travel_start_date', label: 'Start' },
    { key: 'total_amount', label: 'Amount', render: (r) => `₹${Number(r.total_amount || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Bookings</h1>
        <Button onClick={openAdd}>+ New Booking</Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
            <option value="">All status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        {loading ? <Loading /> : (
          <DataTable
            columns={columns}
            data={list.data}
            emptyMessage="No bookings. Create your first booking."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openDetail(row)}>View</Button>
              </div>
            )}
          />
        )}
        {list.total > 10 && (
          <div className="flex justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Total {list.total}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="secondary" disabled={page * 10 >= list.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Booking Modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title="New Booking" size="lg">
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
              <option value="">— Select customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Package *</label>
            <select value={form.package_id} onChange={(e) => setForm({ ...form, package_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
              <option value="">— Select package —</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name || p.title} — ₹{Number(p.price || 0).toLocaleString()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start date"
              type="date"
              value={form.travel_start_date}
              onChange={(e) => recalcTotal({ travel_start_date: e.target.value })}
            />
            <Input
              label="End date"
              type="date"
              value={form.travel_end_date}
              onChange={(e) => recalcTotal({ travel_end_date: e.target.value })}
            />
          </div>
          <Input label="Total amount (₹)" type="number" min="0" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hotel</label>
              <select value={form.assigned_hotel_id} onChange={(e) => recalcTotal({ assigned_hotel_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— None —</option>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle</label>
              <select value={form.assigned_vehicle_id} onChange={(e) => recalcTotal({ assigned_vehicle_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— None —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff</label>
              <select value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— None —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Internal notes</label>
            <textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Booking'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Booking #${detail.id}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Customer</span><br />{detail.customer_name} {detail.customer_email && `(${detail.customer_email})`}</p>
              <p><span className="text-slate-500">Package</span><br />{detail.package_name}</p>
              <p><span className="text-slate-500">Dates</span><br />{detail.travel_start_date || '-'} to {detail.travel_end_date || '-'}</p>
              <p><span className="text-slate-500">Status</span><br /><StatusBadge status={detail.status} /></p>
              <p><span className="text-slate-500">Total</span><br />₹{Number(detail.total_amount || 0).toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Update status</label>
              <select value={detail.status} onChange={(e) => handleUpdateStatus(detail.id, e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            {detail.internal_notes && <p className="text-sm"><span className="text-slate-500">Notes:</span> {detail.internal_notes}</p>}

            <hr />
            <h4 className="font-medium text-slate-800">Payments</h4>
            <ul className="space-y-1 text-sm mb-3">
              {(detail.payments || []).map((p) => (
                <li key={p.id}>{p.mode}: ₹{Number(p.amount).toLocaleString()} {p.reference && `(${p.reference})`}</li>
              ))}
              {(!detail.payments || detail.payments.length === 0) && <li className="text-slate-500">No payments yet.</li>}
            </ul>
            <form onSubmit={handleAddPayment} className="flex flex-wrap gap-2 items-end">
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-28" />
              <select value={paymentForm.mode} onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-2 text-sm w-24">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
              </select>
              <Input placeholder="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="w-32" />
              <Button type="submit" size="sm">Add Payment</Button>
            </form>

            <hr />
            <h4 className="font-medium text-slate-800">Notes</h4>
            <ul className="space-y-1 text-sm mb-3">
              {(detail.notes || []).map((n) => <li key={n.id}>{n.note} — <span className="text-slate-500">{n.user_name}</span></li>)}
            </ul>
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add note" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <Button type="submit" size="sm">Add</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

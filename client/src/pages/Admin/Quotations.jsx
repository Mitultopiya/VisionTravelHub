import { useState, useEffect } from 'react';
import { getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation, getCustomers, getPackages, getHotels, getVehicles, getCompanySettings, convertQuotationToBooking, downloadQuotationPdf } from '../../services/api';
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

export default function Quotations() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false });
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({
    customer_id: '',
    package_id: '',
    hotel_id: '',
    vehicle_id: '',
    valid_until: '',
    family_count: '1',
    trip_days: '',
    discount: '0',
    tax_percent: '0',
    terms_text: '',
    items: [
      { item: 'Hotel Stay', description: '', qty: '1', price: '' },
      { item: 'Transport', description: '', qty: '', price: '' },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({});
  const packageSelected = !!form.package_id;

  const load = () => {
    setLoading(true);
    getQuotations().then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    getCustomers({ limit: 500 }).then((r) => setCustomers(r.data?.data || r.data || [])).catch(() => {});
    getPackages().then((r) => setPackages(r.data || [])).catch(() => {});
    getHotels().then((r) => setHotels(r.data || [])).catch(() => {});
    getVehicles().then((r) => setVehicles(r.data || [])).catch(() => {});
    getCompanySettings().then((r) => setPaymentSettings(r.data || {})).catch(() => {});
  }, []);

  const resolveHotel = (pkg) => {
    if (!pkg) return { id: null, name: 'Default', price: 0 };
    if (pkg.default_hotel_name || pkg.default_hotel_price != null) {
      return { id: pkg.default_hotel_id || null, name: pkg.default_hotel_name || 'Default', price: Number(pkg.default_hotel_price || 0) };
    }
    const h = hotels.find((x) => Number(x.id) === Number(pkg.default_hotel_id));
    return { id: h?.id || null, name: h?.name || 'Default', price: Number(h?.price || 0) };
  };

  const resolveVehicle = (pkg) => {
    if (!pkg) return { id: null, name: 'Default', price: 0 };
    if (pkg.default_vehicle_name || pkg.default_vehicle_price != null) {
      return { id: pkg.default_vehicle_id || null, name: pkg.default_vehicle_name || 'Default', price: Number(pkg.default_vehicle_price || 0) };
    }
    const v = vehicles.find((x) => Number(x.id) === Number(pkg.default_vehicle_id));
    return { id: v?.id || null, name: v?.name || 'Default', price: Number(v?.price || 0) };
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({
      customer_id: '',
      package_id: '',
      hotel_id: '',
      vehicle_id: '',
      valid_until: '',
      family_count: '1',
      trip_days: '',
      discount: '0',
      tax_percent: '0',
      terms_text: '',
      items: [
        { item: '', description: '', qty: '1', price: '' },
      ],
    });
    setModal({ open: true });
  };

  const openEdit = (row) => {
    getQuotation(row.id)
      .then((r) => {
        const q = r.data;
        setForm({
          customer_id: q.customer_id ? String(q.customer_id) : '',
          package_id: q.package_id ? String(q.package_id) : '',
          hotel_id: '',
          vehicle_id: '',
          valid_until: q.valid_until ? String(q.valid_until).slice(0, 10) : '',
          family_count: q.family_count != null ? String(q.family_count) : '1',
          trip_days: '',
          discount: q.discount != null ? String(q.discount) : '0',
          tax_percent: q.tax_percent != null ? String(q.tax_percent) : '0',
          terms_text: q.terms_text || '',
          items: (q.items || []).map((it) => ({
            item: '',
            description: it.description || '',
            qty: '1',
            price: String(it.amount || 0),
          })),
        });
        setEditingId(q.id);
        setModal({ open: true });
      })
      .catch(() => toast('Failed to load quotation', 'error'));
  };

  const openDetail = (row) => {
    getQuotation(row.id).then((r) => setDetail(r.data)).catch(() => toast('Failed to load', 'error'));
  };

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { item: '', description: '', qty: '', price: '' }],
    }));
  const updateItem = (i, field, value) =>
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const rowTotal = (row) => {
    const qty = Number(row.qty) || 0;
    const price = Number(row.price) || 0;
    return qty * price;
  };

  const persons = Number(form.family_count) || 1;
  const itemsSubtotal = form.items.reduce((sum, it) => sum + rowTotal(it), 0);
  const subtotal = itemsSubtotal * persons;
  const discountValue = Number(form.discount) || 0; // flat for now
  const taxableBase = Math.max(subtotal - discountValue, 0);
  const taxRate = Number(form.tax_percent) || 0;
  const taxAmount = (taxableBase * taxRate) / 100;
  const grandTotal = taxableBase + taxAmount;

  const selectedPackage = packages.find((p) => p.id === Number(form.package_id));
  const packageCityIds = Array.isArray(selectedPackage?.city_ids)
    ? selectedPackage.city_ids.map((id) => Number(id)).filter(Boolean)
    : [];

  const hotelOptions = packageCityIds.length
    ? hotels.filter((h) => !h.city_id || packageCityIds.includes(Number(h.city_id)))
    : hotels;

  const vehicleOptions = packageCityIds.length
    ? vehicles.filter((v) => !v.city_id || packageCityIds.includes(Number(v.city_id)))
    : vehicles;

  const packageItemFromId = (packageId) => {
    const pkg = packages.find((p) => p.id === Number(packageId));
    if (!pkg) return null;
    const hotel = resolveHotel(pkg);
    const vehicle = resolveVehicle(pkg);
    const days = Number(form.trip_days) || 1;
    return {
      pkg,
      hotel,
      vehicle,
      items: [
        {
          item: 'Package',
          description: pkg.name || pkg.title || 'Package',
          qty: '1',
          price: String(Number(pkg.price || 0)),
        },
        {
          item: 'Hotel',
          description: `Hotel: ${hotel.name}`,
          qty: String(days),
          price: String(Number(hotel.price || 0)),
        },
        {
          item: 'Vehicle',
          description: `Vehicle: ${vehicle.name}`,
          qty: String(days),
          price: String(Number(vehicle.price || 0)),
        },
      ],
    };
  };

  const onPackageChange = (value) => {
    if (!value) {
      setForm((f) => ({
        ...f,
        package_id: '',
        hotel_id: '',
        vehicle_id: '',
        items: f.items?.length ? f.items : [{ item: '', description: '', qty: '1', price: '' }],
      }));
      return;
    }
    const res = packageItemFromId(value);
    setForm((f) => ({
      ...f,
      package_id: value,
      hotel_id: res?.hotel?.id ? String(res.hotel.id) : '',
      vehicle_id: res?.vehicle?.id ? String(res.vehicle.id) : '',
      items: res?.items || f.items,
    }));
  };

  const handleHotelChange = (hotelId) => {
    setForm((f) => {
      const h = hotels.find((x) => String(x.id) === String(hotelId));
      const items = [...(f.items || [])];
      let idx = items.findIndex((it) => it.item === 'Hotel' || (it.description || '').startsWith('Hotel:'));
      if (idx === -1) {
        items.push({ item: 'Hotel', description: '', qty: '1', price: '' });
        idx = items.length - 1;
      }
      items[idx] = {
        ...items[idx],
        item: 'Hotel',
        description: `Hotel: ${h?.name || 'Hotel'}`,
        qty: String(Number(f.trip_days) || 1),
        price: h ? String(Number(h.price || 0)) : items[idx].price,
      };
      return { ...f, hotel_id: hotelId, items };
    });
  };

  const handleVehicleChange = (vehicleId) => {
    setForm((f) => {
      const v = vehicles.find((x) => String(x.id) === String(vehicleId));
      const items = [...(f.items || [])];
      let idx = items.findIndex((it) => it.item === 'Vehicle' || (it.description || '').startsWith('Vehicle:'));
      if (idx === -1) {
        items.push({ item: 'Vehicle', description: '', qty: '1', price: '' });
        idx = items.length - 1;
      }
      items[idx] = {
        ...items[idx],
        item: 'Vehicle',
        description: `Vehicle: ${v?.name || 'Vehicle'}`,
        qty: String(Number(f.trip_days) || 1),
        price: v ? String(Number(v.price || 0)) : items[idx].price,
      };
      return { ...f, vehicle_id: vehicleId, items };
    });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.customer_id) { toast('Select customer', 'error'); return; }
    const people = Number(form.family_count) || 1;
    const items = form.items
      .filter((i) => i.item || i.description || i.qty || i.price)
      .map((i) => {
        const total = rowTotal(i) * people;
        const label = i.item || 'Item';
        const desc = i.description ? `${label} - ${i.description}` : label;
        return {
          description: desc,
          amount: total,
        };
      });
    const payload = {
      customer_id: Number(form.customer_id),
      package_id: form.package_id ? Number(form.package_id) : null,
      valid_until: form.valid_until || null,
      discount: Number(form.discount) || 0,
      tax_percent: Number(form.tax_percent) || 0,
      terms_text: form.terms_text?.trim() ? form.terms_text.trim() : null,
      family_count: people,
      items,
    };
    setSaving(true);
    const req = editingId ? updateQuotation(editingId, payload) : createQuotation(payload);
    req
      .then(() => {
        toast(editingId ? 'Quotation updated' : 'Quotation created');
        setModal({ open: false });
        setEditingId(null);
        load();
      })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete quotation #${row.id}?`)) return;
    deleteQuotation(row.id)
      .then(() => {
        toast('Quotation deleted');
        if (detail?.id === row.id) setDetail(null);
        load();
      })
      .catch(() => toast('Delete failed', 'error'));
  };

  const handleConvert = (id) => {
    convertQuotationToBooking(id).then(() => { toast('Booking created from quotation'); setDetail(null); load(); }).catch(() => toast('Failed', 'error'));
  };

  const handleDownloadPdf = (id) => {
    downloadQuotationPdf(id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quotation-${id}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1200);
        toast('PDF downloaded');
      })
      .catch(() => toast('Download failed', 'error'));
  };

  const handlePrintPdf = (id) => {
    downloadQuotationPdf(id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
          toast('Allow pop-ups to print quotation', 'error');
          return;
        }
        const tryPrint = () => {
          try {
            win.focus();
            win.print();
          } catch (_) {}
        };
        setTimeout(tryPrint, 800);
        setTimeout(() => window.URL.revokeObjectURL(url), 120000);
      })
      .catch(() => toast('Print failed', 'error'));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Quotations</h1>
        <Button onClick={openAdd}>+ New Quotation</Button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <Loading /> : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No quotations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-tl-2xl">ID</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Package</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Total</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Valid Until</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider rounded-tr-2xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-teal-700">#{row.id}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{row.customer_name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.package_name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-right font-semibold text-slate-800">₹{Number(row.total || 0).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.valid_until ? String(row.valid_until).slice(0, 10) : '-'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openDetail(row)} className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition">View</button>
                        <button onClick={() => openEdit(row)} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">Edit</button>
                        <button onClick={() => handleDelete(row)} className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal.open} onClose={() => { setModal({ open: false }); setEditingId(null); }} title={editingId ? 'Edit Quotation' : 'New Quotation'} size="xl">
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Section A – Basic Information */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Select —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Input
                  label="Valid Until"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
                <Input
                  label="Family count (persons)"
                  type="number"
                  min="1"
                  value={form.family_count}
                  onChange={(e) => setForm({ ...form, family_count: e.target.value })}
                />
                <Input
                  label="Trip days"
                  type="number"
                  min="1"
                  value={form.trip_days}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => {
                      const days = Number(value) || 1;
                      const items = (prev.items || []).map((it) => {
                        if (it.item === 'Hotel' || (it.description || '').startsWith('Hotel:')) {
                          return { ...it, qty: String(days) };
                        }
                        if (it.item === 'Vehicle' || (it.description || '').startsWith('Vehicle:')) {
                          return { ...it, qty: String(days) };
                        }
                        return it;
                      });
                      return { ...prev, trip_days: value, items };
                    });
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Section B – Package / Hotel / Vehicle */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Package Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Package (optional)</label>
                <select
                  value={form.package_id}
                  onChange={(e) => onPackageChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.name || p.title)} — ₹{Number(p.price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                {packageSelected && (
                  <p className="text-xs text-slate-500 mt-1">
                    Package selected: default Package, Hotel, and Vehicle rows are filled in Cost Breakdown. You can change hotel / vehicle and update any prices manually.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hotel (optional)</label>
                <select
                  value={form.hotel_id}
                  onChange={(e) => handleHotelChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">{packageSelected ? 'Use package default' : '— Select Hotel —'}</option>
                  {hotelOptions.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.price != null ? `— ₹${Number(h.price || 0).toLocaleString()}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle (optional)</label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">{packageSelected ? 'Use package default' : '— Select Vehicle —'}</option>
                  {vehicleOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.price != null ? `— ₹${Number(v.price || 0).toLocaleString()}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Terms & Conditions</h3>
            <label className="block text-xs text-slate-500 mb-2">Write one point per line</label>
            <textarea
              value={form.terms_text}
              onChange={(e) => setForm({ ...form, terms_text: e.target.value })}
              rows={6}
              placeholder={'Payment is due upon receipt.\nPrices are valid until quotation expiry.\nScope changes may change price and timeline.'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Card>

          {/* Section C – Cost Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Cost Breakdown</h3>
              <Button type="button" size="sm" variant="ghost" onClick={addItem}>
                + Add Row
              </Button>
            </div>
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 mb-1">
              <div className="col-span-3">Item</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-1 text-right">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <div className="md:col-span-3">
                    <select
                      value={item.item}
                      onChange={(e) => updateItem(i, 'item', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Custom</option>
                      <option value="Hotel Stay">Hotel Stay</option>
                      <option value="Transport">Transport</option>
                      <option value="Flight">Flight</option>
                      <option value="Activities">Activities</option>
                      <option value="Visa">Visa</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Service Charges">Service Charges</option>
                      <option value="Extra Add-ons">Extra Add-ons</option>
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => updateItem(i, 'qty', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => updateItem(i, 'price', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 text-right text-sm font-medium text-slate-800">
                    ₹{rowTotal(item).toLocaleString()}
                  </div>
                  <div className="md:col-span-12 flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Section D – Price Calculation */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Price Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Subtotal
                    {persons > 1 && (
                      <span className="text-xs text-slate-500 ml-1">
                        ({persons} persons)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Discount (₹)</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Tax %</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.tax_percent}
                    onChange={(e) => setForm({ ...form, tax_percent: e.target.value })}
                    className="w-24"
                  />
                </div>
              </div>
              <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Tax Amount</span>
                  <span className="font-medium text-slate-800">₹{taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-base mt-1">
                  <span className="font-semibold text-slate-700">Grand Total</span>
                  <span className="text-lg font-bold text-primary-600">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal({ open: false })}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (editingId ? 'Saving...' : 'Creating...') : editingId ? 'Save Changes' : 'Create Quotation'}
            </Button>
          </div>
        </form>
      </Modal>

      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title="View Quotation" size="xl">
          <div className="bg-white text-slate-800 max-w-4xl mx-auto rounded-lg overflow-hidden print:shadow-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">QUOTATION</h1>
                <p className="text-sm font-semibold text-slate-700 mt-1">{COMPANY.name}</p>
                <p className="text-xs text-slate-600">{COMPANY.address}</p>
                <p className="text-xs text-slate-600">{COMPANY.phone}</p>
                <p className="text-xs text-slate-600">{COMPANY.email}</p>
              </div>
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 bg-slate-50 shrink-0">
                Logo
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
              <div><span className="text-slate-500">Quote No.</span> <span className="font-medium">QTN-{new Date().getFullYear()}-{String(detail.id).padStart(4, '0')}</span></div>
              <div><span className="text-slate-500">Prepared by:</span> <span className="font-medium">{detail.prepared_by || '-'}</span></div>
              <div><span className="text-slate-500">Quote Date:</span> {detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '—'}</div>
              <div><span className="text-slate-500">Due Date:</span> {detail.valid_until || '—'}</div>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-100 px-4 py-3 rounded mb-4">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Customer Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <p><span className="text-slate-500">Name:</span> {detail.customer_name || '—'}</p>
                <p><span className="text-slate-500">Email:</span> {detail.customer_email || '—'}</p>
                <p><span className="text-slate-500">Address:</span> —</p>
                <p><span className="text-slate-500">Phone:</span> {detail.mobile || '—'}</p>
                <p><span className="text-slate-500">No. of Persons:</span> {detail.family_count ?? 1}</p>
              </div>
            </div>

            {/* Cost breakdown table */}
            <div className="border border-slate-200 rounded overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="px-4 py-2 font-semibold text-slate-700">Item Description</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 text-right w-28">Unit Price</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 text-right w-20">Qty</th>
                    <th className="px-4 py-2 font-semibold text-slate-700 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{i.description || '—'}</td>
                      <td className="px-4 py-2 text-right">₹{Number(i.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">1</td>
                      <td className="px-4 py-2 text-right font-medium">₹{Number(i.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!detail.items || detail.items.length === 0) && (
                    <tr className="border-t border-slate-100"><td colSpan={4} className="px-4 py-4 text-slate-500 text-center">No line items</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Terms */}
              <div className="flex-1 text-xs text-slate-600 pr-4">
                <h3 className="font-semibold text-slate-700 mb-1">Terms and Conditions</h3>
                <p className="leading-relaxed whitespace-pre-line">{detail.terms_text || '—'}</p>
              </div>
              {/* Price summary */}
              <div className="sm:w-56 shrink-0 space-y-2 border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal</span><span className="font-medium">₹{(detail.items || []).reduce((s, i) => s + Number(i.amount || 0), 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-600">Discount</span><span className="font-medium">₹{Number(detail.discount || 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-600">Tax ({detail.tax_percent || 0}%)</span><span className="font-medium">—</span></div>
                <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2"><span>Grand Total</span><span className="text-primary-600">₹{Number(detail.total || 0).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Customer Acceptance */}
            <div className="bg-slate-100 px-4 py-3 rounded mb-6">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Customer Acceptance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <p><span className="text-slate-500">Signature:</span> _________________</p>
                <p><span className="text-slate-500">Name:</span> _________________</p>
                <p><span className="text-slate-500">Date:</span> _________________</p>
              </div>
            </div>

            <PaymentCard settings={paymentSettings} className="mb-6" />

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200 print:hidden">
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
              <Button variant="secondary" onClick={() => openEdit(detail)}>Edit</Button>
              <Button variant="secondary" onClick={() => handlePrintPdf(detail.id)}>Print</Button>
              <Button variant="secondary" onClick={() => handleDownloadPdf(detail.id)}>Download PDF</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

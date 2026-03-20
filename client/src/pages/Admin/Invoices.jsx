import { useState, useEffect, useMemo } from 'react';
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
  getCities,
  getHotels,
  getActivities,
  getItineraryTemplates,
  getStaff,
  getVehicles,
  getCompanySettings,
  downloadInvoicePdf,
} from '../../services/api';
import { getStoredUser } from '../../utils/auth';
import { getSelectedBranchId, branchParams } from '../../utils/branch';
import { getUniqueStates } from '../../utils/cities';
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

const getTripDays = (start, end) => {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
};

const getPaxUnits = (couples, adults, children) => {
  const c = Number(couples || 0);
  const a = Number(adults || 0);
  const ch = Number(children || 0);
  return (c * 2) + (a * 0.5) + (ch * 0.25);
};

const parseItinerary = (value) => {
  if (!value) return [];
  return value
    .split('/')
    .map((chunk) => chunk.trim())
    .map((chunk) => {
      const match = chunk.match(/^(\d+)\s*N\s*(.+)$/i);
      if (!match) return null;
      return { nights: Number(match[1]), location: match[2].trim() };
    })
    .filter(Boolean);
};

const buildPlanFromDays = (days = []) => {
  const validDays = (Array.isArray(days) ? days : []).filter((d) => d?.city_name && Number(d?.night_count) > 0);
  if (!validDays.length) return '';
  return validDays.map((d) => `${Number(d.night_count)}N ${d.city_name}`).join(' / ');
};

const getHotelStar = (roomType) => {
  const text = String(roomType || '').toLowerCase();
  const m = text.match(/([1-5])\s*\*|([1-5])\s*star/);
  return m?.[1] || m?.[2] || '';
};

const getAutoEndDate = (startDate, nights) => {
  if (!startDate || !Number(nights)) return '';
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return '';
  start.setDate(start.getDate() + Number(nights) - 1);
  return start.toISOString().slice(0, 10);
};

const TRIP_REFERENCE_HEADER = 'Trip Reference:';
const stripTripReference = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const blocks = text.split(/\n{2,}/);
  const filtered = blocks.filter((block) => !block.trim().startsWith(TRIP_REFERENCE_HEADER));
  return filtered.join('\n\n').trim();
};

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
  const [itineraryTemplates, setItineraryTemplates] = useState([]);
  const [cities, setCities] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activityMasters, setActivityMasters] = useState([]);
  const [hotelStarFilter, setHotelStarFilter] = useState('');
  const [hotelInfoRows, setHotelInfoRows] = useState([]);
  const [transfers, setTransfers] = useState([{ vehicle: '', quantity: '1' }]);
  const [activities, setActivities] = useState([{ activity: '' }]);
  const [staff, setStaff] = useState([]);
  const [branchId, setBranchId] = useState(() => getSelectedBranchId());
  const [nextNumber, setNextNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({});
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    booking_id: '',
    itinerary_id: '',
    state_name: '',
    nights: '',
    customer_id: '',
    place_of_supply: '',
    billing_address: '',
    customer_gst: '',
    sales_executive_id: '',
    travel_destination: '',
    travel_start_date: '',
    travel_end_date: '',
    couples: '0',
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
    company_contact: '7818814380',
    company_name: 'Vision Travel Hub',
    markup: '0',
    items: [emptyItem(), emptyItem()],
  });

  const load = () => {
    setLoading(true);
    const params = branchParams(branchId);
    getInvoices(params).then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [branchId]);
  useEffect(() => {
    const params = branchId && branchId !== 'all' ? { limit: 500, branch_id: branchId } : { limit: 500 };
    getCustomers(params).then((r) => setCustomers(r.data?.data || r.data || [])).catch(() => {});
  }, [branchId]);
  useEffect(() => {
    const params = branchId && branchId !== 'all' ? { limit: 500, branch_id: branchId } : { limit: 500 };
    getCustomers(params).then((r) => setCustomers(r.data?.data || r.data || [])).catch(() => {});
    getBookings({ limit: 200 }).then((r) => setBookings(r.data?.data || r.data || [])).catch(() => {});
    getItineraryTemplates(params).then((r) => setItineraryTemplates((r.data || []).filter((t) => t.is_active))).catch(() => setItineraryTemplates([]));
    getCities(params).then((r) => setCities(r.data || [])).catch(() => setCities([]));
    getHotels(params).then((r) => setHotels(r.data || [])).catch(() => setHotels([]));
    getVehicles(params).then((r) => setVehicles(r.data || [])).catch(() => setVehicles([]));
    getActivities(params).then((r) => setActivityMasters(r.data || [])).catch(() => setActivityMasters([]));
    getStaff().then((r) => setStaff(r.data || [])).catch(() => {});
    getCompanySettings().then((r) => setPaymentSettings(r.data || {})).catch(() => {});

    const onBranch = () => setBranchId(getSelectedBranchId());
    window.addEventListener('vth_branch_changed', onBranch);
    return () => window.removeEventListener('vth_branch_changed', onBranch);
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
      itinerary_id: '',
      state_name: '',
      nights: '',
      customer_id: '',
      place_of_supply: '',
      billing_address: '',
      customer_gst: '',
      sales_executive_id: user?.id ? String(user.id) : '',
      travel_destination: '',
      travel_start_date: '',
      travel_end_date: '',
      couples: '0',
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
      company_contact: '7818814380',
      company_name: 'Vision Travel Hub',
      markup: '0',
      items: [emptyItem(), emptyItem()],
    });
    setHotelStarFilter('');
    setHotelInfoRows([]);
    setTransfers([{ vehicle: '', quantity: '1' }]);
    setActivities([{ activity: '' }]);
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
          itinerary_id: '',
          state_name: inv.state_name || '',
          nights: '',
          customer_id: inv.customer_id ? String(inv.customer_id) : '',
          place_of_supply: inv.place_of_supply || '',
          billing_address: inv.billing_address || '',
          customer_gst: inv.customer_gst || '',
          sales_executive_id: inv.created_by ? String(inv.created_by) : (user?.id ? String(user.id) : ''),
          travel_destination: inv.travel_destination || '',
          travel_start_date: inv.travel_start_date ? String(inv.travel_start_date).slice(0, 10) : '',
          travel_end_date: inv.travel_end_date ? String(inv.travel_end_date).slice(0, 10) : '',
          couples: '0',
          adults: String(inv.adults ?? 0),
          children: String(inv.children ?? 0),
          package_name: inv.package_name || '',
          hotel_category: inv.hotel_category || '',
          vehicle_type: inv.vehicle_type || '',
          terms_text: stripTripReference(inv.terms_text || ''),
          company_gst: inv.company_gst || '',
          company_contact: '7818814380',
          company_name: 'Vision Travel Hub',
          markup: '0',
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
        setHotelStarFilter('');
        setTransfers([{ vehicle: '', quantity: '1' }]);
        setActivities([{ activity: '' }]);
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
      customer_id: String(bk.customer_id),
      travel_start_date: bk.travel_start_date ? String(bk.travel_start_date).slice(0, 10) : f.travel_start_date,
      travel_end_date: bk.travel_end_date ? String(bk.travel_end_date).slice(0, 10) : f.travel_end_date,
    }));
    const cust = customers.find((c) => c.id === bk.customer_id);
    if (cust) {
      setForm((f) => ({
        ...f,
        billing_address: cust.address || f.billing_address,
      }));
    }
  };

  const onCustomerSelect = (customerId) => {
    const cust = customers.find((c) => c.id === Number(customerId));
    if (cust) setForm((f) => ({ ...f, billing_address: cust.address || f.billing_address }));
  };

  const onItinerarySelect = (itineraryId) => {
    if (!itineraryId) return;
    const selected = itineraryTemplates.find((item) => String(item.id) === String(itineraryId));
    if (!selected) return;
    const stops = (selected.days || []).length
      ? selected.days.map((d) => ({ nights: Number(d.night_count || 0), location: d.city_name || '' })).filter((d) => d.location)
      : parseItinerary(selected.plan || '');
    const totalNights = stops.reduce((sum, s) => sum + Number(s.nights || 0), 0);
    const plan = buildPlanFromDays(selected.days || []) || selected.plan || selected.title || '';
    const destination = stops.map((s) => s.location).join(', ');
    setForm((f) => {
      let autoEndDate = f.travel_end_date;
      if (f.travel_start_date && totalNights > 0) {
        const start = new Date(f.travel_start_date);
        if (!Number.isNaN(start.getTime())) {
          start.setDate(start.getDate() + totalNights - 1);
          autoEndDate = start.toISOString().slice(0, 10);
        }
      }
      return {
        ...f,
        itinerary_id: String(selected.id),
        state_name: selected.state_name || f.state_name,
        nights: String(totalNights || f.nights || ''),
        package_name: selected.title || plan || f.package_name,
        travel_destination: destination || f.travel_destination,
        travel_end_date: autoEndDate,
      };
    });
  };

  const recalcPackageItems = (formState) => {
    const autoEnd = getAutoEndDate(formState.travel_start_date, formState.nights);
    return { ...formState, travel_end_date: autoEnd || formState.travel_end_date };
  };

  const itineraryOptions = itineraryTemplates.map((t) => {
    const days = Array.isArray(t.days) ? t.days : [];
    const planLabel = buildPlanFromDays(days) || t.plan || t.title || `Itinerary ${t.id}`;
    const total = days.length
      ? days.reduce((sum, d) => sum + Number(d.night_count || 0), 0)
      : Number(t.total_nights || 0);
    return {
      id: t.id,
      label: planLabel,
      stateName: t.state_name || '',
      totalNights: total,
    };
  });
  const stateOptions = getUniqueStates(itineraryTemplates.map((t) => ({ country: t.state_name })));
  const stateFilteredItineraries = form.state_name
    ? itineraryOptions.filter((item) => String(item.stateName || '').trim() === String(form.state_name).trim())
    : [];
  const nightsOptions = [...new Set(stateFilteredItineraries.map((item) => Number(item.totalNights || 0)).filter((n) => n > 0))].sort((a, b) => a - b);
  const filteredItineraryOptions = form.nights
    ? stateFilteredItineraries.filter((item) => Number(item.totalNights) === Number(form.nights))
    : stateFilteredItineraries;
  const selectedItineraryOption = itineraryOptions.find((item) => String(item.id) === String(form.itinerary_id));
  const noItineraryForSelectedNights = Boolean(form.nights) && filteredItineraryOptions.length === 0;
  const selectedItinerary = itineraryTemplates.find((item) => String(item.id) === String(form.itinerary_id));
  const selectedStops = useMemo(() => (
    selectedItinerary
      ? ((selectedItinerary.days || []).length
        ? selectedItinerary.days.map((d) => ({ location: d.city_name || '', nights: Number(d.night_count || 0) })).filter((d) => d.location)
        : parseItinerary(selectedItinerary.plan || '').map((s) => ({ location: s.location, nights: Number(s.nights || 0) })))
      : []
  ), [selectedItinerary]);
  const cityMetaById = useMemo(
    () => Object.fromEntries((cities || []).map((c) => [Number(c.id), { name: c.name, state: c.country || '' }])),
    [cities]
  );
  const stopNameSet = useMemo(
    () => new Set(selectedStops.map((s) => String(s.location || '').trim().toLowerCase()).filter(Boolean)),
    [selectedStops]
  );
  const hotelCategoryOptions = useMemo(() => {
    const scoped = (hotels || []).filter((h) => {
      const cityMeta = cityMetaById[Number(h.city_id)];
      if (!cityMeta) return false;
      const cityName = String(cityMeta.name || '').trim().toLowerCase();
      if (stopNameSet.size) return stopNameSet.has(cityName);
      if (form.state_name) return String(cityMeta.state || '').trim() === String(form.state_name).trim();
      return true;
    });
    return [...new Set(scoped.map((h) => h.category || h.name).filter(Boolean))];
  }, [hotels, cityMetaById, stopNameSet, form.state_name]);
  const vehicleTypeOptions = useMemo(() => {
    const scoped = (vehicles || []).filter((v) => {
      const cityMeta = cityMetaById[Number(v.city_id)];
      if (stopNameSet.size) {
        const cityName = String(cityMeta?.name || '').trim().toLowerCase();
        return stopNameSet.has(cityName);
      }
      if (!form.state_name) return true;
      return String(cityMeta?.state || '').trim() === String(form.state_name).trim();
    });
    return [...new Set(scoped.map((v) => v.name || v.type).filter(Boolean))];
  }, [vehicles, form.state_name, cityMetaById, stopNameSet]);
  const hotelOptionsByLocation = useMemo(() => {
    const grouped = {};
    for (const hotel of hotels) {
      const cityMeta = cityMetaById[Number(hotel.city_id)];
      const location = cityMeta?.name;
      if (!location) continue;
      if (!grouped[location]) grouped[location] = [];
      grouped[location].push({ name: hotel.name, star: getHotelStar(hotel.room_type) });
    }
    return grouped;
  }, [hotels, cityMetaById]);
  const activityOptions = useMemo(
    () => [...new Set((activityMasters || []).map((a) => a.name).filter(Boolean))],
    [activityMasters]
  );
  const activityRateMap = useMemo(
    () => Object.fromEntries((activityMasters || []).map((a) => [String(a.name || '').toLowerCase(), Number(a.price || 0)])),
    [activityMasters]
  );
  useEffect(() => {
    if (form.hotel_category && !hotelCategoryOptions.includes(form.hotel_category)) {
      setForm((prev) => ({ ...prev, hotel_category: '' }));
    }
    if (form.vehicle_type && !vehicleTypeOptions.includes(form.vehicle_type)) {
      setForm((prev) => ({ ...prev, vehicle_type: '' }));
    }
  }, [hotelCategoryOptions, vehicleTypeOptions, form.hotel_category, form.vehicle_type]);
  useEffect(() => {
    setHotelInfoRows((prev) => {
      const prevByLocation = new Map((prev || []).map((row) => [row.location, row]));
      return selectedStops.map((s) => {
        const existing = prevByLocation.get(s.location);
        return existing ? { ...existing, location: s.location } : { location: s.location, hotel: '', meal: '' };
      });
    });
  }, [selectedStops]);
  useEffect(() => {
    const nightsByLocation = Object.fromEntries(selectedStops.map((s) => [String(s.location || '').toLowerCase(), Number(s.nights || 0)]));
    const hotelByName = Object.fromEntries((hotels || []).map((h) => [String(h.name || '').toLowerCase(), h]));
    const vehicleRateByName = Object.fromEntries((vehicles || []).map((v) => [String(v.name || '').toLowerCase(), Number(v.price || 0)]));
    const activityRateByName = Object.fromEntries((activityMasters || []).map((a) => [String(a.name || '').toLowerCase(), Number(a.price || 0)]));

    const couples = Number(form.couples || 0);
    const adults = Number(form.adults || 0);
    const children = Number(form.children || 0);
    const paxMultiplier = couples + (children * 0.25);
    const days = Number(form.nights || 0) || getTripDays(form.travel_start_date, form.travel_end_date);

    const hotelItems = (hotelInfoRows || [])
      .filter((r) => r.hotel)
      .map((row) => {
        const meta = hotelByName[String(row.hotel || '').toLowerCase()] || {};
        const rate = Number(meta.price || 0);
        const extraAdultRate = Number(meta.extra_adult_price || 0);
        const nights = Math.max(1, Number(nightsByLocation[String(row.location || '').toLowerCase()] || 0));
        const rooms = Math.max(1, couples || 0);
        const amount = (rate * rooms * nights) + (extraAdultRate * adults * nights);
        return {
          description: `Hotel: ${row.location} - ${row.hotel}${row.meal ? ` (${row.meal})` : ''}`,
          quantity: String(rooms * nights),
          rate: String(rate),
          amount: String(amount),
        };
      });

    const transferItems = (transfers || [])
      .filter((t) => t.vehicle)
      .map((t) => {
        const qty = Number(t.quantity || 1);
        const rate = Number(vehicleRateByName[String(t.vehicle || '').toLowerCase()] || 0);
        return {
          description: `Transfer: ${t.vehicle}`,
          quantity: String(qty * Math.max(1, days)),
          rate: String(rate),
          amount: String(qty * Math.max(1, days) * rate),
        };
      });

    const activityItems = (activities || [])
      .filter((a) => a.activity)
      .map((a) => {
        const rate = Number(activityRateByName[String(a.activity || '').toLowerCase()] || 0);
        return {
          description: `Activity: ${a.activity}`,
          quantity: String(Math.max(0, paxMultiplier)),
          rate: String(rate),
          amount: String(rate * Math.max(0, paxMultiplier)),
        };
      });

    const markupValue = Number(form.markup || 0);
    const markupItem = markupValue > 0
      ? [{ description: 'Markup', quantity: '1', rate: String(markupValue), amount: String(markupValue) }]
      : [];

    const autoItems = [...hotelItems, ...transferItems, ...activityItems, ...markupItem];
    setForm((prev) => ({ ...prev, items: autoItems.length ? autoItems : [emptyItem()] }));
  }, [
    selectedStops,
    hotels,
    vehicles,
    activityMasters,
    hotelInfoRows,
    transfers,
    activities,
    form.couples,
    form.adults,
    form.children,
    form.nights,
    form.travel_start_date,
    form.travel_end_date,
    form.markup,
  ]);
  const tripReferenceText = useMemo(() => {
    const itineraryLine = selectedItineraryOption?.label || form.package_name || '-';
    const stopsLine = selectedStops.length
      ? selectedStops.map((s) => `${Number(s.nights || 0)}N ${s.location}`).join(' / ')
      : '-';
    return [
      'Trip Reference:',
      `- State: ${form.state_name || '-'}`,
      `- Nights: ${form.nights || '-'}`,
      `- Itinerary: ${itineraryLine}`,
      `- Route: ${stopsLine}`,
      `- Destination: ${form.travel_destination || '-'}`,
      `- Travel Dates: ${form.travel_start_date || '-'} to ${form.travel_end_date || '-'}`,
      `- Passengers: Couples ${form.couples || '0'}, Adults ${form.adults || '0'}, Children ${form.children || '0'}`,
      `- Hotels: ${hotelInfoRows.map((r) => `${r.location}: ${r.hotel || '-'}, Meal ${r.meal || '-'}`).join(' | ') || '-'}`,
      `- Transfers: ${transfers.map((t) => `${t.vehicle || '-'} x ${t.quantity || '1'}`).join(' | ') || '-'}`,
      `- Activities: ${activities.map((a) => a.activity || '-').join(' | ') || '-'}`,
      `- Markup: ${form.markup || '0'}`,
      `- Company: ${form.company_name || '-'} (${form.company_contact || '-'})`,
    ].join('\n');
  }, [
    selectedItineraryOption,
    selectedStops,
    form.state_name,
    form.nights,
    form.package_name,
    form.travel_destination,
    form.travel_start_date,
    form.travel_end_date,
    form.couples,
    form.adults,
    form.children,
    form.markup,
    form.company_name,
    form.company_contact,
    hotelInfoRows,
    transfers,
    activities,
  ]);
  useEffect(() => {
    if (!form.hotel_category && hotelCategoryOptions.length) {
      setForm((prev) => ({ ...prev, hotel_category: hotelCategoryOptions[0] }));
    }
    if (!form.vehicle_type && vehicleTypeOptions.length) {
      setForm((prev) => ({ ...prev, vehicle_type: vehicleTypeOptions[0] }));
    }
  }, [hotelCategoryOptions, vehicleTypeOptions, form.hotel_category, form.vehicle_type]);

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
    const combinedTerms = stripTripReference(form.terms_text || '');
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
      state_name: form.state_name || null,
      travel_start_date: form.travel_start_date || null,
      travel_end_date: form.travel_end_date || null,
      adults: Number(form.adults) || 0,
      children: Number(form.children) || 0,
      package_name: form.package_name || null,
      hotel_category: form.hotel_category || null,
      vehicle_type: form.vehicle_type || null,
      terms_text: combinedTerms || null,
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
        // iOS/Safari is more reliable when the link is in DOM
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        // give the browser a moment to start the download
        setTimeout(() => window.URL.revokeObjectURL(url), 1200);
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
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Branch</th>
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
                    <td className="px-5 py-3.5 text-sm text-slate-600">{row.branch_name || '-'}</td>
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
            </div>
          </Card>

          {/* Section B – Billing Details */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Billing Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Billing Address" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
              <Input label="Company GST No. (shown in PDF)" value={form.company_gst} onChange={(e) => setForm({ ...form, company_gst: e.target.value })} placeholder={COMPANY?.gst || 'GST Number'} />
            </div>
          </Card>

          {/* Section C – Travel Details */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Travel Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <select
                  value={form.state_name}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    state_name: e.target.value,
                    nights: '',
                    itinerary_id: '',
                    package_name: '',
                    travel_destination: '',
                  }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select State —</option>
                  {stateOptions.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nights</label>
                <select
                  value={form.nights}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    nights: e.target.value,
                    itinerary_id: '',
                    package_name: '',
                    travel_destination: '',
                  }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={!form.state_name}
                >
                  <option value="">{form.state_name ? '— Select Nights —' : 'Select state first'}</option>
                  {nightsOptions.map((n) => (
                    <option key={n} value={n}>{n} Nights</option>
                  ))}
                </select>
                {noItineraryForSelectedNights && (
                  <p className="mt-1 text-xs text-amber-600">No itinerary available for selected nights.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Itinerary</label>
                <select
                  value={form.itinerary_id}
                  onChange={(e) => onItinerarySelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={!form.state_name}
                >
                  <option value="">{form.state_name ? '— Select Itinerary —' : 'Select state first'}</option>
                  {filteredItineraryOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              {!!selectedStops.length && (
                <div className="md:col-span-3 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Itinerary Breakdown</div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2">Nights</th>
                        <th className="text-left px-3 py-2">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStops.map((s, idx) => (
                        <tr key={`${s.location}-${idx}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">{Number(s.nights || 0)}</td>
                          <td className="px-3 py-2">{s.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Input label="Destination" value={form.travel_destination} onChange={(e) => setForm({ ...form, travel_destination: e.target.value })} />
              <Input
                label="No. of Couples"
                type="number"
                min="0"
                value={form.couples}
                onChange={(e) =>
                  setForm((prev) => recalcPackageItems({ ...prev, couples: e.target.value }))
                }
              />
              <Input
                label="Adults"
                type="number"
                min="0"
                value={form.adults}
                onChange={(e) =>
                  setForm((prev) => recalcPackageItems({ ...prev, adults: e.target.value }))
                }
              />
              <Input label="Children" type="number" min="0" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
              <Input
                label="Travel Start"
                type="date"
                value={form.travel_start_date}
                onChange={(e) =>
                  setForm((prev) => recalcPackageItems({ ...prev, travel_start_date: e.target.value }))
                }
              />
              <Input
                label="Travel End"
                type="date"
                value={form.travel_end_date}
                onChange={(e) =>
                  setForm((prev) => recalcPackageItems({ ...prev, travel_end_date: e.target.value }))
                }
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Hotel Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Star (All Locations)</label>
                <select
                  value={hotelStarFilter}
                  onChange={(e) => {
                    const star = e.target.value;
                    setHotelStarFilter(star);
                    setHotelInfoRows((prev) => prev.map((row) => {
                      const options = (hotelOptionsByLocation[row.location] || []).filter((h) => !star || !h.star || h.star === star);
                      const ok = options.some((h) => h.name === row.hotel);
                      return ok ? row : { ...row, hotel: '' };
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select star</option>
                  <option value="1">1 Star</option>
                  <option value="2">2 Star</option>
                  <option value="3">3 Star</option>
                  <option value="4">4 Star</option>
                  <option value="5">5 Star</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {hotelInfoRows.map((row, idx) => (
                <div key={`${row.location}-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input value={row.location} readOnly className="h-10 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm" />
                  <select
                    value={row.hotel}
                    onChange={(e) => setHotelInfoRows((prev) => prev.map((r, i) => (i === idx ? { ...r, hotel: e.target.value } : r)))}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Select hotel</option>
                    {(hotelOptionsByLocation[row.location] || [])
                      .filter((h) => !hotelStarFilter || !h.star || h.star === hotelStarFilter)
                      .map((h) => <option key={h.name} value={h.name}>{h.name}</option>)}
                  </select>
                  <select
                    value={row.meal}
                    onChange={(e) => setHotelInfoRows((prev) => prev.map((r, i) => (i === idx ? { ...r, meal: e.target.value } : r)))}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Select meal</option>
                    <option value="CP">CP</option>
                    <option value="MAP">MAP</option>
                    <option value="AP">AP</option>
                    <option value="EP">EP</option>
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Transfer Details</h3>
            <div className="space-y-2">
              {transfers.map((row, idx) => (
                <div key={`t-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={row.vehicle}
                    onChange={(e) => setTransfers((prev) => prev.map((r, i) => (i === idx ? { ...r, vehicle: e.target.value } : r)))}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Select vehicle</option>
                    {vehicleTypeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => setTransfers((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                  <Button type="button" variant="secondary" onClick={() => setTransfers((prev) => [...prev, { vehicle: '', quantity: '1' }])}>Add</Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Activity</h3>
            <div className="space-y-2">
              {activities.map((row, idx) => (
                <div key={`a-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={row.activity}
                    onChange={(e) => setActivities((prev) => prev.map((r, i) => (i === idx ? { ...r, activity: e.target.value } : r)))}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    <option value="">Select activity</option>
                    {activityOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input
                    readOnly
                    value={row.activity ? `Rs. ${Number(activityRateMap[String(row.activity).toLowerCase()] || 0).toLocaleString('en-IN')}` : '-'}
                    className="h-10 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700"
                  />
                  <Button type="button" variant="secondary" onClick={() => setActivities((prev) => [...prev, { activity: '' }])}>Add</Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Other</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Markup" type="number" min="0" step="0.01" value={form.markup} onChange={(e) => setForm({ ...form, markup: e.target.value })} />
              <Input label="Company Contact" value={form.company_contact} onChange={(e) => setForm({ ...form, company_contact: e.target.value })} />
              <Input label="Company Name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
          </Card>

          {/* Section D – Cost Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Cost Breakdown</h3>
              <span className="text-xs text-slate-500">Auto calculated from trip details</span>
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
                        <input className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm" value={item.description} readOnly />
                      </td>
                      <td className="py-1">
                        <input type="number" className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm" value={item.quantity} readOnly />
                      </td>
                      <td className="py-1">
                        <input type="number" className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm" value={item.rate} readOnly />
                      </td>
                      <td className="py-1 font-medium text-slate-800">₹{(Number(item.amount) || 0).toLocaleString()}</td>
                      <td className="py-1" />
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

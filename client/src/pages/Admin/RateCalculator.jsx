import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getActivities,
  getCities,
  getHotels,
  getItineraryTemplates,
  getVehicles,
} from '../../services/api';
import { branchParams } from '../../utils/branch';
import { getUniqueStates } from '../../utils/cities';
import TripDetails from './RateCalculator/TripDetails';
import PassengerDetails from './RateCalculator/PassengerDetails';
import HotelInfo from './RateCalculator/HotelInfo';
import TransferDetails from './RateCalculator/TransferDetails';
import Activity from './RateCalculator/Activity';
import OtherSection from './RateCalculator/OtherSection';

const PREVIEW_STORAGE_KEY = 'vth_rate_calculator_preview';
const DRAFT_STORAGE_KEY = 'vth_rate_calculator_draft';

function parseItinerary(value) {
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
}

function buildPlanFromDays(days = []) {
  const validDays = (Array.isArray(days) ? days : []).filter((d) => d?.city_name && Number(d?.night_count) > 0);
  if (!validDays.length) return '';
  return validDays.map((d) => `${Number(d.night_count)}N ${d.city_name}`).join(' / ');
}

function inr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getHotelStar(roomType) {
  const text = String(roomType || '').toLowerCase();
  const m = text.match(/([1-5])\s*\*|([1-5])\s*star/);
  if (m?.[1]) return m[1];
  if (m?.[2]) return m[2];
  const simple = text.match(/\b([1-5])\b/);
  return simple?.[1] || '';
}

function buildPackageInfoText({
  trip,
  itineraryLabel,
  stops,
  passenger,
  hotelRows,
  transfers,
  activities,
  other,
  hotelsMaster,
  vehiclesMaster,
  activitiesMaster,
}) {
  const totalNights = stops.reduce((sum, s) => sum + Number(s.nights || 0), 0);
  const totalDays = Number(trip.nights || totalNights || 0);
  const couples = Number(passenger.couples || 0);
  const extraAdults = Number(passenger.adults || 0);
  const extraChildren = Number(passenger.children || 0);
  const paxMultiplier = couples + (extraChildren * 0.25);
  const roomCount = Math.max(1, couples || 0);
  const locationLines = stops.map((s) => `- ${s.nights}N ${s.location}`).join('\n');
  const hotelPriceMap = {};
  const hotelExtraAdultPriceMap = {};
  (hotelsMaster || []).forEach((h) => {
    if (!h?.name) return;
    hotelPriceMap[String(h.name).toLowerCase()] = Number(h.price || 0);
    hotelExtraAdultPriceMap[String(h.name).toLowerCase()] = Number(h.extra_adult_price || 0);
  });
  const vehiclePriceMap = {};
  (vehiclesMaster || []).forEach((v) => {
    if (!v?.name) return;
    vehiclePriceMap[String(v.name).toLowerCase()] = Number(v.price || 0);
  });
  const activityPriceMap = {};
  (activitiesMaster || []).forEach((a) => {
    if (!a?.name) return;
    activityPriceMap[String(a.name).toLowerCase()] = Number(a.price || 0);
  });

  const nightsByLocation = Object.fromEntries(stops.map((s) => [String(s.location).toLowerCase(), Number(s.nights || 0)]));

  const hotelDetails = hotelRows.map((row) => {
    const unit = hotelPriceMap[String(row.hotel || '').toLowerCase()] || 0;
    const extraAdultUnit = hotelExtraAdultPriceMap[String(row.hotel || '').toLowerCase()] || 0;
    const nights = nightsByLocation[String(row.location || '').toLowerCase()] || 0;
    const stayNights = Math.max(1, nights);
    const baseTotal = unit * stayNights * roomCount;
    const extraAdultTotal = extraAdults * extraAdultUnit * stayNights;
    const total = baseTotal + extraAdultTotal;
    return {
      ...row,
      nights,
      unit,
      extraAdultUnit,
      total,
    };
  });
  const hotelTotal = hotelDetails.reduce((sum, h) => sum + Number(h.total || 0), 0);
  const hotels = hotelDetails
    .map((row, idx) => (
      `${idx + 1}) ${row.location}: Hotel: ${row.hotel || '-'}\n` +
      `  Meal: ${row.meal || '-'}\n` +
      `  Nights: ${row.nights || 0} | Rooms: ${roomCount}`
    ))
    .join('\n\n') || '-';

  const transferDetails = (transfers || [])
    .filter((t) => t.vehicle)
    .map((t) => {
      const qty = Number(t.quantity || 1);
      const rate = vehiclePriceMap[String(t.vehicle || '').toLowerCase()] || 0;
      const amount = qty * rate * Math.max(1, totalDays);
      return { ...t, qty, rate, amount };
    });
  const transferTotal = transferDetails.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const transferLines = transferDetails
    .map((t, idx) => `${idx + 1}) ${t.vehicle} x ${t.qty} x ${Math.max(1, totalDays)} day(s)`)
    .join('\n') || '-';

  const activityDetails = (activities || [])
    .filter((a) => a.activity)
    .map((a) => {
      const rate = activityPriceMap[String(a.activity || '').toLowerCase()] || 0;
      const amount = rate * Math.max(0, paxMultiplier);
      return { ...a, rate, amount };
    });
  const activityTotal = activityDetails.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const activityLines = activityDetails
    .map((a, idx) => `${idx + 1}) ${a.activity}`)
    .join('\n') || '-';

  const subtotal = hotelTotal + transferTotal + activityTotal;
  const markupValue = Number(other.markup || 0);
  const grandTotal = subtotal + markupValue;

  return (
    `📦 PACKAGE INFO\n` +
    `============\n\n` +
    `🙏 Greetings from Vision Travel Hub,\n\n` +
    `🧭 Trip Details:\n` +
    `- State: ${trip.stateName || '-'}\n` +
    `- Nights: ${trip.nights || totalNights || '-'}\n` +
    `- Itinerary: ${itineraryLabel || '-'}\n\n` +
    `👨‍👩‍👧 Passenger Details:\n` +
    `- Travel Date: ${passenger.travelDate || '-'}\n` +
    `- No. of Couples: ${passenger.couples || '0'}\n` +
    `- Adults: ${passenger.adults || '0'}\n` +
    `- Children (6-10 yrs): ${passenger.children || '0'}\n\n` +
    `Dear Customer, please find below your ${totalNights} Nights itinerary:\n` +
    `${locationLines}\n\n` +
    `📞 Phone Number: ${other.companyContact || '-'}\n` +
    `🏢 Company: ${other.companyName || '-'}\n\n` +
    `🏨 Hotels:\n${hotels}\n\n` +
    `🚕 Transfers:\n${transferLines}\n\n` +
    `🎯 Activities:\n${activityLines}\n\n` +
    `💰 PRICE SUMMARY:\n` +
    `- GRAND TOTAL: ${inr(grandTotal)}`
  );
}

export default function RateCalculator() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = useMemo(() => new URLSearchParams(location.search).get('edit') === '1', [location.search]);
  const [trip, setTrip] = useState({
    stateName: '',
    nights: '',
    itineraryId: '',
  });
  const [passenger, setPassenger] = useState({
    travelDate: '',
    couples: '1',
    adults: '0',
    children: '0',
  });
  const [transfers, setTransfers] = useState([{ vehicle: '', quantity: '1' }]);
  const [activities, setActivities] = useState([{ activity: '' }]);
  const [other, setOther] = useState({
    markup: '0',
    companyContact: '7818814380',
    companyName: 'Vision Travel Hub',
  });
  const [hotelStarFilter, setHotelStarFilter] = useState('');
  const [hotelInfoRows, setHotelInfoRows] = useState([]);
  const [itineraryTemplates, setItineraryTemplates] = useState([]);
  const [cities, setCities] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activityMasters, setActivityMasters] = useState([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isEditMode) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftLoaded(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.trip) setTrip(draft.trip);
        if (draft?.passenger) setPassenger(draft.passenger);
        if (Array.isArray(draft?.transfers)) setTransfers(draft.transfers);
        if (Array.isArray(draft?.activities)) setActivities(draft.activities);
        if (draft?.other) setOther(draft.other);
        if (Array.isArray(draft?.hotelInfoRows)) setHotelInfoRows(draft.hotelInfoRows);
      }
    } catch {
      // ignore corrupt draft data
    } finally {
      setDraftLoaded(true);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !draftLoaded) return;
    const draft = {
      trip,
      passenger,
      transfers,
      activities,
      other,
      hotelInfoRows,
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [trip, passenger, transfers, activities, other, hotelInfoRows, draftLoaded]);

  useEffect(() => {
    const params = branchParams('all');
    Promise.allSettled([
      getItineraryTemplates(params),
      getCities(params),
      getHotels(params),
      getVehicles(params),
      getActivities(params),
    ])
      .then((results) => {
        const [itinerariesRes, citiesRes, hotelsRes, vehiclesRes, activitiesRes] = results;
        setItineraryTemplates(
          itinerariesRes.status === 'fulfilled'
            ? (itinerariesRes.value.data || []).filter((t) => t.is_active)
            : []
        );
        setCities(citiesRes.status === 'fulfilled' ? (citiesRes.value.data || []) : []);
        setHotels(hotelsRes.status === 'fulfilled' ? (hotelsRes.value.data || []) : []);
        setVehicles(vehiclesRes.status === 'fulfilled' ? (vehiclesRes.value.data || []) : []);
        setActivityMasters(activitiesRes.status === 'fulfilled' ? (activitiesRes.value.data || []) : []);
      });
  }, []);

  const selectedTemplate = useMemo(
    () => itineraryTemplates.find((item) => String(item.id) === String(trip.itineraryId)) || null,
    [itineraryTemplates, trip.itineraryId]
  );
  const parsedStops = useMemo(() => {
    if (selectedTemplate?.days?.length) {
      return selectedTemplate.days.map((d) => ({
        nights: Number(d.night_count || 0),
        location: d.city_name || '',
      })).filter((d) => d.location);
    }
    return parseItinerary(selectedTemplate?.plan || '');
  }, [selectedTemplate]);
  const autoNights = useMemo(
    () => parsedStops.reduce((sum, stop) => sum + Number(stop.nights || 0), 0),
    [parsedStops]
  );
  const itineraryOptions = useMemo(() => {
    return itineraryTemplates.map((t) => {
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
  }, [itineraryTemplates]);
  const stateOptions = useMemo(
    () => getUniqueStates(itineraryTemplates.map((t) => ({ country: t.state_name }))),
    [itineraryTemplates]
  );
  const stateFilteredItineraryOptions = useMemo(() => {
    if (!trip.stateName) return [];
    return itineraryOptions.filter((item) => String(item.stateName || '').trim() === String(trip.stateName).trim());
  }, [itineraryOptions, trip.stateName]);
  const availableNights = useMemo(
    () => [...new Set(stateFilteredItineraryOptions.map((item) => Number(item.totalNights || 0)).filter((n) => n > 0))].sort((a, b) => a - b),
    [stateFilteredItineraryOptions]
  );
  const filteredItineraryOptions = useMemo(() => {
    if (!trip.stateName) return [];
    if (!trip.nights) return stateFilteredItineraryOptions;
    return stateFilteredItineraryOptions.filter((item) => Number(item.totalNights) === Number(trip.nights));
  }, [trip.stateName, trip.nights, stateFilteredItineraryOptions]);
  const noItineraryForSelectedNights = Boolean(trip.nights) && filteredItineraryOptions.length === 0;
  const cityIdToName = useMemo(
    () => Object.fromEntries(cities.map((city) => [Number(city.id), city.name])),
    [cities]
  );
  const hotelOptionsByLocation = useMemo(() => {
    const grouped = {};
    for (const hotel of hotels) {
      const location = cityIdToName[Number(hotel.city_id)];
      if (!location) continue;
      if (!grouped[location]) grouped[location] = [];
      grouped[location].push({ name: hotel.name, star: getHotelStar(hotel.room_type) });
    }
    return grouped;
  }, [hotels, cityIdToName]);
  useEffect(() => {
    if (!hotelStarFilter) return;
    setHotelInfoRows((prev) => prev.map((row) => {
      const options = (hotelOptionsByLocation[row.location] || []).filter((h) => !h.star || h.star === hotelStarFilter);
      const exists = options.some((h) => h.name === row.hotel);
      return exists ? row : { ...row, hotel: '' };
    }));
  }, [hotelStarFilter, hotelOptionsByLocation]);
  const vehicleOptions = useMemo(
    () => [...new Set(vehicles.map((v) => v.name).filter(Boolean))],
    [vehicles]
  );
  const activityOptions = useMemo(
    () => [...new Set(activityMasters.map((a) => a.name).filter(Boolean))],
    [activityMasters]
  );
  const activityRateMap = useMemo(
    () => Object.fromEntries(activityMasters.map((a) => [String(a.name || '').toLowerCase(), Number(a.price || 0)])),
    [activityMasters]
  );
  useEffect(() => {
    if (!trip.itineraryId) return;
    const existsInFiltered = filteredItineraryOptions.some((item) => String(item.id) === String(trip.itineraryId));
    if (!existsInFiltered) {
      setTrip((prev) => ({ ...prev, itineraryId: '' }));
    }
  }, [filteredItineraryOptions, trip.itineraryId, trip.stateName]);

  const nightsOptions = availableNights;

  const hotelRows = useMemo(
    () => parsedStops.map((stop) => ({ location: stop.location, hotel: '', meal: '' })),
    [parsedStops]
  );

  useEffect(() => {
    setHotelInfoRows((prev) => {
      const prevByLocation = new Map((prev || []).map((row) => [row.location, row]));
      const merged = hotelRows.map((row) => {
        const existing = prevByLocation.get(row.location);
        return existing ? { ...row, ...existing, location: row.location } : row;
      });
      return merged;
    });
  }, [hotelRows]);

  const isValidForCalculation = Boolean(trip.itineraryId && passenger.travelDate && parsedStops.length);
  const handleCalculate = () => {
    const text = buildPackageInfoText({
      trip,
      itineraryLabel: selectedTemplate?.title || '',
      stops: parsedStops,
      passenger,
      hotelRows: hotelInfoRows,
      transfers,
      activities,
      other,
      hotelsMaster: hotels,
      vehiclesMaster: vehicles,
      activitiesMaster: activityMasters,
    });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, text);
    }
    navigate('preview');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">Rate Calculator</h1>

      <TripDetails
        stateName={trip.stateName}
        setStateName={(value) => setTrip((prev) => ({ ...prev, stateName: value, nights: '', itineraryId: '' }))}
        stateOptions={stateOptions}
        nights={trip.nights || (autoNights ? String(autoNights) : '')}
        setNights={(value) => setTrip((prev) => ({ ...prev, nights: value, itineraryId: '' }))}
        itineraryId={trip.itineraryId}
        setItineraryId={(value) => {
          const selected = filteredItineraryOptions.find((item) => String(item.id) === String(value));
          setTrip((prev) => ({
            ...prev,
            itineraryId: value,
            nights: selected?.totalNights ? String(selected.totalNights) : prev.nights,
            stateName: selected?.stateName || prev.stateName,
          }));
        }}
        parsedStops={parsedStops}
        itineraryOptions={filteredItineraryOptions}
        nightsOptions={nightsOptions}
        noItineraryForSelectedNights={noItineraryForSelectedNights}
      />

      <PassengerDetails form={passenger} setForm={setPassenger} />

      <HotelInfo
        rows={hotelInfoRows}
        setRows={setHotelInfoRows}
        hotelOptionsByLocation={hotelOptionsByLocation}
        hotelStarFilter={hotelStarFilter}
        setHotelStarFilter={setHotelStarFilter}
      />


      <TransferDetails transfers={transfers} setTransfers={setTransfers} vehicleOptions={vehicleOptions} />

      <Activity
        activities={activities}
        setActivities={setActivities}
        activityOptions={activityOptions}
        activityRateMap={activityRateMap}
      />

      <OtherSection other={other} setOther={setOther} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!isValidForCalculation}
          className="h-10 px-4 rounded-lg bg-primary-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition"
        >
          Calculate Trip Cost
        </button>
      </div>
    </div>
  );
}

import Card from './Card';

const mealOptions = ['CP', 'MAP', 'AP', 'EP'];
const starOptions = ['1', '2', '3', '4', '5'];

export default function HotelInfo({ rows, setRows, hotelOptionsByLocation, hotelStarFilter, setHotelStarFilter }) {
  const onChange = (index, key, value) => {
    setRows((prev) => {
      // If first row meal changes, apply same value to all rows.
      if (index === 0 && key === 'meal') {
        return prev.map((row) => ({ ...row, [key]: value }));
      }
      return prev.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    });
  };

  return (
    <Card title="Hotel Info">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Star (All Locations)</label>
            <select
              value={hotelStarFilter || ''}
              onChange={(e) => setHotelStarFilter(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select star</option>
              {starOptions.map((star) => (
                <option key={star} value={star}>
                  {star} Star
                </option>
              ))}
            </select>
          </div>
        </div>
        {rows.map((row, idx) => (
          <div key={`${row.location}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
              <input
                value={row.location}
                readOnly
                className="w-full h-10 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700"
              />
            </div>
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-600 mb-1">Hotel</label>
              <select
                value={row.hotel}
                onChange={(e) => onChange(idx, 'hotel', e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">Select hotel</option>
                {(hotelOptionsByLocation[row.location] || [])
                  .filter((hotel) => !hotelStarFilter || !hotel.star || hotel.star === hotelStarFilter)
                  .map((hotel) => (
                  <option key={hotel.name} value={hotel.name}>
                    {hotel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Meal</label>
              <select
                value={row.meal}
                onChange={(e) => onChange(idx, 'meal', e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">Select meal</option>
                {mealOptions.map((meal) => (
                  <option key={meal} value={meal}>
                    {meal}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-slate-400">Select itinerary to load hotel rows.</p>}
      </div>
    </Card>
  );
}

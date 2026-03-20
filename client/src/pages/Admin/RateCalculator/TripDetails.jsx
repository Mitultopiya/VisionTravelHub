import Card from './Card';

export default function TripDetails({
  stateName,
  setStateName,
  stateOptions,
  nights,
  setNights,
  itineraryId,
  setItineraryId,
  parsedStops,
  itineraryOptions,
  nightsOptions,
  noItineraryForSelectedNights,
}) {
  return (
    <Card title="Trip Details">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-fit">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
            <select
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select state</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nights</label>
            <select
              value={nights}
              onChange={(e) => setNights(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={!stateName}
            >
              <option value="">Select nights</option>
              {nightsOptions.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Itinerary</label>
            <select
              value={itineraryId}
              onChange={(e) => setItineraryId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={!stateName || noItineraryForSelectedNights}
            >
              <option value="">Select itinerary</option>
              {itineraryOptions.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.label}
                </option>
              ))}
            </select>
            {!stateName && (
              <p className="mt-1 text-xs text-slate-500">Select state first.</p>
            )}
            {noItineraryForSelectedNights && (
              <p className="mt-1 text-xs text-red-600">No itinerary available for selected nights.</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[260px] border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Nights</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parsedStops.length ? (
                parsedStops.map((stop, idx) => (
                  <tr key={`${stop.location}-${idx}`}>
                    <td className="px-3 py-2 text-sm text-slate-700">{stop.nights}</td>
                    <td className="px-3 py-2 text-sm text-slate-800">{stop.location}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-sm text-slate-400">
                    Select itinerary to preview locations
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

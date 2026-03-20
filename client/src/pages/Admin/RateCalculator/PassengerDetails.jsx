import Card from './Card';

function rangeOptions(max) {
  return Array.from({ length: max + 1 }, (_, i) => i);
}

export default function PassengerDetails({ form, setForm }) {
  return (
    <Card title="Passenger Details">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Travel Date</label>
          <input
            type="date"
            value={form.travelDate}
            onChange={(e) => setForm((prev) => ({ ...prev, travelDate: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">No. of Couples</label>
          <select
            value={form.couples}
            onChange={(e) => setForm((prev) => ({ ...prev, couples: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {rangeOptions(12).map((v) => (
              <option key={v} value={String(v)}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ex. Adult</label>
          <select
            value={form.adults}
            onChange={(e) => setForm((prev) => ({ ...prev, adults: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {rangeOptions(30).map((v) => (
              <option key={v} value={String(v)}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ex. Child (6-10 yrs)</label>
          <select
            value={form.children}
            onChange={(e) => setForm((prev) => ({ ...prev, children: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {rangeOptions(20).map((v) => (
              <option key={v} value={String(v)}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}

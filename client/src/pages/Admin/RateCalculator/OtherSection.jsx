import Card from './Card';

export default function OtherSection({ other, setOther }) {
  return (
    <Card title="Other">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
          <input
            type="number"
            min={0}
            value={other.markup}
            onChange={(e) => setOther((prev) => ({ ...prev, markup: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Company Contact</label>
          <input
            value={other.companyContact}
            onChange={(e) => setOther((prev) => ({ ...prev, companyContact: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label>
          <input
            value={other.companyName}
            onChange={(e) => setOther((prev) => ({ ...prev, companyName: e.target.value }))}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
      </div>
    </Card>
  );
}

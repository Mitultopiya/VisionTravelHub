import Card from './Card';

export default function Activity({ activities, setActivities, activityOptions = [], activityRateMap = {} }) {
  const updateRow = (idx, key, value) => {
    setActivities((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  };

  return (
    <Card title="Activity">
      <div className="space-y-2">
        {activities.map((row, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-8">
              <label className="block text-xs font-medium text-slate-600 mb-1">Activity</label>
              <select
                value={row.activity}
                onChange={(e) => updateRow(idx, 'activity', e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">Select activity</option>
                {activityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Auto Price</label>
              <input
                value={
                  row.activity
                    ? `Rs. ${Number(activityRateMap[String(row.activity).toLowerCase()] || 0).toLocaleString('en-IN')}`
                    : '-'
                }
                readOnly
                className="w-full h-10 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Card({ title, children, right }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {right}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

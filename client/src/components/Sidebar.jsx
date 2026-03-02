import { NavLink } from 'react-router-dom';

const base =
  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition';
const active = 'bg-primary-500 text-white';
const inactive = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

export default function Sidebar({ items }) {
  return (
    <aside className="w-56 bg-white border-r border-slate-200 min-h-[calc(100vh-52px)] p-3">
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${base} ${isActive ? active : inactive}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

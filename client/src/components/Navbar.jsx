import { getStoredUser, logout } from '../utils/auth';

export default function Navbar({ title }) {
  const user = getStoredUser();

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {user?.name} <span className="text-slate-400">({user?.role})</span>
          </span>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

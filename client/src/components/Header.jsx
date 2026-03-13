import { getStoredUser, logout } from '../utils/auth';
import Button from './ui/Button';
import { FaBars } from 'react-icons/fa';

export default function Header({ onMenuClick }) {
  const user = getStoredUser();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 min-h-[52px] sm:min-h-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-800 touch-manipulation"
              aria-label="Open menu"
            >
              <FaBars className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <div className="w-2 h-5 sm:h-6 rounded-full bg-primary-500 hidden sm:block flex-shrink-0" />
          <span className="text-slate-500 text-xs sm:text-sm font-medium truncate">Admin Panel</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 text-xs sm:text-sm touch-manipulation"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

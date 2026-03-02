import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { setStoredAuth } from '../utils/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(email, password);
      setStoredAuth(data.token, data.user);
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8e4f3] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[520px]">
        {/* Left panel - Login form */}
        <div className="w-full md:w-[42%] bg-white p-8 md:p-10 flex flex-col">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-white font-semibold text-lg">
              T
            </div>
            <span className="text-slate-700 font-semibold text-lg">
              Vision Travel Hub
            </span>
          </div>

          <h2 className="text-slate-800 font-semibold text-2xl mb-8">Login</h2>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                {error}
              </div>
            )}
            <div className="mb-6">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-3 bg-transparent border-0 border-b border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-0 transition-colors"
                placeholder="Email"
                required
              />
            </div>
            <div className="mb-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-3 bg-transparent border-0 border-b border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-0 transition-colors"
                placeholder="Password"
                required
              />
            </div>
            <br />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium uppercase tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>

        {/* Right panel - Welcome */}
        <div className="w-full md:w-[58%] bg-gradient-to-b from-indigo-700 via-indigo-600 to-blue-500 relative p-8 md:p-10 flex flex-col justify-center">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative z-10">
            <h1 className="text-white text-2xl md:text-3xl font-bold mb-4">
              Welcome to Vision Travel Hub
            </h1>
            <p className="text-white/90 text-sm md:text-base leading-relaxed max-w-sm">
              Manage travel packages, bookings, and users in one place. Sign in
              to access your dashboard.
            </p>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5">
            <span className="w-8 h-0.5 bg-white/80 rounded" />
            <span className="w-8 h-0.5 bg-white/40 rounded" />
            <span className="w-8 h-0.5 bg-white/40 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

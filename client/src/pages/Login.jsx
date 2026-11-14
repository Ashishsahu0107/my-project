import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { login, setPendingVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!emailOrUsername.trim()) {
      setFormError('Please enter your email or username');
      return;
    }
    if (!password) {
      setFormError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(emailOrUsername.trim(), password);
      const destination = location.state?.from?.pathname || '/chat';
      navigate(destination, { replace: true });
    } catch (err) {
      if (err.requiresVerification) {
        setPendingVerificationEmail(err.email || emailOrUsername.trim());
        navigate('/verify-otp', {
          state: {
            email: err.email || emailOrUsername.trim(),
            info: 'Please enter the verification code sent to your email.'
          }
        });
        return;
      }
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmailOrUsername('alex@example.com');
    setPassword('Password123!');
    setFormError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-600/15 rounded-full blur-[130px] pointer-events-none -z-0" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none -z-0" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 p-0.5 shadow-xl shadow-brand-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-brand-400" />
            </div>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to continue real-time conversations
          </p>
        </div>

        {/* Auth card */}
        <div className="glass-card rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-800">
          {formError && (
            <div className="mb-5 flex items-start space-x-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username or Email field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="name@example.com or username"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-brand-600 focus:ring-brand-500 focus:ring-offset-slate-950"
                />
                <span className="text-xs text-slate-400">Remember session</span>
              </label>
              <div className="flex items-center space-x-1 text-slate-500 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>JWT Encrypted</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in to Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill button */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={fillDemoAccount}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 bg-slate-900/60 border border-slate-800 hover:text-brand-300 hover:border-brand-500/40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Click to auto-fill demo credentials</span>
            </button>
          </div>

          {/* Footer link to Register */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Don't have an account yet?{' '}
            <Link
              to="/register"
              className="font-semibold text-brand-400 hover:text-brand-300 transition-colors"
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

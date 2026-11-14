import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  KeyRound,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(cleanEmail);
      setSubmitted(true);

      // Smooth transition to Reset Password after brief delay or user click
      setTimeout(() => {
        navigate('/reset-password', {
          state: {
            email: cleanEmail,
            devOtp: res.data?.devOtp,
            message: 'Password reset code has been dispatched to your email.'
          }
        });
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to dispatch reset code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/15 rounded-full blur-[130px] pointer-events-none -z-0" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 p-0.5 shadow-xl shadow-brand-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-brand-400" />
            </div>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Enter your email and we'll send you a 6-digit security code
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-800">
          {submitted ? (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Reset Code Dispatched!</h3>
              <p className="text-sm text-slate-400">
                If an account exists for <span className="text-white font-mono">{email}</span>, you will receive an OTP code shortly.
              </p>
              <p className="text-xs text-brand-400 animate-pulse">
                Redirecting to verification...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 flex items-start space-x-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                  <div className="flex-1 font-medium">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Account Email
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="h-5 w-5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending reset code...
                    </>
                  ) : (
                    <>
                      Send Reset Code
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

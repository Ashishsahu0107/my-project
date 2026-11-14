import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const VerifyOtp = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOTP, resendOTP, pendingVerificationEmail } = useAuth();

  const email = location.state?.email || pendingVerificationEmail || '';
  const devOtp = location.state?.devOtp || '';
  const infoMessage = location.state?.message || location.state?.info || '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(infoMessage);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef([]);

  // Auto-redirect if no email
  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  // Resend timer countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleDigitChange = (index, value) => {
    // Only accept numeric digit
    const cleaned = value.replace(/[^0-9]/g, '');
    const newDigits = [...digits];

    if (cleaned.length > 1) {
      // Handle paste within single input
      handlePasteString(cleaned);
      return;
    }

    newDigits[index] = cleaned;
    setDigits(newDigits);
    setError('');

    // Advance focus to next input
    if (cleaned && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePasteString = (pasted) => {
    const numbers = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (!numbers) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = numbers[i] || '';
    }
    setDigits(newDigits);

    const focusIdx = Math.min(numbers.length, 5);
    if (inputRefs.current[focusIdx]) {
      inputRefs.current[focusIdx].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    handlePasteString(pasted);
  };

  const autoFillCode = (code) => {
    if (!code) return;
    handlePasteString(code);
    setError('');
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setError('');
    const fullOtp = digits.join('');

    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of your verification code');
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(email, fullOtp);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      const res = await resendOTP(email);
      setCountdown(60);
      setSuccessMsg('A new verification code has been dispatched to your email.');
      if (res.data?.devOtp) {
        autoFillCode(res.data.devOtp);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
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
              <ShieldCheck className="w-7 h-7 text-brand-400" />
            </div>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Verify your email
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            We sent a 6-digit confirmation code to
          </p>
          <div className="mt-1 inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-mono font-medium">
            <Mail className="w-3.5 h-3.5 mr-1" />
            <span>{email}</span>
          </div>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-800">
          {successMsg && (
            <div className="mb-5 flex items-start space-x-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start space-x-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            {/* 6 Digit Inputs */}
            <div>
              <label className="block text-center text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
                Enter 6-Digit Security Code
              </label>
              <div className="flex justify-between gap-2 sm:gap-2.5" onPaste={handlePaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 sm:w-13 sm:h-16 text-center text-2xl font-bold font-mono bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-inner transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Quick dev OTP auto-fill button */}
            {devOtp && (
              <div className="p-3 rounded-xl bg-brand-950/40 border border-brand-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-brand-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Dev Code: <strong className="font-mono text-white">{devOtp}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => autoFillCode(devOtp)}
                  className="px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || digits.join('').length !== 6}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying code...
                </>
              ) : (
                <>
                  Verify & Enter ChatApp
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Resend OTP & Links */}
          <div className="mt-6 flex flex-col items-center space-y-3 pt-5 border-t border-slate-800 text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span>Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || resending}
                className="font-semibold text-brand-400 hover:text-brand-300 disabled:opacity-40 disabled:hover:text-brand-400 transition-colors"
              >
                {resending ? (
                  <span className="flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Sending...
                  </span>
                ) : countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  'Resend code'
                )}
              </button>
            </div>

            <Link
              to="/login"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              Wrong email address? Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../api/authService';
import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(REFRESH_TOKEN_KEY) || null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [error, setError] = useState(null);

  // Restore authenticated session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getMe();
        setUser(currentUser);
        setAccessToken(storedToken);
      } catch (err) {
        console.warn('Session verification failed, logging out:', err.message);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen to token expiration logout event
    const handleGlobalLogout = () => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    };

    window.addEventListener('chatapp:logout', handleGlobalLogout);
    return () => window.removeEventListener('chatapp:logout', handleGlobalLogout);
  }, []);

  // Login handler
  const login = async (emailOrUsername, password) => {
    setError(null);
    try {
      const result = await authService.login({ emailOrUsername, password });
      const { user: loggedInUser, accessToken: newAccess, refreshToken: newRefresh } = result.data;
      setUser(loggedInUser);
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
      return result;
    } catch (err) {
      setError(err.message);
      if (err.requiresVerification) {
        setPendingVerificationEmail(err.email || emailOrUsername);
      }
      throw err;
    }
  };

  // Register handler
  const register = async (userData) => {
    setError(null);
    try {
      const result = await authService.register(userData);
      setPendingVerificationEmail(userData.email);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // OTP Verification handler
  const verifyOTP = async (email, otp) => {
    setError(null);
    try {
      const result = await authService.verifyOTP({ email, otp });
      const { user: verifiedUser, accessToken: newAccess, refreshToken: newRefresh } = result.data;
      setUser(verifiedUser);
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
      setPendingVerificationEmail('');
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Resend OTP handler
  const resendOTP = async (email) => {
    setError(null);
    try {
      return await authService.resendOTP({ email });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Forgot password
  const forgotPassword = async (email) => {
    setError(null);
    try {
      return await authService.forgotPassword({ email });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Reset password
  const resetPassword = async (email, otp, newPassword) => {
    setError(null);
    try {
      const result = await authService.resetPassword({ email, otp, newPassword });
      const { user: resetUser, accessToken: newAccess, refreshToken: newRefresh } = result.data;
      setUser(resetUser);
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Update profile
  const updateProfile = async (updates) => {
    setError(null);
    try {
      const updatedUser = await authService.updateProfile(updates);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setPendingVerificationEmail('');
    }
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    error,
    clearError: () => setError(null),
    login,
    register,
    verifyOTP,
    resendOTP,
    forgotPassword,
    resetPassword,
    updateProfile,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

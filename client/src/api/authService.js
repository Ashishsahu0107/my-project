import { apiClient, TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from './apiClient';

// Helper for offline / preview demo persistence
const DEMO_USERS_KEY = 'chatapp_demo_users';
const DEMO_OTP_KEY = 'chatapp_demo_otp';

const getDemoUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS_KEY)) || [
      {
        id: 'demo_user_1',
        username: 'alex_demo',
        email: 'alex@example.com',
        password: 'Password123!',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
        status: 'online',
        statusMessage: 'Building real-time apps 🚀',
        isVerified: true
      }
    ];
  } catch {
    return [];
  }
};

const saveDemoUsers = (users) => {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
};

export const authService = {
  // 1. User Registration
  register: async (userData) => {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      if (!error.response) {
        // Fallback for static web preview without live backend
        const users = getDemoUsers();
        const existing = users.find(
          (u) =>
            u.email.toLowerCase() === userData.email.toLowerCase() ||
            u.username.toLowerCase() === userData.username.toLowerCase()
        );
        if (existing && existing.isVerified) {
          throw new Error('User with this email or username already exists');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const newUser = {
          id: 'user_' + Date.now(),
          username: userData.username.toLowerCase().trim(),
          email: userData.email.toLowerCase().trim(),
          password: userData.password,
          avatar: userData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.username}`,
          status: 'online',
          isVerified: false
        };

        const updatedUsers = users.filter((u) => u.email !== newUser.email);
        updatedUsers.push(newUser);
        saveDemoUsers(updatedUsers);

        localStorage.setItem(
          DEMO_OTP_KEY + '_' + newUser.email,
          JSON.stringify({ otp, expiresAt: Date.now() + 10 * 60 * 1000 })
        );

        return {
          status: 'success',
          message: 'Registration successful! Verification code sent to email.',
          data: {
            email: newUser.email,
            username: newUser.username,
            isVerified: false,
            devOtp: otp
          }
        };
      }
      throw new Error(error.response.data?.message || 'Registration failed');
    }
  },

  // 2. Verify Email OTP
  verifyOTP: async ({ email, otp }) => {
    try {
      const response = await apiClient.post('/auth/verify-otp', { email, otp });
      const { user, accessToken, refreshToken } = response.data.data;
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      return response.data;
    } catch (error) {
      if (!error.response) {
        // Demo fallback
        const saved = JSON.parse(localStorage.getItem(DEMO_OTP_KEY + '_' + email.toLowerCase()));
        if (!saved || saved.otp !== otp.trim()) {
          throw new Error('Invalid verification code');
        }

        const users = getDemoUsers();
        const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) throw new Error('User not found');

        user.isVerified = true;
        saveDemoUsers(users);

        const accessToken = 'demo_access_token_' + Date.now();
        const refreshToken = 'demo_refresh_token_' + Date.now();
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        return {
          status: 'success',
          data: { user, accessToken, refreshToken }
        };
      }
      throw new Error(error.response.data?.message || 'Verification failed');
    }
  },

  // 3. Resend OTP
  resendOTP: async ({ email }) => {
    try {
      const response = await apiClient.post('/auth/resend-otp', { email });
      return response.data;
    } catch (error) {
      if (!error.response) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem(
          DEMO_OTP_KEY + '_' + email.toLowerCase(),
          JSON.stringify({ otp, expiresAt: Date.now() + 10 * 60 * 1000 })
        );
        return {
          status: 'success',
          message: 'Fresh verification code dispatched to email',
          data: { devOtp: otp }
        };
      }
      throw new Error(error.response.data?.message || 'Failed to resend verification code');
    }
  },

  // 4. User Login
  login: async ({ emailOrUsername, password }) => {
    try {
      const response = await apiClient.post('/auth/login', {
        emailOrUsername,
        password
      });

      const { user, accessToken, refreshToken } = response.data.data;
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

      return response.data;
    } catch (error) {
      if (error.response?.data?.requiresVerification) {
        const customErr = new Error(error.response.data.message);
        customErr.requiresVerification = true;
        customErr.email = error.response.data.email;
        throw customErr;
      }

      if (!error.response) {
        // Demo fallback
        const users = getDemoUsers();
        const q = emailOrUsername.toLowerCase().trim();
        const user = users.find((u) => u.email === q || u.username === q);

        if (!user || user.password !== password) {
          throw new Error('Invalid username/email or password');
        }

        if (!user.isVerified) {
          const customErr = new Error('Please verify your email address to continue.');
          customErr.requiresVerification = true;
          customErr.email = user.email;
          throw customErr;
        }

        const accessToken = 'demo_access_token_' + Date.now();
        const refreshToken = 'demo_refresh_token_' + Date.now();
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        return {
          status: 'success',
          data: { user, accessToken, refreshToken }
        };
      }
      throw new Error(error.response.data?.message || 'Login failed');
    }
  },

  // 5. Forgot Password
  forgotPassword: async ({ email }) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      if (!error.response) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem(
          DEMO_OTP_KEY + '_reset_' + email.toLowerCase(),
          JSON.stringify({ otp, expiresAt: Date.now() + 10 * 60 * 1000 })
        );
        return {
          status: 'success',
          message: 'Password reset code has been sent to your email',
          data: { email, devOtp: otp }
        };
      }
      throw new Error(error.response.data?.message || 'Failed to request password reset');
    }
  },

  // 6. Reset Password
  resetPassword: async ({ email, otp, newPassword }) => {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        email,
        otp,
        newPassword
      });
      const { user, accessToken, refreshToken } = response.data.data;
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      return response.data;
    } catch (error) {
      if (!error.response) {
        const saved = JSON.parse(localStorage.getItem(DEMO_OTP_KEY + '_reset_' + email.toLowerCase()));
        if (!saved || saved.otp !== otp.trim()) {
          throw new Error('Invalid reset verification code');
        }

        const users = getDemoUsers();
        const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) throw new Error('User not found');

        user.password = newPassword;
        user.isVerified = true;
        saveDemoUsers(users);

        const accessToken = 'demo_access_token_' + Date.now();
        const refreshToken = 'demo_refresh_token_' + Date.now();
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        return {
          status: 'success',
          data: { user, accessToken, refreshToken }
        };
      }
      throw new Error(error.response.data?.message || 'Failed to reset password');
    }
  },

  // 7. Get Current User Profile (Persistent Session check)
  getMe: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      const user = response.data.data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      if (!error.response) {
        const cached = localStorage.getItem(USER_KEY);
        if (cached) return JSON.parse(cached);
      }
      throw error;
    }
  },

  // 8. Update Profile
  updateProfile: async (updates) => {
    try {
      const response = await apiClient.put('/auth/profile', updates);
      const user = response.data.data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      if (!error.response) {
        const cached = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
        const updated = { ...cached, ...updates };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      }
      throw new Error(error.response.data?.message || 'Failed to update profile');
    }
  },

  // 9. Logout
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      // Continue cleanup regardless
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
};

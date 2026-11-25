import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const TOKEN_KEY = 'chatapp_access_token';
export const REFRESH_TOKEN_KEY = 'chatapp_refresh_token';
export const USER_KEY = 'chatapp_user';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

function resolveApiUrl() {
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  if (expoHost) return `http://${expoHost}:5000`;
  return 'http://10.0.2.2:5000';
}

export const API_URL = resolveApiUrl();

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw error;

      try {
        const response = await axios.post(`${API_URL}/api/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: rotatedRefresh } = response.data.data;
        await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
        if (rotatedRefresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, rotatedRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
        throw refreshError;
      }
    }
    throw error;
  }
);

export function getApiErrorMessage(error: any, fallback = 'Something went wrong') {
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED') return 'The server took too long to respond';
    return 'Cannot reach the server. Check Wi-Fi and backend status.';
  }
  return error.response.data?.message || fallback;
}

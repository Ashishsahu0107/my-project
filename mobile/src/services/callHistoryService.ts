import { api } from '../api/client';

export interface CallRecord {
  _id: string;
  callId: string;
  caller: { _id: string; username: string; avatar?: string };
  callee: { _id: string; username: string; avatar?: string };
  type: 'audio' | 'video';
  status: 'initiated' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'busy' | 'failed';
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;
  endReason?: string;
  createdAt: string;
}

export async function getCallHistory(page = 1, limit = 20): Promise<{ calls: CallRecord[]; total: number; page: number }> {
  const response = await api.get(`/calls/history?page=${page}&limit=${limit}`);
  return response.data.data;
}

export async function getCallStats(): Promise<{ totalCalls: number; missedCalls: number; totalDuration: number }> {
  const response = await api.get('/calls/stats');
  return response.data.data;
}

export function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

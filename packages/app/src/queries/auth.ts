import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { RegisterInput, LoginInput, AuthResponse, ApiResponse } from '@peerdeliver/shared';

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/register', input);
      return data.data!;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
    },
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/login', input);
      return data.data!;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      clearAuth();
    },
  });
}

import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '@peerdeliver/shared';

type VerifyType = 'phone' | 'id' | 'plate';

/** Verify a single trust signal; updates the cached user on success. */
export function useVerify() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation<User, Error, { type: VerifyType; value?: string }>({
    mutationFn: async (vars) => {
      const { data } = await api.post('/users/verification', vars);
      return data.data;
    },
    onSuccess: (user) => setUser(user),
  });
}

/** Dev-only: fully verify the current user. */
export function useDevVerifyAll() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation<User, Error, void>({
    mutationFn: async () => {
      const { data } = await api.post('/users/verification/dev-verify-all');
      return data.data;
    },
    onSuccess: (user) => setUser(user),
  });
}

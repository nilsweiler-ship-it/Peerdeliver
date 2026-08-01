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

/**
 * Step 1 of phone verification: ask the server to text a code.
 * Returns the number normalised to E.164 — send that exact value back in
 * step 2, otherwise Twilio won't find the pending verification.
 */
export function useStartPhoneVerification() {
  return useMutation<{ phone: string; simulated: boolean }, Error, { phone: string; language?: string }>({
    mutationFn: async (vars) => {
      const { data } = await api.post('/users/verification/phone/start', vars);
      return data.data;
    },
  });
}

/** Step 2: submit the code from the SMS. */
export function useCheckPhoneVerification() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation<User, Error, { phone: string; code: string }>({
    mutationFn: async (vars) => {
      const { data } = await api.post('/users/verification/phone/check', vars);
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

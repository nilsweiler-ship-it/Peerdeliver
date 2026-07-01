import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DeliveryRequest } from '@peerdeliver/shared';

/** Sender confirms a (simulated) TWINT payment for a delivery. */
export function useTwintPay() {
  const qc = useQueryClient();
  return useMutation<DeliveryRequest, Error, { deliveryRequestId: string; phone?: string }>({
    mutationFn: async (vars) => {
      const { data } = await api.post('/payments/twint/pay', vars);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

interface ConnectStatus {
  onboarded: boolean;
  payoutsEnabled: boolean;
  simulated?: boolean;
}

/** Driver payout-onboarding status. In simulated mode this returns onboarded:true. */
export function useConnectStatus() {
  return useQuery<ConnectStatus>({
    queryKey: ['connect-status'],
    queryFn: async () => {
      const { data } = await api.get('/payments/connect/status');
      return data.data;
    },
  });
}

export function useStartConnectOnboarding() {
  return useMutation<{ url: string }, Error, { refreshUrl?: string; returnUrl?: string } | void>({
    mutationFn: async (vars) => {
      const { data } = await api.post('/payments/connect/onboarding', vars ?? {});
      return data.data;
    },
  });
}

export function useDevCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/payments/connect/dev-complete');
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connect-status'] });
    },
  });
}

interface EarningsResponse {
  pending: number;
  deliveries: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    budgetCHF: number;
    platformFeeCHF: number | null;
    driverPayoutCHF: number | null;
    updatedAt: string;
  }>;
}

export function useEarnings() {
  return useQuery<EarningsResponse>({
    queryKey: ['earnings'],
    queryFn: async () => {
      const { data } = await api.get('/payments/earnings');
      return data.data;
    },
  });
}

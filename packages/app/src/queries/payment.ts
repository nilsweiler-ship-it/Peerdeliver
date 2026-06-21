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

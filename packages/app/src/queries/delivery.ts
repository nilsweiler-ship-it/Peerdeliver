import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DeliveryRequest, ApiResponse, CreateDeliveryInput } from '@peerdeliver/shared';

export function useMyDeliveries() {
  return useQuery({
    queryKey: ['deliveries', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DeliveryRequest[]>>('/deliveries/mine');
      return data.data!;
    },
    // Keep the list live: a delivery's status changes on the *other* party's
    // device (driver advances pending→…→in_transit→delivered), so without this
    // the sender's screen shows stale data until a manual pull-to-refresh.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });
}

export function useDelivery(id: string) {
  return useQuery({
    queryKey: ['deliveries', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DeliveryRequest>>(`/deliveries/${id}`);
      return data.data!;
    },
    enabled: !!id,
  });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDeliveryInput) => {
      const { data } = await api.post<ApiResponse<DeliveryRequest>>('/deliveries', input);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useNearbyDeliveries(params: { lat: number; lng: number; radius?: number }) {
  return useQuery({
    queryKey: ['deliveries', 'nearby', params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DeliveryRequest[]>>('/deliveries/nearby', {
        params: { lat: params.lat, lng: params.lng, radius: params.radius || 50 },
      });
      return data.data!;
    },
    enabled: !!params.lat && !!params.lng,
  });
}

export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, cancelReason }: { id: string; status: string; cancelReason?: string }) => {
      const { data } = await api.patch<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/status`, {
        status,
        cancelReason,
      });
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useAssignDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/assign`);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useConfirmDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/confirm`);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useRejectDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/reject`);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

/**
 * Sender offers a delivery to one driver's published route.
 *
 * The mirror of useAssignDelivery. Until this existed the sender could find a
 * matching route but had no way to act on it.
 */
export function useOfferRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, routeId }: { deliveryId: string; routeId: string }) => {
      const { data } = await api.post<ApiResponse<DeliveryRequest>>(
        `/deliveries/${deliveryId}/offer`,
        { routeId },
      );
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

/** The offered driver accepts — goes straight to matched. */
export function useAcceptOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/offer/accept`);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

/** The offered driver declines — the delivery returns to the open pool. */
export function useDeclineOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/offer/decline`);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useVerifyPickup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) => {
      const { data } = await api.post<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/verify-pickup`, { code });
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useVerifyDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) => {
      const { data } = await api.post<ApiResponse<DeliveryRequest>>(`/deliveries/${id}/verify-delivery`, { code });
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
}

export function useDriverInfo(deliveryId: string) {
  return useQuery({
    queryKey: ['deliveries', deliveryId, 'driver'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<any>>(`/deliveries/${deliveryId}/driver`);
      return data.data!;
    },
    enabled: !!deliveryId,
  });
}

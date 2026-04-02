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

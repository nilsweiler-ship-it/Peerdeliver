import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DriverRoute, ApiResponse, CreateRouteInput } from '@peerdeliver/shared';

export function useMyRoutes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['routes', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DriverRoute[]>>('/routes/mine');
      return data.data!;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useRoute(id: string) {
  return useQuery({
    queryKey: ['routes', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DriverRoute>>(`/routes/${id}`);
      return data.data!;
    },
    enabled: !!id,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      const { data } = await api.post<ApiResponse<DriverRoute>>('/routes', input);
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}

export function useSearchRoutes(params: {
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
}) {
  return useQuery({
    queryKey: ['routes', 'search', params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DriverRoute[]>>('/routes/search', { params });
      // Say what came back, and for which corridor. A search that returns
      // nothing and a search that failed look identical on screen, and the
      // server-side check says this corridor has three routes — so knowing
      // which of the two happened is the whole question.
      if (__DEV__) {
        console.log(
          `[search] routes for ${params.fromLat?.toFixed(4)},${params.fromLng?.toFixed(4)} → ` +
            `${params.toLat?.toFixed(4)},${params.toLng?.toFixed(4)}: ${data.data?.length ?? 0} result(s)`,
        );
      }
      return data.data!;
    },
    enabled: !!params.fromLat && !!params.fromLng && !!params.toLat && !!params.toLng,
  });
}

export function useToggleRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data } = await api.patch<ApiResponse<DriverRoute>>(`/routes/${id}/active`, {
        isActive,
      });
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/routes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}

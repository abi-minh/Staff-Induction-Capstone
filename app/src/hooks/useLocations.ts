import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLocations, fetchLocation, createLocation, updateLocation, deleteLocation,
} from '../api/locations';
import type { LocationFormValues } from '../types';

// 'publish' is the staff portal's view; 'any' is the admin list, which also
// needs drafts.
export function useLocations(status: 'publish' | 'any' = 'publish') {
  return useQuery({
    queryKey: ['locations', status],
    queryFn: () => fetchLocations(status),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLocation(id: number) {
  return useQuery({
    queryKey: ['location', id],
    queryFn: () => fetchLocation(id),
    enabled: id > 0,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<LocationFormValues>) => createLocation(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<LocationFormValues> }) =>
      updateLocation(id, values),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      qc.invalidateQueries({ queryKey: ['location', variables.id] });
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteLocation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}

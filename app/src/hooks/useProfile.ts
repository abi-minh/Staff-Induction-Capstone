import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyProfile, updateMyProfile, uploadProfilePhoto } from '../api/profile';
import type { ProfileUpdate } from '../api/profile';

export function useMyProfile() {
  return useQuery({ queryKey: ['myProfile'], queryFn: fetchMyProfile, staleTime: 0 });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => updateMyProfile(update),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      // A name or photo change shows up on the team page and in the admin
      // staff list, so those caches are stale too.
      qc.invalidateQueries({ queryKey: ['team'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useUploadProfilePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, userId }: { file: File; userId?: number }) =>
      uploadProfilePhoto(file, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      qc.invalidateQueries({ queryKey: ['team'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

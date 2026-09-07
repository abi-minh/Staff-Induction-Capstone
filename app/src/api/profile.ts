import client from './client';

// A staff member's own profile. Personal details plus the wording of their
// Meet Our Team card — everything they're allowed to change themselves.
// Visibility on the team page and the Owner flag stay admin-only, so they are
// read here but never written.
export interface MyProfile {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  suburb: string;
  address: string;
  photoUrl: string;
  cardTitle: string;
  cardRegion: string;
  cardBio: string;
  onTeamPage: boolean;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  dob?: string;
  suburb?: string;
  address?: string;
  cardTitle?: string;
  cardRegion?: string;
  cardBio?: string;
  /** 0 clears the photo; omit to leave it alone. */
  photoMediaId?: number;
}

interface WPProfile {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  dob?: string;
  suburb?: string;
  address?: string;
  profile_photo_url?: string;
  team_title?: string;
  team_region?: string;
  team_bio?: string;
  team_visible?: boolean;
}

function normalise(wp: WPProfile): MyProfile {
  return {
    id: wp.id,
    name: wp.name ?? '',
    firstName: wp.first_name ?? '',
    lastName: wp.last_name ?? '',
    email: wp.email ?? '',
    dob: wp.dob ?? '',
    suburb: wp.suburb ?? '',
    address: wp.address ?? '',
    photoUrl: wp.profile_photo_url ?? '',
    cardTitle: wp.team_title ?? '',
    cardRegion: wp.team_region ?? '',
    cardBio: wp.team_bio ?? '',
    onTeamPage: wp.team_visible ?? false,
  };
}

function toPayload(update: ProfileUpdate) {
  return {
    ...(update.firstName !== undefined && { first_name: update.firstName }),
    ...(update.lastName !== undefined && { last_name: update.lastName }),
    ...(update.email !== undefined && { email: update.email }),
    ...(update.dob !== undefined && { dob: update.dob }),
    ...(update.suburb !== undefined && { suburb: update.suburb }),
    ...(update.address !== undefined && { address: update.address }),
    ...(update.cardTitle !== undefined && { title: update.cardTitle }),
    ...(update.cardRegion !== undefined && { region: update.cardRegion }),
    ...(update.cardBio !== undefined && { bio: update.cardBio }),
    ...(update.photoMediaId !== undefined && { profile_photo_media_id: update.photoMediaId }),
  };
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const { data } = await client.get<WPProfile>('induction/v1/me/profile');
  return normalise(data);
}

export async function updateMyProfile(update: ProfileUpdate): Promise<MyProfile> {
  const { data } = await client.post<WPProfile>('induction/v1/me/profile', toPayload(update));
  return normalise(data);
}

// Photos go through the plugin's own endpoint, not wp/v2/media: the staff role
// has no upload_files capability, and granting it would let staff write
// anything into the shared media library.
export async function uploadProfilePhoto(
  file: File,
  userId?: number,
): Promise<{ mediaId: number; url: string }> {
  const form = new FormData();
  form.append('file', file);
  if (userId) form.append('user_id', String(userId));

  const { data } = await client.post<{ media_id: number; url: string }>(
    'induction/v1/me/profile/photo',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return { mediaId: data.media_id, url: data.url };
}

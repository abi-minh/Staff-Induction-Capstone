import { useEffect, useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, Paper, TextField, Typography,
} from '@mui/material';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useMyProfile, useUpdateMyProfile, useUploadProfilePhoto } from '../../hooks/useProfile';
import type { ProfileUpdate } from '../../api/profile';

const CARD_BIO_MAX_LENGTH = 280;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  suburb: string;
  address: string;
  cardTitle: string;
  cardRegion: string;
  cardBio: string;
}

const EMPTY: FormState = {
  firstName: '', lastName: '', email: '', dob: '', suburb: '', address: '',
  cardTitle: '', cardRegion: '', cardBio: '',
};

export default function AccountSettingsPage() {
  const { data: profile, isLoading, error } = useMyProfile();
  const save = useUpdateMyProfile();
  const uploadPhoto = useUploadProfilePhoto();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      dob: profile.dob,
      suburb: profile.suburb,
      address: profile.address,
      cardTitle: profile.cardTitle,
      cardRegion: profile.cardRegion,
      cardBio: profile.cardBio,
    });
    setSaved(false);
  }, [profile]);

  function field<K extends keyof FormState>(key: K) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        setSaved(false);
      },
    };
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      await uploadPhoto.mutateAsync({ file });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'The photo could not be uploaded.');
    }
  }

  async function handleSave() {
    setSaveError('');
    setSaved(false);
    const update: ProfileUpdate = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      dob: form.dob,
      suburb: form.suburb,
      address: form.address,
      cardTitle: form.cardTitle,
      cardRegion: form.cardRegion,
      cardBio: form.cardBio,
    };
    try {
      await save.mutateAsync(update);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Your details could not be saved.');
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!profile) return <Alert severity="warning">Your profile could not be loaded.</Alert>;

  const initial = (form.firstName || profile.name || '?').charAt(0).toUpperCase();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 780 }}>
      <Box>
        <Typography variant="h1">Account settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Your details, and what appears on your Meet Our Team card.
        </Typography>
      </Box>

      {/* Photo */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h3" sx={{ mb: 0.5 }}>Photo</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Used on your account, in the staff list, and on your Meet Our Team card.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          <Avatar
            src={profile.photoUrl || undefined}
            sx={{ width: 104, height: 104, fontSize: 38, bgcolor: 'primary.main' }}
          >
            {initial}
          </Avatar>
          <Box>
            <Button
              variant="outlined"
              startIcon={uploadPhoto.isLoading ? <CircularProgress size={16} /> : <PhotoCameraOutlinedIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isLoading}
              sx={{ borderRadius: 999 }}
            >
              {profile.photoUrl ? 'Change photo' : 'Add a photo'}
            </Button>
            {profile.photoUrl && (
              <Button
                color="error"
                onClick={() => save.mutateAsync({ photoMediaId: 0 }).catch(() => {})}
                disabled={save.isLoading}
              >
                Remove
              </Button>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              JPG or PNG, up to 4MB.
            </Typography>
          </Box>
        </Box>
        <input ref={fileRef} type="file" hidden accept="image/*" onChange={handlePhoto} />
        {photoError && <Alert severity="error" sx={{ mt: 2 }}>{photoError}</Alert>}
      </Paper>

      {/* Personal details */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>Your details</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField label="First name" {...field('firstName')} sx={{ flex: 1, minWidth: 220 }} />
          <TextField label="Last name" {...field('lastName')} sx={{ flex: 1, minWidth: 220 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            label="Email"
            type="email"
            {...field('email')}
            sx={{ flex: 1, minWidth: 220 }}
            helperText="Used for training reminders and to sign in."
          />
          <TextField
            label="Date of birth"
            type="date"
            {...field('dob')}
            sx={{ flex: 1, minWidth: 220 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField label="Suburb" {...field('suburb')} sx={{ flex: 1, minWidth: 220 }} />
          <TextField label="Address" {...field('address')} sx={{ flex: 2, minWidth: 260 }} />
        </Box>
      </Paper>

      {/* Team card */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="h3">Your team card</Typography>
          <Chip
            size="small"
            label={profile.onTeamPage ? 'Showing on Meet Our Team' : 'Not shown yet'}
            color={profile.onTeamPage ? 'success' : 'default'}
            variant={profile.onTeamPage ? 'filled' : 'outlined'}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {profile.onTeamPage
            ? 'This is what colleagues see on the Meet Our Team page.'
            : 'An admin decides who appears on Meet Our Team. You can fill this in now and it will be ready when they do.'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            label="Job title"
            {...field('cardTitle')}
            placeholder="Senior Instructor"
            sx={{ flex: 1, minWidth: 220 }}
          />
          <TextField
            label="Region"
            {...field('cardRegion')}
            placeholder="Gold Coast"
            sx={{ flex: 1, minWidth: 220 }}
          />
        </Box>
        <TextField
          label="Short bio"
          value={form.cardBio}
          onChange={(e) => {
            setForm((f) => ({ ...f, cardBio: e.target.value.slice(0, CARD_BIO_MAX_LENGTH) }));
            setSaved(false);
          }}
          multiline
          minRows={3}
          fullWidth
          helperText={`${form.cardBio.length}/${CARD_BIO_MAX_LENGTH}`}
        />
      </Paper>

      <Divider />

      {saveError && <Alert severity="error">{saveError}</Alert>}
      {saved && <Alert severity="success">Your details have been saved.</Alert>}

      <Box>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          onClick={handleSave}
          disabled={save.isLoading}
          sx={{ borderRadius: 999 }}
        >
          {save.isLoading ? 'Saving…' : 'Save changes'}
        </Button>
      </Box>
    </Box>
  );
}

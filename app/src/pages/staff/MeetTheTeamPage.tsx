import {
  Avatar, Box, Card, CardContent, CircularProgress, Typography,
} from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { useTeamMembers } from '../../hooks/usePortal';
import type { TeamMember } from '../../types';

function SectionHeading({ children }: { children: string }) {
  return (
    <Typography
      variant="h3"
      component="h2"
      sx={{
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        mb: 3,
      }}
    >
      {children}
    </Typography>
  );
}

function Region({ region }: { region: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: 'text.secondary' }}>
      <PlaceOutlinedIcon sx={{ fontSize: 16 }} />
      <Typography variant="caption">{region}</Typography>
    </Box>
  );
}

// The owner gets a wide, two-column treatment rather than a grid card: photo and
// name on the left, title and bio on the right.
function OwnerPanel({ owner }: { owner: TeamMember }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        p: { xs: 3, md: 4 },
        borderRadius: 3,
        bgcolor: 'chipInfo.bg',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <Avatar
          src={owner.photoUrl || undefined}
          variant="rounded"
          sx={{ width: 220, height: 200, fontSize: 64, bgcolor: 'primary.main' }}
        >
          {owner.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VerifiedUserOutlinedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{owner.name}</Typography>
        </Box>
        {owner.region && <Region region={owner.region} />}
      </Box>

      <Box sx={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {owner.roleLabel && (
          <Typography variant="h3" component="p">{owner.roleLabel}</Typography>
        )}
        {owner.bio && (
          <Typography variant="body1" color="text.secondary">{owner.bio}</Typography>
        )}
      </Box>
    </Box>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1 }}>
        <Avatar
          src={member.photoUrl || undefined}
          sx={{ width: 96, height: 96, fontSize: 32, bgcolor: 'primary.main' }}
        >
          {member.name.charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="h4" component="h3" sx={{ mt: 1 }}>
          {member.name}
        </Typography>
        {member.roleLabel && (
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {member.roleLabel}
          </Typography>
        )}
        {member.region && <Region region={member.region} />}
        {member.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {member.bio}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function MeetTheTeamPage() {
  const { data: team, isLoading, error } = useTeamMembers();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Typography color="error">Error: {(error as Error).message}</Typography>;
  }

  // Exactly one owner is enforced server-side, but take the first match here
  // too so a stray second flag can never duplicate the featured panel.
  const owner = team?.find((m) => m.isOwner);
  const others = (team ?? []).filter((m) => m.id !== owner?.id);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h1">Meet our Team</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Get to know the people behind the business.
        </Typography>
      </Box>

      {!team || team.length === 0 ? (
        <Typography color="text.secondary">No team profiles have been published yet.</Typography>
      ) : (
        <>
          {owner && (
            <Box component="section">
              <SectionHeading>Meet our Owner</SectionHeading>
              <OwnerPanel owner={owner} />
            </Box>
          )}

          {others.length > 0 && (
            <Box component="section">
              {owner && <SectionHeading>Meet our Staff</SectionHeading>}
              <Box
                sx={{
                  display: 'grid',
                  gap: 3,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                }}
              >
                {others.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Collapse, IconButton, InputAdornment,
  LinearProgress, Link, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import { useReports } from '../hooks/useReports';
import { buildReportCsv } from '../util/reportCsv';
import type { ModuleCompletionReport, ProgressStatus } from '../types';

const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff',
  induction_admin: 'Induction Admin',
  administrator: 'Administrator',
};

function formatRoles(roles: string[]): string {
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(', ') || '-';
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  not_started: 'Not Started',
};

const STATUS_COLORS: Record<ProgressStatus, 'success' | 'warning' | 'default'> = {
  completed: 'success',
  in_progress: 'warning',
  not_started: 'default',
};

function moduleStatus(r: ModuleCompletionReport): { label: string; color: 'success' | 'warning' | 'default' } {
  if (r.totalAssigned === 0) return { label: 'No staff assigned', color: 'default' };
  if (r.totalCompleted === r.totalAssigned) return { label: 'Completed', color: 'success' };
  const anyProgress = r.staffBreakdown.some((s) => s.status !== 'not_started');
  return anyProgress ? { label: 'In Progress', color: 'warning' } : { label: 'Not Started', color: 'default' };
}

const headCellSx = {
  py: 2,
  fontWeight: 700,
  borderBottom: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  fontSize: '0.8rem',
};

function StatCard({ icon, iconBg, iconColor, label, value, sub }: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Paper
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: iconBg,
          color: iconColor,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.15 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </Box>
    </Paper>
  );
}

export default function ReportsPage() {
  const { data: reports, isLoading, error, refetch } = useReports();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = reports?.moduleReports ?? [];
    return needle ? list.filter((r) => r.moduleTitle.toLowerCase().includes(needle)) : list;
  }, [reports, search]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const csv = buildReportCsv(reports?.moduleReports ?? []);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'induction-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) {
    return (
      <Alert severity="error">
        Error: {(error as Error).message} <Button onClick={() => refetch()}>Retry</Button>
      </Alert>
    );
  }
  if (!reports) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '2rem' }}>Reports</Typography>
          <Typography color="text.secondary">Overview of module completion</Typography>
        </Box>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv} sx={{ borderRadius: 999 }}>
          Export CSV
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2.5, mb: 3 }}>
        <StatCard icon={<Inventory2OutlinedIcon />} iconBg="rgba(59, 130, 246, 0.12)" iconColor="#3b82f6" label="Total modules" value={reports.totalModules} sub="All training modules" />
        <StatCard icon={<GroupsOutlinedIcon />} iconBg="rgba(34, 197, 94, 0.12)" iconColor="#22c55e" label="Total staff" value={reports.totalStaff} sub="Active staff members" />
        <StatCard icon={<DonutLargeOutlinedIcon />} iconBg="rgba(168, 85, 247, 0.12)" iconColor="#a855f7" label="Overall completion" value={`${reports.overallCompletionPct}%`} sub="Across all modules" />
      </Box>

      <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Module Completion</Typography>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules..."
            size="small"
            sx={{ width: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <Box sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 44 }} />
                <TableCell sx={headCellSx}>Module</TableCell>
                <TableCell sx={headCellSx}>Staff who completed the module</TableCell>
                <TableCell sx={headCellSx}>Completion</TableCell>
                <TableCell sx={headCellSx}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => {
                const st = moduleStatus(r);
                const open = expanded.has(r.moduleId);
                return (
                  <Fragment key={r.moduleId}>
                    <TableRow hover sx={{ '& td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggle(r.moduleId)}>
                          {open ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{r.moduleTitle || '(Untitled)'}</TableCell>
                      <TableCell>{r.totalCompleted} / {r.totalAssigned}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 200 }}>
                          <LinearProgress
                            variant="determinate"
                            value={r.completionPct}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 999,
                              bgcolor: 'divider',
                              '& .MuiLinearProgress-bar': { bgcolor: 'success.main', borderRadius: 999 },
                            }}
                          />
                          <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'right' }}>{r.completionPct}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={st.label} color={st.color} size="small" variant="outlined" sx={{ borderRadius: 999, fontWeight: 500 }} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ p: 0, borderBottom: open ? '1px solid' : 'none', borderColor: 'divider' }}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                          <Box sx={{ bgcolor: 'grey.50', px: 3, py: 2 }}>
                            {r.staffBreakdown.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">No staff assigned to this module.</Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={headCellSx}>Staff Name</TableCell>
                                    <TableCell sx={headCellSx}>Role</TableCell>
                                    <TableCell sx={headCellSx}>Status</TableCell>
                                    <TableCell sx={headCellSx} align="right">Action</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {r.staffBreakdown.map((s) => (
                                    <TableRow key={s.userId}>
                                      <TableCell>{s.name}</TableCell>
                                      <TableCell>{formatRoles(s.roles)}</TableCell>
                                      <TableCell>
                                        <Chip label={STATUS_LABELS[s.status]} color={STATUS_COLORS[s.status]} size="small" variant="outlined" sx={{ borderRadius: 999 }} />
                                      </TableCell>
                                      <TableCell align="right">
                                        <Link component={RouterLink} to={`/staff/${s.userId}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                          <VisibilityOutlinedIcon sx={{ fontSize: 16 }} /> View
                                        </Link>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6 }}>
                    <Typography color="text.secondary">No modules match your search.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5, p: 2 }}>
          {filtered.map((r) => {
            const st = moduleStatus(r);
            const open = expanded.has(r.moduleId);
            return (
              <Paper key={r.moduleId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                    {r.moduleTitle || '(Untitled)'}
                  </Typography>
                  <Chip label={st.label} color={st.color} size="small" variant="outlined" sx={{ borderRadius: 999, fontWeight: 500 }} />
                </Box>

                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={r.completionPct}
                    sx={{ flex: 1, height: 8, borderRadius: 999, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: 'success.main', borderRadius: 999 } }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 74, textAlign: 'right' }}>
                    {r.totalCompleted}/{r.totalAssigned} · {r.completionPct}%
                  </Typography>
                </Box>

                <Button
                  size="small"
                  onClick={() => toggle(r.moduleId)}
                  endIcon={open ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                  sx={{ mt: 1 }}
                >
                  {open ? 'Hide staff' : 'View staff'}
                </Button>

                <Collapse in={open} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column' }}>
                    {r.staffBreakdown.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No staff assigned to this module.</Typography>
                    ) : (
                      r.staffBreakdown.map((s) => (
                        <Box key={s.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{s.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{formatRoles(s.roles)}</Typography>
                          </Box>
                          <Chip label={STATUS_LABELS[s.status]} color={STATUS_COLORS[s.status]} size="small" variant="outlined" sx={{ borderRadius: 999 }} />
                          <Link component={RouterLink} to={`/staff/${s.userId}`} sx={{ display: 'inline-flex', alignItems: 'center' }} aria-label={`View ${s.name}`}>
                            <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                          </Link>
                        </Box>
                      ))
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}

          {filtered.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No modules match your search.
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filtered.length} of {reports.moduleReports.length} modules
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

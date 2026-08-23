import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useStaff, useBulkAssign, useUnassign } from "../hooks/useStaff";
import { useModules } from "../hooks/useModules";
import { useReports } from "../hooks/useReports";
import type { ReportSummary } from "../types";

const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  induction_admin: "Induction Admin",
  administrator: "Administrator",
};

function formatRoles(roles: string[]): string {
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || "-";
}

type CompletionStatus = "completed" | "in_progress" | "not_started" | "none";

interface StaffCompletion {
  completed: number;
  total: number;
  status: CompletionStatus;
}

// Aggregate a single staff member's per-module statuses
// into one overall completion figure for the table row.
function staffCompletion(
  userId: number,
  moduleReports: ReportSummary["moduleReports"],
): StaffCompletion {
  const total = moduleReports.length;
  let completed = 0;
  let anyStarted = false;

  for (const report of moduleReports) {
    const entry = report.staffBreakdown.find((s) => s.userId === userId);
    if (entry?.status === "completed") {
      completed += 1;
    } else if (entry?.status === "in_progress") {
      anyStarted = true;
    }
  }

  let status: CompletionStatus;
  if (total === 0) status = "none";
  else if (completed === total) status = "completed";
  else if (completed > 0 || anyStarted) status = "in_progress";
  else status = "not_started";

  return { completed, total, status };
}

const STATUS_LABELS: Record<CompletionStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
  none: "-",
};

const STATUS_COLORS: Record<CompletionStatus, string> = {
  completed: "success.main",
  in_progress: "warning.main",
  not_started: "error.main",
  none: "text.secondary",
};

type SortKey = "name" | "role" | "email" | "completion";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "email", label: "Email" },
  { key: "completion", label: "Completion" },
];

// Sort key for the completion column: fraction complete, unassigned last.
function completionValue(c: StaffCompletion): number {
  return c.total > 0 ? c.completed / c.total : -1;
}

const STATUS_FILTERS: CompletionStatus[] = [
  "completed",
  "in_progress",
  "not_started",
];

export default function StaffPage() {
  const { data: staff = [], isLoading: staffLoading, error } = useStaff();
  const { data: modules = [], isLoading: modulesLoading } = useModules();
  const { data: reports } = useReports();
  const bulkAssign = useBulkAssign();
  const unassign = useUnassign();

  const [search, setSearch] = useState("");
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompletionStatus | "">("");

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => s.roles.forEach((r) => set.add(r)));
    return Array.from(set);
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return staff.filter((s) => {
      const matchesSearch = !needle || s.name.toLowerCase().includes(needle);
      const matchesRole = !roleFilter || s.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [staff, search, roleFilter]);

  const rows = useMemo(() => {
    const moduleReports = reports?.moduleReports ?? [];
    let withCompletion = filteredStaff.map((s) => ({
      staff: s,
      completion: staffCompletion(s.id, moduleReports),
    }));
    if (statusFilter) {
      withCompletion = withCompletion.filter(
        (r) => r.completion.status === statusFilter,
      );
    }
    if (!sortBy) return withCompletion;
    const factor = sortDir === "asc" ? 1 : -1;
    return [...withCompletion].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.staff.name.localeCompare(b.staff.name);
          break;
        case "role":
          cmp = formatRoles(a.staff.roles).localeCompare(formatRoles(b.staff.roles));
          break;
        case "email":
          cmp = (a.staff.email || "").localeCompare(b.staff.email || "");
          break;
        case "completion":
          cmp = completionValue(a.completion) - completionValue(b.completion);
          break;
      }
      return cmp * factor;
    });
  }, [filteredStaff, reports, statusFilter, sortBy, sortDir]);

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  function toggleModule(id: number) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function handleAssign() {
    if (!assigningUserId) return;
    await Promise.all(
      selectedModules.map((mid) =>
        bulkAssign.mutateAsync({
          moduleId: mid,
          userIds: [assigningUserId],
          dueDate: dueDate || undefined,
        }),
      ),
    );
    setAssigningUserId(null);
    setSelectedModules([]);
    setDueDate("");
  }

  async function handleUnassign(moduleId: number) {
    if (assigningUserId == null) return;
    await unassign.mutateAsync({ moduleId, userIds: [assigningUserId] });
  }

  const assignedModules =
    assigningUserId == null
      ? []
      : modules.filter((m) =>
          (m.meta.module_role_targets ?? []).includes(`user:${assigningUserId}`),
        );

  if (staffLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Alert severity="error">Error: {(error as Error).message}</Alert>;
  }

  return (
    <>
      <Box>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Staff
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff by name..."
            variant="outlined"
            size="small"
            sx={{
              width: { xs: "100%", sm: 320, md: 380 },
              "& .MuiOutlinedInput-root": { bgcolor: "background.paper" },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            select
            label="Role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            size="small"
            sx={{ minWidth: 180, bgcolor: "background.paper" }}
          >
            <MenuItem value="">All roles</MenuItem>
            {roleOptions.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as CompletionStatus | "")
            }
            size="small"
            sx={{ minWidth: 180, bgcolor: "background.paper" }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {STATUS_FILTERS.map((st) => (
              <MenuItem key={st} value={st}>
                {STATUS_LABELS[st]}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Paper
          sx={{
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                {SORT_COLUMNS.map((col) => (
                  <TableCell
                    key={col.key}
                    sortDirection={sortBy === col.key ? sortDir : false}
                    sx={{
                      py: 2.25,
                      fontWeight: 700,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <TableSortLabel
                      active={sortBy === col.key}
                      direction={sortBy === col.key ? sortDir : "asc"}
                      onClick={() => handleSort(col.key)}
                      sx={{
                        "& .MuiTableSortLabel-icon": {
                          opacity: sortBy === col.key ? 1 : 0.35,
                        },
                      }}
                    >
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    width: 160,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map(({ staff: s, completion }) => (
                  <TableRow
                    key={s.id}
                    hover
                    sx={{
                      "& td": {
                        py: 1.5,
                        fontSize: "1.02rem",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      },
                    }}
                  >
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.25,
                        }}
                      >
                        <Avatar
                          src={s.avatarUrl}
                          sx={{ width: 32, height: 32 }}
                        >
                          {s.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Link
                          component={RouterLink}
                          to={`/staff/${s.id}`}
                          sx={{ fontWeight: 500 }}
                        >
                          {s.name}
                        </Link>
                      </Box>
                    </TableCell>
                    <TableCell>{formatRoles(s.roles)}</TableCell>
                    <TableCell>{s.email || "-"}</TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          fontWeight: 500,
                          color: STATUS_COLORS[completion.status],
                        }}
                      >
                        {STATUS_LABELS[completion.status]}
                      </Typography>
                      {completion.total > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {completion.completed}/{completion.total} modules
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          component={RouterLink}
                          to={`/staff/${s.id}`}
                          size="small"
                          startIcon={<VisibilityOutlinedIcon />}
                          sx={{ color: "primary.main" }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setAssigningUserId(s.id);
                            setSelectedModules([]);
                          }}
                          sx={{ color: "text.secondary" }}
                        >
                          Assign
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
              ))}

              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      No staff match your search.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      {assigningUserId !== null && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h2" sx={{ mb: 1 }}>
            Assign modules to{" "}
            {staff.find((s) => s.id === assigningUserId)?.name}
          </Typography>
          {modulesLoading ? (
            <Typography>Loading modules…</Typography>
          ) : (
            <ul>
              {modules.map((m) => (
                <li key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                    />{" "}
                    {m.title || "(Untitled)"}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {assignedModules.length > 0 && (
            <Box sx={{ mt: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Currently assigned
              </Typography>
              <ul>
                {assignedModules.map((m) => (
                  <li key={m.id}>
                    {m.title || "(Untitled)"}{" "}
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleUnassign(m.id)}
                      disabled={unassign.isLoading}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </Box>
          )}
          <div>
            <label>Due date (optional) </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={selectedModules.length === 0 || bulkAssign.isLoading}
          >
            {bulkAssign.isLoading
              ? "Assigning…"
              : `Assign (${selectedModules.length})`}
          </Button>{" "}
          <Button onClick={() => setAssigningUserId(null)}>Cancel</Button>
        </Box>
      )}
    </>
  );
}

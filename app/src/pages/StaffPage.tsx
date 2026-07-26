import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  InputAdornment,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useStaff, useBulkAssign } from "../hooks/useStaff";
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

export default function StaffPage() {
  const { data: staff = [], isLoading: staffLoading, error } = useStaff();
  const { data: modules = [], isLoading: modulesLoading } = useModules();
  const { data: reports } = useReports();
  const bulkAssign = useBulkAssign();

  const [search, setSearch] = useState("");
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");

  const moduleReports = reports?.moduleReports ?? [];

  const filteredStaff = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(needle));
  }, [staff, search]);

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

        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search staff by name..."
          variant="outlined"
          size="small"
          sx={{
            width: { xs: "100%", sm: 420, md: 500 },
            mb: 3,
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
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Name
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Role
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Email
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Completion
                </TableCell>
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
              {filteredStaff.map((s) => {
                const completion = staffCompletion(s.id, moduleReports);

                return (
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
                      <Typography sx={{ fontWeight: 500 }}>
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
                );
              })}

              {!filteredStaff.length && (
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  useRoles,
  useStaff,
  useCreateStaffRole,
  useDeleteStaffRole,
  useAssignRole,
  useUnassignRole,
} from "../hooks/useStaff";
import { useModules } from "../hooks/useModules";

// Roles this page lists but must never offer to delete. "administrator" is
// WordPress's own and is only here because the induction app treats admins as
// induction admins — see induction_member_roles() in the plugin.
const BUILT_IN_ROLES = ["staff", "induction_admin", "administrator"];

export default function StaffRolesPage() {
  const navigate = useNavigate();
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: staff = [] } = useStaff();
  const { data: modules = [] } = useModules();
  const createStaffRole = useCreateStaffRole();
  const deleteStaffRole = useDeleteStaffRole();
  const assignRole = useAssignRole();
  const unassignRole = useUnassignRole();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [addError, setAddError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [assigningRole, setAssigningRole] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [moduleSearch, setModuleSearch] = useState("");
  const [assignError, setAssignError] = useState("");

  function openAdd() {
    setName("");
    setAddError("");
    setAddOpen(true);
  }

  async function handleCreate() {
    setAddError("");
    if (!name.trim()) {
      setAddError("Please enter a staff role name.");
      return;
    }
    try {
      await createStaffRole.mutateAsync(name.trim());
      setAddOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not create staff role.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    try {
      await deleteStaffRole.mutateAsync(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete staff role.");
    }
  }

  const assignedModuleIds =
    assigningRole === null
      ? []
      : modules
          .filter((m) => (m.meta.module_role_targets ?? []).includes(assigningRole))
          .map((m) => m.id);
  const isAssignDirty =
    selectedModules.length !== assignedModuleIds.length ||
    selectedModules.some((id) => !assignedModuleIds.includes(id));
  const filteredAssignModules = modules.filter((m) =>
    (m.title || "(Untitled)").toLowerCase().includes(moduleSearch.trim().toLowerCase())
  );

  function openAssign(role: string) {
    const currentlyAssigned = modules
      .filter((m) => (m.meta.module_role_targets ?? []).includes(role))
      .map((m) => m.id);
    setAssigningRole(role);
    setSelectedModules(currentlyAssigned);
    setModuleSearch("");
    setAssignError("");
  }

  function closeAssign() {
    setAssigningRole(null);
    setSelectedModules([]);
    setModuleSearch("");
    setAssignError("");
  }

  function toggleModule(id: number) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSaveAssignments() {
    if (!assigningRole) return;
    setAssignError("");
    const toAssign = selectedModules.filter((id) => !assignedModuleIds.includes(id));
    const toUnassign = assignedModuleIds.filter((id) => !selectedModules.includes(id));
    try {
      // Sequential, not parallel: each call reads-modifies-writes the same
      // module_role_targets meta field on its module, so concurrent calls
      // targeting different modules are fine, but we keep this simple and
      // safe by never having two writes in flight for this role at once.
      for (const moduleId of toAssign) {
        await assignRole.mutateAsync({ moduleId, role: assigningRole });
      }
      for (const moduleId of toUnassign) {
        await unassignRole.mutateAsync({ moduleId, role: assigningRole });
      }
      closeAssign();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not save module assignments.");
    }
  }

  const assigningRoleLabel = roles.find((r) => r.value === assigningRole)?.label ?? "";
  const savingAssignments = assignRole.isLoading || unassignRole.isLoading;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Typography variant="h1">Staff Roles</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
          sx={{ borderRadius: 999 }}
        >
          New Staff Role
        </Button>
      </Box>

      <Paper
        sx={{
          display: { xs: "none", md: "block" },
          overflow: "hidden",
          boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              {["Staff Role", "Staff Assigned", "Modules Required", "Actions"].map((label) => (
                <TableCell
                  key={label}
                  sx={{ py: 2.25, fontWeight: 700, borderBottom: "1px solid", borderColor: "divider" }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => {
              const isBuiltIn = BUILT_IN_ROLES.includes(role.value);
              const staffCount = staff.filter((s) => s.roles.includes(role.value)).length;
              const moduleCount = modules.filter((m) =>
                (m.meta.module_role_targets ?? []).includes(role.value)
              ).length;
              return (
                <TableRow
                  key={role.value}
                  hover
                  sx={{
                    "& td": { py: 1.5, fontSize: "1.02rem", borderBottom: "1px solid", borderColor: "divider" },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontWeight: 500 }}>{role.label}</Typography>
                      {isBuiltIn && (
                        <Chip label="Built-in" size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => navigate(`/staff?role=${role.value}`)}
                      sx={{ color: "text.secondary", minWidth: 0, px: 0.5 }}
                    >
                      {staffCount} staff
                    </Button>
                  </TableCell>
                  <TableCell>{moduleCount} module{moduleCount !== 1 ? "s" : ""}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => openAssign(role.value)}
                        sx={{ color: "primary.main" }}
                      >
                        Assign
                      </Button>
                      {isBuiltIn ? (
                        <Tooltip title="Built-in roles can't be deleted">
                          <span>
                            <IconButton size="small" disabled>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(role.value);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}

            {!rolesLoading && roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 6 }}>
                  <Typography color="text.secondary">No staff roles yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.5 }}>
        {roles.map((role) => {
          const isBuiltIn = BUILT_IN_ROLES.includes(role.value);
          const staffCount = staff.filter((s) => s.roles.includes(role.value)).length;
          const moduleCount = modules.filter((m) =>
            (m.meta.module_role_targets ?? []).includes(role.value)
          ).length;
          return (
            <Paper key={role.value} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                  {role.label}
                </Typography>
                {isBuiltIn && (
                  <Chip label="Built-in" size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem", flexShrink: 0 }} />
                )}
              </Box>
              <Box sx={{ mt: 1, display: "grid", gap: 0.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Staff assigned</Typography>
                  <Button
                    size="small"
                    onClick={() => navigate(`/staff?role=${role.value}`)}
                    sx={{ color: "text.secondary", minWidth: 0, px: 0.5 }}
                  >
                    {staffCount} staff
                  </Button>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Modules required</Typography>
                  <Typography variant="body2">{moduleCount} module{moduleCount !== 1 ? "s" : ""}</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => openAssign(role.value)}
                  sx={{ borderRadius: 999 }}
                >
                  Assign
                </Button>
                {isBuiltIn ? (
                  <Tooltip title="Built-in roles can't be deleted">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled
                        startIcon={<DeleteOutlineIcon fontSize="small" />}
                        sx={{ borderRadius: 999 }}
                      >
                        Delete
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    onClick={() => { setDeleteError(""); setDeleteTarget(role.value); }}
                    sx={{ borderRadius: 999 }}
                  >
                    Delete
                  </Button>
                )}
              </Box>
            </Paper>
          );
        })}

        {!rolesLoading && roles.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No staff roles yet.
          </Typography>
        )}
      </Box>

      {/* Create dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Staff Role</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {addError && <Alert severity="error">{addError}</Alert>}
          <TextField
            label="Staff Role Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fishing Instructor"
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAddOpen(false)} disabled={createStaffRole.isLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={createStaffRole.isLoading}>
            {createStaffRole.isLoading ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this staff role?</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography color="text.secondary">
            This can't be undone. If any staff member currently holds this staff role, deletion
            will be blocked until they're reassigned.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteStaffRole.isLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteStaffRole.isLoading}
          >
            {deleteStaffRole.isLoading ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign modules to role */}
      <Dialog open={assigningRole !== null} onClose={closeAssign} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Modules to {assigningRoleLabel}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {assignError && <Alert severity="error">{assignError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Every module checked here is required for anyone with this staff role — current
            holders and anyone assigned this role later. For a one-off module on a specific
            person, use that staff member's own Assign action instead.
          </Typography>
          <TextField
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            placeholder="Search modules..."
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "text.secondary" }} fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box
            sx={{
              maxHeight: 320,
              overflowY: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
            }}
          >
            {filteredAssignModules.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                No modules match your search.
              </Typography>
            ) : (
              filteredAssignModules.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pl: 1,
                    pr: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:last-of-type": { borderBottom: "none" },
                  }}
                >
                  <FormControlLabel
                    sx={{ flex: 1, minWidth: 0, mr: 0 }}
                    control={
                      <Checkbox
                        checked={selectedModules.includes(m.id)}
                        onChange={() => toggleModule(m.id)}
                      />
                    }
                    label={m.title || "(Untitled)"}
                  />
                </Box>
              ))
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeAssign}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveAssignments}
            disabled={!isAssignDirty || savingAssignments}
            sx={{ borderRadius: 999 }}
          >
            {savingAssignments ? "Saving…" : `Assign (${selectedModules.length})`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

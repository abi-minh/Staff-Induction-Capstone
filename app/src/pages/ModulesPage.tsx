import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { getIconByKey } from "../components/iconLibrary";
import { useDeleteModule, useModules, useReorderModules } from "../hooks/useModules";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { stripHtml } from "../util/strings";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { moveItem } from "../blocks/utils";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ModulesPage() {
  const navigate = useNavigate();
  const { data: modules = [], isLoading, error } = useModules();
  const deleteModule = useDeleteModule();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const reorder = useReorderModules();

  const [statusFilter, setStatusFilter] = useState<"all" | "publish" | "draft">(
    "all",
  );

  // Reordering is disabled while a search or status filter is active: "move
  // up" has no honest meaning when the row above is hidden, and renumbering
  // from a filtered list would reshuffle the modules not on screen.
  const isFiltered = search.trim() !== "" || statusFilter !== "all";

  function moveModule(index: number, direction: -1 | 1) {
    const next = moveItem(modules, index, index + direction);
    if (next === modules) return;
    reorder.mutate(next.map((m) => m.id));
  }

  const filteredModules = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return modules.filter((module) => {
      if (statusFilter !== "all" && module.status !== statusFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [
        stripHtml(module.title),
        module.status,
        formatDate(module.modified),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [modules, search, statusFilter]);

  async function handleDelete(id: number) {
    await deleteModule.mutateAsync(id);
    setConfirmDelete(null);
  }

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Alert severity="error">Error: {(error as Error).message}</Alert>;
  }

  return (
    <>
      <Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
            gap: 3,
            mb: 3.5,
          }}
        >
          <Box>
            <Typography variant="h1" sx={{ mb: 2 }}>
              Modules
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <TextField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search modules..."
                variant="outlined"
                size="small"
                sx={{
                  width: { xs: "100%", sm: 320, md: 380 },
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "background.paper",
                  },
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
                label="Status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | "publish" | "draft",
                  )
                }
                size="small"
                sx={{ minWidth: 180, "& .MuiOutlinedInput-root": { bgcolor: "background.paper" } }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="publish">Published</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </TextField>
            </Box>
          </Box>

          <Button
            onClick={() => navigate("/modules/new")}
            sx={{
              alignSelf: { xs: "flex-start", md: "center" },
              px: 0,
              minWidth: 120,
              borderRadius: 0,
              color: "text.primary",
              display: "flex",
              flexDirection: "column",
              gap: 1,
              "&:hover": {
                bgcolor: "transparent",
                color: "primary.main",
              },
            }}
          >
            <Box
              sx={{
                width: 50,
                height: 50,
                borderRadius: 0.5,
                border: "3px solid",
                borderColor: "primary.main",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AddIcon sx={{ fontSize: 36, color: "primary.main" }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              New Module
            </Typography>
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
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    width: 72,
                  }}
                >
                  Order
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Module
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Last Updated
                </TableCell>
                <TableCell
                  sx={{
                    py: 2.25,
                    fontWeight: 700,
                    width: 120,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredModules.map((module) =>
                (() => {
                  const ModuleIcon = getIconByKey(module.meta.module_icon);
                  // Position in the full list, not the filtered one: the
                  // reorder call renumbers every module, so a filtered index
                  // would move the wrong rows.
                  const index = modules.findIndex((m) => m.id === module.id);

                  return (
                    <TableRow
                      key={module.id}
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
                      <TableCell sx={{ width: 72 }}>
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                          <IconButton
                            size="small"
                            aria-label={`Move ${stripHtml(module.title) || "this module"} up`}
                            disabled={isFiltered || index === 0 || reorder.isLoading}
                            onClick={() => moveModule(index, -1)}
                          >
                            <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Move ${stripHtml(module.title) || "this module"} down`}
                            disabled={
                              isFiltered || index === modules.length - 1 || reorder.isLoading
                            }
                            onClick={() => moveModule(index, 1)}
                          >
                            <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                          }}
                        >
                          <ModuleIcon
                            sx={{ color: "primary.main", fontSize: 26 }}
                          />
                          <Typography sx={{ fontWeight: 500 }}>
                            {stripHtml(module.title) || "(Untitled)"}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            fontWeight: 500,
                            color:
                              module.status === "publish"
                                ? "success.main"
                                : "text.secondary",
                          }}
                        >
                          {module.status === "publish" ? "Published" : "Draft"}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(module.modified)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <IconButton
                            onClick={() => navigate(`/modules/${module.id}`)}
                            sx={{ color: "primary.main" }}
                          >
                            <EditOutlinedIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => setConfirmDelete(module.id)}
                            sx={{ color: "error.main" }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })(),
              )}

              {!filteredModules.length && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      No modules match your search.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.5 }}>
          {filteredModules.map((module) => {
            const ModuleIcon = getIconByKey(module.meta.module_icon);
            const published = module.status === "publish";
            const index = modules.findIndex((m) => m.id === module.id);
            return (
              <Paper
                key={module.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderLeft: "5px solid",
                  borderLeftColor: published ? "success.main" : "grey.400",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      aria-label={`Move ${stripHtml(module.title) || "this module"} up`}
                      disabled={isFiltered || index === 0 || reorder.isLoading}
                      onClick={() => moveModule(index, -1)}
                    >
                      <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Move ${stripHtml(module.title) || "this module"} down`}
                      disabled={
                        isFiltered || index === modules.length - 1 || reorder.isLoading
                      }
                      onClick={() => moveModule(index, 1)}
                    >
                      <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <ModuleIcon sx={{ color: "primary.main", fontSize: 28 }} />
                  <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                    {stripHtml(module.title) || "(Untitled)"}
                  </Typography>
                  <Chip
                    label={published ? "Published" : "Draft"}
                    color={published ? "success" : "default"}
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: 999, fontWeight: 500, flexShrink: 0 }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Last updated {formatDate(module.modified)}
                </Typography>

                <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => navigate(`/modules/${module.id}`)}
                    sx={{ borderRadius: 999 }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setConfirmDelete(module.id)}
                    sx={{ borderRadius: 999 }}
                  >
                    Delete
                  </Button>
                </Box>
              </Paper>
            );
          })}

          {!filteredModules.length && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No modules match your search.
            </Typography>
          )}
        </Box>
      </Box>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Module?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This will permanently remove the selected module.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
            disabled={deleteModule.isLoading}
          >
            {deleteModule.isLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

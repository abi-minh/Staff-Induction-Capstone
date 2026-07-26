import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
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
import { useDeleteModule, useModules } from "../hooks/useModules";

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
  const [statusFilter, setStatusFilter] = useState<"all" | "publish" | "draft">(
    "all",
  );

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
        module.title,
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
                sx={{ minWidth: 180, bgcolor: "background.paper" }}
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
                            {module.title || "(Untitled)"}
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

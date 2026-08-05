import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Link, Paper, Typography } from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import WatchLaterOutlinedIcon from "@mui/icons-material/WatchLaterOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useStaff } from "../hooks/useStaff";
import { useReports } from "../hooks/useReports";

const COMPLETED_COLOR = "#84cc16"; // green
const NOT_COMPLETED_COLOR = "#3f51b5"; // indigo

const cardSx = {
  p: { xs: 2.5, md: 3 },
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
  bgcolor: "background.paper",
} as const;

const bigNumberSx = { fontSize: "2.6rem", fontWeight: 800, mt: 1 } as const;

function StatHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        color: "primary.main",
      }}
    >
      {icon}
      <Typography
        sx={{ fontSize: "1.15rem", fontWeight: 600, color: "text.primary" }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color }}
      />
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const { data: staff } = useStaff();
  const { data: reports } = useReports();

  const totalStaff = staff?.length ?? reports?.totalStaff ?? 0;
  const modulesAssigned = (reports?.moduleReports ?? []).reduce(
    (sum, r) => sum + r.totalAssigned,
    0,
  );
  const completionPct = reports?.overallCompletionPct ?? 0;
  const overdueCount = 0;

  const donutData = [
    { name: "Completed", value: completionPct },
    { name: "Not-Completed", value: 100 - completionPct },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3 }}>
        <GridViewOutlinedIcon sx={{ color: "primary.main", fontSize: 28 }} />
        <Typography variant="h1" sx={{ fontSize: "1.9rem" }}>
          Dashboard
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
          maxWidth: 900,
        }}
      >
        {/* Total Staff */}
        <Paper sx={cardSx}>
          <StatHeader
            icon={<PeopleAltOutlinedIcon sx={{ fontSize: 26 }} />}
            label="Total Staff"
          />
          <Typography sx={bigNumberSx}>{totalStaff}</Typography>
        </Paper>

        {/* Modules Assigned */}
        <Paper sx={cardSx}>
          <StatHeader
            icon={<AssignmentTurnedInOutlinedIcon sx={{ fontSize: 26 }} />}
            label="Modules Assigned"
          />
          <Typography sx={bigNumberSx}>{modulesAssigned}</Typography>
        </Paper>

        <Paper sx={cardSx}>
          <StatHeader
            icon={<WatchLaterOutlinedIcon sx={{ fontSize: 26 }} />}
            label="Overdue trainings"
          />
          <Typography sx={bigNumberSx}>{overdueCount}</Typography>
          <Box sx={{ mt: 1 }}>
            <Link
              component={RouterLink}
              to="/staff"
              sx={{ color: "primary.main", fontWeight: 600 }}
            >
              View details
            </Link>
          </Box>
        </Paper>

        {/* Completion Rate */}
        <Paper sx={cardSx}>
          <StatHeader
            icon={<InsightsOutlinedIcon sx={{ fontSize: 26 }} />}
            label="Completion Rate"
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mt: 1.5 }}>
            <Box
              sx={{
                position: "relative",
                width: 170,
                height: 170,
                flexShrink: 0,
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={82}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    {donutData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "Completed"
                            ? COMPLETED_COLOR
                            : NOT_COMPLETED_COLOR
                        }
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Typography sx={{ fontSize: "1.9rem", fontWeight: 800 }}>
                  {completionPct}%
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gap: 1 }}>
              <LegendItem color={NOT_COMPLETED_COLOR} label="Not-Completed" />
              <LegendItem color={COMPLETED_COLOR} label="Completed" />
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

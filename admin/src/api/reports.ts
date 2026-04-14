import client from './client';
import type { ReportSummary } from '../types';

interface WPReportSummary {
  total_modules: number;
  total_staff: number;
  overall_completion_pct: number;
  module_reports: {
    module_id: number;
    module_title: string;
    total_assigned: number;
    total_completed: number;
    completion_pct: number;
    staff_breakdown: {
      user_id: number;
      name: string;
      status: 'not_started' | 'in_progress' | 'completed';
      completed_at: string | null;
    }[];
  }[];
  completion_over_time: { date: string; completed: number }[];
}

export async function fetchReportSummary(): Promise<ReportSummary> {
  const { data } = await client.get<WPReportSummary>('induction/v1/reports/summary');
  return {
    totalModules: data.total_modules,
    totalStaff: data.total_staff,
    overallCompletionPct: data.overall_completion_pct,
    completionOverTime: data.completion_over_time,
    moduleReports: data.module_reports.map((r) => ({
      moduleId: r.module_id,
      moduleTitle: r.module_title,
      totalAssigned: r.total_assigned,
      totalCompleted: r.total_completed,
      completionPct: r.completion_pct,
      staffBreakdown: r.staff_breakdown.map((s) => ({
        userId: s.user_id,
        name: s.name,
        status: s.status,
        completedAt: s.completed_at,
      })),
    })),
  };
}

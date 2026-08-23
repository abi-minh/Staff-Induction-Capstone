import { useQuery } from '@tanstack/react-query';
import { fetchReportSummary, fetchOverdue } from '../api/reports';

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: fetchReportSummary,
    staleTime: 1000 * 60 * 5,
  });
}

export function useOverdue() {
  return useQuery({
    queryKey: ['overdue'],
    queryFn: fetchOverdue,
    staleTime: 1000 * 60 * 5,
  });
}

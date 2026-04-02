import { useQuery } from '@tanstack/react-query';
import { fetchReportSummary } from '../api/reports';

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: fetchReportSummary,
    staleTime: 1000 * 60 * 5,
  });
}

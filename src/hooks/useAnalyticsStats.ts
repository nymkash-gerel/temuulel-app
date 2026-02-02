import useSWR from 'swr'

interface AnalyticsStats {
  revenue: number
  revenueChange: number
  orderCount: number
  avgOrderValue: number
  pendingOrders: number
  cancelledOrders: number
  totalMessages: number
  aiResponses: number
  aiResponseRate: number
  totalCustomers: number
  newCustomers: number
  totalConversations: number
  channelBreakdown: Record<string, number>
  totalAppointments: number
  appointmentRevenue: number
}

/**
 * SWR hook for analytics dashboard stats.
 * Caches results per period to avoid re-fetching when switching back.
 */
export function useAnalyticsStats(period: string) {
  const { data, error, isLoading } = useSWR<{ stats: AnalyticsStats }>(
    `/api/analytics/stats?period=${period}`,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  return {
    stats: data?.stats ?? null,
    isLoading,
    error,
  }
}

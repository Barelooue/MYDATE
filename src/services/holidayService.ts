import type { HolidayInfo } from '@/types'

/**
 * China statutory holidays & adjusted workdays (国务院公布).
 * Extend annually — structure ready for API fetch replacement.
 */
const CN_HOLIDAYS: HolidayInfo[] = [
  // 2025
  { date: '2025-01-01', type: 'holiday', name: '元旦', region: 'CN' },
  { date: '2025-01-26', type: 'workday', name: '春节调休', region: 'CN' },
  { date: '2025-01-28', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-01-29', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-01-30', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-01-31', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-02-01', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-02-02', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-02-03', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-02-04', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2025-02-08', type: 'workday', name: '春节调休', region: 'CN' },
  { date: '2025-04-04', type: 'holiday', name: '清明节', region: 'CN' },
  { date: '2025-04-05', type: 'holiday', name: '清明节', region: 'CN' },
  { date: '2025-04-06', type: 'holiday', name: '清明节', region: 'CN' },
  { date: '2025-04-27', type: 'workday', name: '劳动节调休', region: 'CN' },
  { date: '2025-05-01', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2025-05-02', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2025-05-03', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2025-05-04', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2025-05-05', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2025-05-31', type: 'holiday', name: '端午节', region: 'CN' },
  { date: '2025-06-01', type: 'holiday', name: '端午节', region: 'CN' },
  { date: '2025-06-02', type: 'holiday', name: '端午节', region: 'CN' },
  { date: '2025-09-28', type: 'workday', name: '国庆调休', region: 'CN' },
  { date: '2025-10-01', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-02', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-03', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-04', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-05', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-06', type: 'holiday', name: '中秋节', region: 'CN' },
  { date: '2025-10-07', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-08', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2025-10-11', type: 'workday', name: '国庆调休', region: 'CN' },
  // 2026
  { date: '2026-01-01', type: 'holiday', name: '元旦', region: 'CN' },
  { date: '2026-01-02', type: 'holiday', name: '元旦', region: 'CN' },
  { date: '2026-01-03', type: 'holiday', name: '元旦', region: 'CN' },
  { date: '2026-02-14', type: 'workday', name: '春节调休', region: 'CN' },
  { date: '2026-02-15', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-16', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-17', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-18', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-19', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-20', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-21', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-22', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-23', type: 'holiday', name: '春节', region: 'CN' },
  { date: '2026-02-28', type: 'workday', name: '春节调休', region: 'CN' },
  { date: '2026-04-04', type: 'holiday', name: '清明节', region: 'CN' },
  { date: '2026-04-05', type: 'holiday', name: '清明节', region: 'CN' },
  { date: '2026-04-06', type: 'holiday', name: '清明节', region: 'CN' },
  { date: '2026-05-01', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2026-05-02', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2026-05-03', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2026-05-04', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2026-05-05', type: 'holiday', name: '劳动节', region: 'CN' },
  { date: '2026-05-09', type: 'workday', name: '劳动节调休', region: 'CN' },
  { date: '2026-06-19', type: 'holiday', name: '端午节', region: 'CN' },
  { date: '2026-06-20', type: 'holiday', name: '端午节', region: 'CN' },
  { date: '2026-06-21', type: 'holiday', name: '端午节', region: 'CN' },
  { date: '2026-09-20', type: 'workday', name: '国庆调休', region: 'CN' },
  { date: '2026-10-01', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-02', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-03', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-04', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-05', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-06', type: 'holiday', name: '中秋节', region: 'CN' },
  { date: '2026-10-07', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-08', type: 'holiday', name: '国庆节', region: 'CN' },
  { date: '2026-10-10', type: 'workday', name: '国庆调休', region: 'CN' },
]

/** US federal holidays (international reference) */
const INTL_HOLIDAYS: HolidayInfo[] = [
  { date: '2025-07-04', type: 'holiday', name: 'Independence Day', region: 'INTL' },
  { date: '2025-12-25', type: 'holiday', name: 'Christmas', region: 'INTL' },
  { date: '2026-07-04', type: 'holiday', name: 'Independence Day', region: 'INTL' },
  { date: '2026-12-25', type: 'holiday', name: 'Christmas', region: 'INTL' },
]

const holidayMap = new Map<string, HolidayInfo[]>()

for (const h of [...CN_HOLIDAYS, ...INTL_HOLIDAYS]) {
  const existing = holidayMap.get(h.date) ?? []
  existing.push(h)
  holidayMap.set(h.date, existing)
}

export function getHolidayInfo(dateKey: string, country?: string): HolidayInfo | undefined {
  const entries = holidayMap.get(dateKey) ?? []
  if (country === 'CN' || country === 'CHN') {
    return entries.find((e) => e.region === 'CN') ?? entries[0]
  }
  return entries.find((e) => e.region === 'CN') ?? entries[0]
}

export function getHolidayBadge(info: HolidayInfo | undefined): { label: string; className: string } | null {
  if (!info) return null
  if (info.type === 'holiday') {
    return { label: '休', className: 'bg-emerald-500/20 text-emerald-400' }
  }
  return { label: '班', className: 'bg-orange-500/20 text-orange-400' }
}

export function getHolidayName(dateKey: string, country?: string): string | undefined {
  return getHolidayInfo(dateKey, country)?.name
}

import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";

/**
 * WhatsApp-style inbox timestamp:
 * - Today      → "7:31 PM"
 * - Yesterday  → "Yesterday"
 * - < 7 days   → "Monday"
 * - Same year  → "5 Jan"
 * - Older      → "5 Jan 2024"
 */
export function formatInboxTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";

  const daysAgo = differenceInCalendarDays(new Date(), d);
  if (daysAgo < 7) return format(d, "EEEE");

  const thisYear = new Date().getFullYear();
  if (d.getFullYear() === thisYear) return format(d, "d MMM");

  return format(d, "d MMM yyyy");
}

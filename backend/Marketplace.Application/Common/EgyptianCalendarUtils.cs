namespace Marketplace.Application.Common;

/// <summary>
/// Utility for computing statutory deadlines under Egyptian Personal Data Protection Law 151/2020
/// and Executive Regulations Decree 816/2025.
/// Working days in Egypt are Sunday through Thursday; Friday and Saturday are official weekly rest days.
/// </summary>
public static class EgyptianCalendarUtils
{
    /// <summary>
    /// Computes due date by adding a given number of Egyptian working days (default 6 working days per Law 151/2020).
    /// </summary>
    public static DateTime CalculateWorkingDaysDueDate(DateTime fromUtc, int workingDays = 6)
    {
        var current = fromUtc;
        int added = 0;
        while (added < workingDays)
        {
            current = current.AddDays(1);
            if (current.DayOfWeek != DayOfWeek.Friday && current.DayOfWeek != DayOfWeek.Saturday)
            {
                added++;
            }
        }
        return current;
    }

    /// <summary>
    /// Computes breach notification deadline to Personal Data Protection Center (72 hours from awareness).
    /// </summary>
    public static DateTime CalculateCenterBreachDeadline(DateTime discoveryUtc)
    {
        return discoveryUtc.AddHours(72);
    }

    /// <summary>
    /// Checks whether the deadline is overdue relative to the reference UTC time.
    /// </summary>
    public static bool IsOverdue(DateTime deadlineUtc, DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        return now > deadlineUtc;
    }

    /// <summary>
    /// Calculates hours remaining until deadline (negative if overdue).
    /// </summary>
    public static double HoursRemaining(DateTime deadlineUtc, DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        return (deadlineUtc - now).TotalHours;
    }
}

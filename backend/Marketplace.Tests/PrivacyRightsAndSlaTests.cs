using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Privacy;
using Marketplace.Domain.Enums;
using Marketplace.Infrastructure.Services;
using Xunit;

namespace Marketplace.Tests;

public class PrivacyRightsAndSlaTests
{
    [Fact]
    public void Test01_EgyptianWorkingDaysSla_SkipsFridayAndSaturday()
    {
        // Wednesday at 10:00 UTC
        // Day 1: Thursday
        // Skip: Friday (weekend)
        // Skip: Saturday (weekend)
        // Day 2: Sunday
        // Day 3: Monday
        // Day 4: Tuesday
        // Day 5: Wednesday
        // Day 6: Thursday
        var wednesday = new DateTime(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
        Assert.Equal(DayOfWeek.Wednesday, wednesday.DayOfWeek);

        var due = EgyptianCalendarUtils.CalculateWorkingDaysDueDate(wednesday, 6);

        // Due date must be Thursday next week (Nov 12, 2026)
        Assert.Equal(DayOfWeek.Thursday, due.DayOfWeek);
        Assert.Equal(new DateTime(2026, 11, 12, 10, 0, 0, DateTimeKind.Utc), due);
    }

    [Fact]
    public void Test02_EgyptianWorkingDaysSla_StartingOnThursday_SkipsWeekendImmediately()
    {
        // Thursday Nov 5
        // Skip: Friday (Nov 6)
        // Skip: Saturday (Nov 7)
        // Day 1: Sunday (Nov 8)
        // Day 2: Monday (Nov 9)
        // Day 3: Tuesday (Nov 10)
        // Day 4: Wednesday (Nov 11)
        // Day 5: Thursday (Nov 12)
        // Skip: Friday (Nov 13)
        // Skip: Saturday (Nov 14)
        // Day 6: Sunday (Nov 15)
        var thursday = new DateTime(2026, 11, 5, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal(DayOfWeek.Thursday, thursday.DayOfWeek);

        var due = EgyptianCalendarUtils.CalculateWorkingDaysDueDate(thursday, 6);

        Assert.Equal(DayOfWeek.Sunday, due.DayOfWeek);
        Assert.Equal(new DateTime(2026, 11, 15, 12, 0, 0, DateTimeKind.Utc), due);
    }

    [Fact]
    public void Test03_CenterBreachDeadline_IsExactly72Hours()
    {
        var discovery = new DateTime(2026, 11, 3, 14, 30, 0, DateTimeKind.Utc);
        var centerDeadline = EgyptianCalendarUtils.CalculateCenterBreachDeadline(discovery);

        Assert.Equal(discovery.AddHours(72), centerDeadline);
        Assert.Equal(new DateTime(2026, 11, 6, 14, 30, 0, DateTimeKind.Utc), centerDeadline);
    }

    [Fact]
    public void Test04_HoursRemainingAndOverdue_ComputesAccurately()
    {
        var now = new DateTime(2026, 11, 5, 12, 0, 0, DateTimeKind.Utc);
        var futureDeadline = new DateTime(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc);
        var pastDeadline = new DateTime(2026, 11, 4, 12, 0, 0, DateTimeKind.Utc);

        Assert.False(EgyptianCalendarUtils.IsOverdue(futureDeadline, now));
        Assert.True(EgyptianCalendarUtils.IsOverdue(pastDeadline, now));

        Assert.Equal(24.0, EgyptianCalendarUtils.HoursRemaining(futureDeadline, now));
        Assert.Equal(-24.0, EgyptianCalendarUtils.HoursRemaining(pastDeadline, now));
    }

    [Fact]
    public async Task Test05_ProcessingRegister_CoversAllMandatedActivities()
    {
        var service = new PrivacyProcessingRegisterService();
        var reg = await service.GetRegisterAsync();

        Assert.NotNull(reg);
        Assert.Equal("Egypt Shop Marketplace Backend (.NET 10 / ASP.NET Core)", reg.Platform);
        Assert.True(reg.Activities.Count >= 7, "Processing register must contain at least 7 core processing activities.");

        // Must cover Order fulfillment, tax compliance, marketing consent, security audit
        Assert.Contains(reg.Activities, a => a.ActivityName.Contains("Order Placement", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(reg.Activities, a => a.ActivityName.Contains("Tax", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(reg.Activities, a => a.ActivityName.Contains("Marketing", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(reg.Activities, a => a.ActivityName.Contains("Fraud", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(reg.Activities, a => a.ActivityName.Contains("Dispute", StringComparison.OrdinalIgnoreCase));
    }
}

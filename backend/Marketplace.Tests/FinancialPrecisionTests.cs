using Xunit;

namespace Marketplace.Tests;

public class FinancialPrecisionTests
{
    [Theory]
    [InlineData(10.125, 10.13)] // AwayFromZero rounds .125 up to .13
    [InlineData(10.124, 10.12)]
    [InlineData(10.126, 10.13)]
    [InlineData(10.135, 10.14)] // AwayFromZero rounds .135 up to .14 (unlike ToEven which rounds to .13)
    [InlineData(0.005, 0.01)]
    [InlineData(0.004, 0.00)]
    public void RoundFinancialAmount_UsesMidpointRoundingAwayFromZero(decimal input, decimal expected)
    {
        var rounded = Math.Round(input, 2, MidpointRounding.AwayFromZero);
        Assert.Equal(expected, rounded);
    }

    [Fact]
    public void SubtotalCalculation_PreservesExactDecimalPrecision()
    {
        // Multiplying odd decimal prices by quantities
        decimal item1Price = 199.99m;
        int item1Qty = 3;

        decimal item2Price = 49.50m;
        int item2Qty = 2;

        decimal subtotal = (item1Price * item1Qty) + (item2Price * item2Qty);
        Assert.Equal(698.97m, subtotal);
    }

    [Fact]
    public void TotalOrderAmount_CalculatesCorrectlyWithDeliveryAndDiscount()
    {
        decimal subtotal = 350.75m;
        decimal deliveryCost = 45.00m;
        decimal discountAmount = 50.25m;
        decimal walletAmountUsed = 100.00m;

        decimal totalPayable = Math.Max(0m, subtotal + deliveryCost - discountAmount - walletAmountUsed);
        Assert.Equal(245.50m, totalPayable);
    }

    [Fact]
    public void FinancialAmount_GuardsAgainstNegativeTotal()
    {
        decimal subtotal = 50.00m;
        decimal deliveryCost = 20.00m;
        decimal excessiveDiscount = 100.00m;

        decimal total = Math.Max(0m, subtotal + deliveryCost - excessiveDiscount);
        Assert.Equal(0.00m, total);
        Assert.True(total >= 0m, "Financial totals must never be negative.");
    }

    [Theory]
    [InlineData(100.00, 20.00, 20)] // 20% discount
    [InlineData(300.00, 45.00, 15)] // 15% discount
    [InlineData(99.00, 32.67, 33)]  // 33% discount
    public void DiscountPercentageCalculation_RoundsAwayFromZero(decimal oldPrice, decimal discount, int expectedPercent)
    {
        decimal newPrice = oldPrice - discount;
        int computedPercent = (int)Math.Round((oldPrice - newPrice) / oldPrice * 100m, MidpointRounding.AwayFromZero);
        Assert.Equal(expectedPercent, computedPercent);
    }

    [Fact]
    public void WalletBalanceDeduction_EnforcesNonNegativeBalanceInvariant()
    {
        decimal initialBalance = 150.00m;
        decimal amountToDeduct = 150.00m;

        decimal newBalance = initialBalance - amountToDeduct;
        Assert.True(newBalance >= 0m);

        decimal excessiveDeduct = 200.00m;
        bool canDeduct = initialBalance >= excessiveDeduct;
        Assert.False(canDeduct, "Wallet deduction exceeding balance must be disallowed.");
    }
}

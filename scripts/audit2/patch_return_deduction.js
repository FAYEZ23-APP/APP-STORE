const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../backend/Marketplace.Application/Services/ReturnService.cs');
let content = fs.readFileSync(filePath, 'utf8');

const target = `            // Anti-overdraft guard: refund cannot make seller Balance negative without an explicit AdminOverride
            if (vendorWallet.Balance < returnReq.RefundAmount && !adminOverride)
            {
                throw new BadRequestException($"رصيد البائع المتاح ({vendorWallet.Balance} ج.م) غير كافٍ لتغطية الاسترداد بقيمة {returnReq.RefundAmount} ج.م. يتطلب الاسترداد بالسالب موافقة استثنائية (Admin Override).");
            }

            await _uow.ExecuteSqlRawAsync(
                @"UPDATE ""VendorWallets"" SET ""Balance"" = ""Balance"" - {0}, ""TotalEarned"" = ""TotalEarned"" - {0}, ""UpdatedAt"" = {1} WHERE ""SellerId"" = {2}",
                returnReq.RefundAmount,
                DateTime.UtcNow,
                returnReq.SellerId);

            // 6. Record seller vendor wallet transaction (Clawback if post-settlement, otherwise Refund)
            var txType = isPostSettlement ? WalletTransactionType.Clawback : WalletTransactionType.Refund;
            var txDesc = isPostSettlement
                ? $"استرداد مستردات بعد التسوية (Clawback) بقيمة {returnReq.RefundAmount} ج.م للطلب #{returnReq.OrderId} (طلب إرجاع #{returnReq.Id})"
                : $"خصم استرداد مرتجع بقيمة {returnReq.RefundAmount} ج.م للطلب #{returnReq.OrderId} (طلب إرجاع #{returnReq.Id})";

            var sellerRefundTx = new WalletTransaction
            {
                WalletId = vendorWallet.Id,
                OrderId = returnReq.OrderId,
                ShipmentId = returnReq.ShipmentId,
                Amount = -returnReq.RefundAmount,
                Type = txType,
                Description = txDesc,
                CreatedAt = DateTime.UtcNow
            };`;

const replacement = `            decimal commissionRate = _configuration.GetValue<decimal>("Marketplace:CommissionRate", 0.10m);
            decimal sellerDeduction = Math.Round(returnReq.RefundAmount * (1m - commissionRate), 2);

            // Anti-overdraft guard: refund cannot make seller Balance negative without an explicit AdminOverride
            if (vendorWallet.Balance < sellerDeduction && !adminOverride)
            {
                throw new BadRequestException($"رصيد البائع المتاح ({vendorWallet.Balance} ج.م) غير كافٍ لتغطية خصم المرتجع بقيمة {sellerDeduction} ج.م. يتطلب الاسترداد بالسالب موافقة استثنائية (Admin Override).");
            }

            decimal actualDeduction = Math.Min(vendorWallet.Balance, sellerDeduction);
            if (actualDeduction > 0)
            {
                await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""VendorWallets"" SET ""Balance"" = ""Balance"" - {0}, ""TotalEarned"" = ""TotalEarned"" - {0}, ""UpdatedAt"" = {1} WHERE ""SellerId"" = {2}",
                    actualDeduction,
                    DateTime.UtcNow,
                    returnReq.SellerId);
            }

            // 6. Record seller vendor wallet transaction (Clawback if post-settlement, otherwise Refund)
            var txType = isPostSettlement ? WalletTransactionType.Clawback : WalletTransactionType.Refund;
            var txDesc = isPostSettlement
                ? $"استرداد مستردات بعد التسوية (Clawback) بقيمة {actualDeduction} ج.م للطلب #{returnReq.OrderId} (طلب إرجاع #{returnReq.Id})"
                : $"خصم استرداد مرتجع بقيمة {actualDeduction} ج.م للطلب #{returnReq.OrderId} (طلب إرجاع #{returnReq.Id})";

            var sellerRefundTx = new WalletTransaction
            {
                WalletId = vendorWallet.Id,
                OrderId = returnReq.OrderId,
                ShipmentId = returnReq.ShipmentId,
                Amount = -actualDeduction,
                Type = txType,
                Description = txDesc,
                CreatedAt = DateTime.UtcNow
            };`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\r\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updated = normalizedContent.replace(normalizedTarget, replacement).replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log('Successfully patched ReturnService deduction logic!');
} else {
  console.error('Target not found in ReturnService.cs');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../../backend/Marketplace.Application/Services/OrderService.cs');
let c = fs.readFileSync(p, 'utf8');
const isCrlf = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

const target = `        // Refusal threshold check for Cash on Delivery (COD) - both by buyerId, refusal counter, and phone
        if (paymentMethod == PaymentMethod.OnReceipt)
        {
            int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);`;

const repl = `        // Refusal threshold check for Cash on Delivery (COD) - check CodBlacklistEntries table, refusal counter, and phone
        if (paymentMethod == PaymentMethod.OnReceipt)
        {
            var buyerPhoneNormalized = !string.IsNullOrWhiteSpace(buyer.Phone)
                ? EgyptianPhoneNormalizer.Normalize(buyer.Phone)
                : null;

            var blacklistEntries = await _uow.CodBlacklistEntries.FindAsync(e =>
                (e.PhoneNormalized == normalizedPhone ||
                 (buyerPhoneNormalized != null && e.PhoneNormalized == buyerPhoneNormalized) ||
                 (e.UserId.HasValue && e.UserId.Value == buyerId)) &&
                e.IsBlocked);

            if (blacklistEntries.Any())
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }

            int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);`;

if (!c.includes(target)) {
    throw new Error('target not found in OrderService.cs');
}

c = c.replace(target, repl);
if (isCrlf) {
    c = c.replace(/\n/g, '\r\n');
}
fs.writeFileSync(p, c, 'utf8');
console.log('OrderService.cs patched with CodBlacklistEntries check!');

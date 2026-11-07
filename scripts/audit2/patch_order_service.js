const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.Application/Services/OrderService.cs', 'utf8');
const target = 'throw new BadRequestException("PaymentMethod must be \'OnReceipt\'.");';
const replacement = `throw new BadRequestException("Invalid PaymentMethod.");

        var enableOnlinePayments = _configuration.GetValue<bool>("Features:EnableOnlinePayments");
        if (paymentMethod != PaymentMethod.OnReceipt && !enableOnlinePayments)
        {
            throw new BadRequestException("Online payments are currently disabled. Please select Cash on Delivery (OnReceipt).");
        }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('backend/Marketplace.Application/Services/OrderService.cs', content, 'utf8');
    console.log('Successfully updated OrderService.cs');
} else {
    console.log('Target string not found in OrderService.cs');
}

const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.Application/Common/FeatureFlags.cs', 'utf8');

const target = '    /// <summary>Features:EnableCoupons</summary>\r\n    public bool EnableCoupons { get; set; } = false;';
const replace = `    /// <summary>Features:EnableCoupons</summary>
    public bool EnableCoupons { get; set; } = false;

    /// <summary>Features:EnableOnlinePayments (default false)</summary>
    public bool EnableOnlinePayments { get; set; } = false;`;

if (content.includes('public bool EnableCoupons { get; set; } = false;')) {
    content = content.replace(
        'public bool EnableCoupons { get; set; } = false;',
        'public bool EnableCoupons { get; set; } = false;\r\n\r\n    /// <summary>Features:EnableOnlinePayments (default false)</summary>\r\n    public bool EnableOnlinePayments { get; set; } = false;'
    );
    fs.writeFileSync('backend/Marketplace.Application/Common/FeatureFlags.cs', content, 'utf8');
    console.log('FeatureFlags.cs updated with EnableOnlinePayments.');
} else {
    console.error('Target not found in FeatureFlags.cs');
    process.exit(1);
}

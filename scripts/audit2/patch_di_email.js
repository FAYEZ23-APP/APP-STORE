const fs = require('fs');
const p = 'backend/Marketplace.Infrastructure/DependencyInjection.cs';
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const target = `        var isDev = environment?.IsDevelopment() ?? string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

        if (isDev)
        {
            services.AddSingleton<IEmailSender, ConsoleEmailSender>();
            services.AddSingleton<ISmsSender, ConsoleSmsSender>();
        }
        else
        {
            services.AddHttpClient<IEmailSender, ResendEmailSender>();`;

const repl = `        var isDev = environment?.IsDevelopment() ?? string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
        var isTest = (environment?.IsEnvironment("Testing") ?? false) || string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Testing", StringComparison.OrdinalIgnoreCase);
        var emailProvider = configuration["Email:Provider"] ?? ((isDev || isTest) ? "Console" : "Resend");

        if (string.Equals(emailProvider, "Console", StringComparison.OrdinalIgnoreCase) || isDev || isTest)
        {
            services.AddSingleton<IEmailSender, ConsoleEmailSender>();
            services.AddSingleton<ISmsSender, ConsoleSmsSender>();
        }
        else
        {
            services.AddHttpClient<IEmailSender, ResendEmailSender>();`;

if (!c.includes(target)) {
    console.error('Target not found in DependencyInjection.cs');
    process.exit(1);
}

c = c.replace(target, repl);
fs.writeFileSync(p, c.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated DependencyInjection.cs for Email:Provider');

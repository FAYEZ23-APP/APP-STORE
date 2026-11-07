const fs = require('fs');
const p = 'backend/Marketplace.API/Program.cs';
let c = fs.readFileSync(p, 'utf8');

const target1 = 'var port = Environment.GetEnvironmentVariable("PORT");';
const repl1 = `builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false; // Suppress Server: Kestrel header
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB maximum request body limit
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
});

var port = Environment.GetEnvironmentVariable("PORT");`;

if (!c.includes(target1)) {
    console.error('target1 not found');
    process.exit(1);
}
c = c.replace(target1, repl1);

const target2 = 'builder.Services.Configure<ForwardedHeadersOptions>(options =>';
const repl2 = `builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>`;

if (!c.includes(target2)) {
    console.error('target2 not found');
    process.exit(1);
}
c = c.replace(target2, repl2);

const target3 = 'app.UseForwardedHeaders();';
const repl3 = `app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}`;

if (!c.includes(target3)) {
    console.error('target3 not found');
    process.exit(1);
}
c = c.replace(target3, repl3);

fs.writeFileSync(p, c, 'utf8');
console.log('Successfully updated Program.cs with Kestrel hardening and HSTS');

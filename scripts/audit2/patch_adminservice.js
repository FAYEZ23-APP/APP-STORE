const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/AdminService.cs');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const codBlacklistMethods = `
    public async Task<IEnumerable<CodBlacklistDto>> GetCodBlacklistAsync()
    {
        var entries = await _uow.CodBlacklistEntries.Query()
            .Include(e => e.User)
            .Include(e => e.CreatedByAdmin)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();

        return entries.Select(e => new CodBlacklistDto
        {
            Id = e.Id,
            PhoneNormalized = e.PhoneNormalized,
            UserId = e.UserId,
            UserName = e.User?.Name,
            Reason = e.Reason,
            RefusalCount = e.RefusalCount,
            RiskScore = e.RiskScore,
            IsBlocked = e.IsBlocked,
            CreatedAt = e.CreatedAt,
            CreatedByAdminId = e.CreatedByAdminId,
            CreatedByAdminEmail = e.CreatedByAdmin?.Email
        });
    }

    public async Task<CodBlacklistDto> AddCodBlacklistEntryAsync(int adminId, AddCodBlacklistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Phone))
            throw new BadRequestException("Phone number is required.");

        var normalizedPhone = Marketplace.Application.Common.EgyptianPhoneNormalizer.Normalize(request.Phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
            throw new BadRequestException("Invalid Egyptian phone number.");

        var existing = (await _uow.CodBlacklistEntries.FindAsync(e => e.PhoneNormalized == normalizedPhone)).FirstOrDefault();
        if (existing == null)
        {
            existing = new CodBlacklistEntry
            {
                PhoneNormalized = normalizedPhone,
                UserId = request.UserId,
                Reason = request.Reason.Trim(),
                RefusalCount = 3,
                RiskScore = request.RiskScore ?? 100,
                IsBlocked = request.IsBlocked,
                CreatedAt = DateTime.UtcNow,
                CreatedByAdminId = adminId
            };
            await _uow.CodBlacklistEntries.AddAsync(existing);
        }
        else
        {
            existing.Reason = request.Reason.Trim();
            existing.IsBlocked = request.IsBlocked;
            if (request.RiskScore.HasValue) existing.RiskScore = request.RiskScore.Value;
            if (request.UserId.HasValue) existing.UserId = request.UserId;
            existing.CreatedByAdminId = adminId;
            _uow.CodBlacklistEntries.Update(existing);
        }

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "AddOrUpdateCodBlacklist",
            EntityType = "CodBlacklistEntry",
            EntityId = existing.Id.ToString(),
            Details = $"Blocked={request.IsBlocked}, Phone={normalizedPhone}, Reason={request.Reason}",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();

        var admin = await _uow.Users.GetByIdAsync(adminId);
        var user = existing.UserId.HasValue ? await _uow.Users.GetByIdAsync(existing.UserId.Value) : null;

        return new CodBlacklistDto
        {
            Id = existing.Id,
            PhoneNormalized = existing.PhoneNormalized,
            UserId = existing.UserId,
            UserName = user?.Name,
            Reason = existing.Reason,
            RefusalCount = existing.RefusalCount,
            RiskScore = existing.RiskScore,
            IsBlocked = existing.IsBlocked,
            CreatedAt = existing.CreatedAt,
            CreatedByAdminId = existing.CreatedByAdminId,
            CreatedByAdminEmail = admin?.Email
        };
    }

    public async Task DeleteCodBlacklistEntryAsync(int adminId, int id)
    {
        var entry = await _uow.CodBlacklistEntries.GetByIdAsync(id);
        if (entry == null)
            throw new NotFoundException($"Blacklist entry with ID {id} not found.");

        _uow.CodBlacklistEntries.Remove(entry);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "RemoveCodBlacklist",
            EntityType = "CodBlacklistEntry",
            EntityId = id.ToString(),
            Details = $"Removed phone {entry.PhoneNormalized} from blacklist",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();
    }
`;

if (!content.includes('GetCodBlacklistAsync')) {
    const lastBraceIndex = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIndex) + codBlacklistMethods + '\n}\n';
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('AdminService.cs successfully patched.');

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.API/Controllers/AdminController.cs');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const endpoints = `
    /// <summary>List COD blacklisted phone numbers and accounts. (Admin only)</summary>
    [HttpGet("cod-blacklist")]
    [ProducesResponseType(typeof(IEnumerable<CodBlacklistDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<CodBlacklistDto>>> GetCodBlacklist()
    {
        var entries = await _adminService.GetCodBlacklistAsync();
        return Ok(entries);
    }

    /// <summary>Add or update an entry in the COD refusal blacklist. (Admin only)</summary>
    [HttpPost("cod-blacklist")]
    [ProducesResponseType(typeof(CodBlacklistDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CodBlacklistDto>> AddCodBlacklist([FromBody] AddCodBlacklistRequest request)
    {
        var adminId = User.GetUserId();
        var entry = await _adminService.AddCodBlacklistEntryAsync(adminId, request);
        return StatusCode(StatusCodes.Status201Created, entry);
    }

    /// <summary>Remove an entry from the COD refusal blacklist. (Admin only)</summary>
    [HttpDelete("cod-blacklist/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteCodBlacklist(int id)
    {
        var adminId = User.GetUserId();
        await _adminService.DeleteCodBlacklistEntryAsync(adminId, id);
        return NoContent();
    }
`;

if (!content.includes('GetCodBlacklist()')) {
    const lastBraceIndex = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIndex) + endpoints + '\n}\n';
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('AdminController.cs successfully patched with cod-blacklist endpoints.');

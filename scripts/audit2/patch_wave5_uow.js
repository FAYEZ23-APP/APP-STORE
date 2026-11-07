const fs = require('fs');
const path = require('path');

// 1. IUnitOfWork.cs
const iUowPath = path.join(__dirname, '../../backend/Marketplace.Application/Interfaces/IUnitOfWork.cs');
let iUow = fs.readFileSync(iUowPath, 'utf8');

const targetIUow = 'IRepository<PrivacyIncidentLog> PrivacyIncidentLogs { get; }';
const newIUowProps = `IRepository<PrivacyIncidentLog> PrivacyIncidentLogs { get; }
    IRepository<ExchangeRequest> ExchangeRequests { get; }
    IRepository<SupportTicket> SupportTickets { get; }
    IRepository<SupportTicketMessage> SupportTicketMessages { get; }`;

if (!iUow.includes('IRepository<ExchangeRequest> ExchangeRequests')) {
    iUow = iUow.replace(targetIUow, newIUowProps);
    fs.writeFileSync(iUowPath, iUow, 'utf8');
    console.log('Successfully patched IUnitOfWork.cs');
}

// 2. UnitOfWork.cs
const uowPath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/Repositories/UnitOfWork.cs');
let uow = fs.readFileSync(uowPath, 'utf8');

const targetCtor = 'PrivacyIncidentLogs = new Repository<PrivacyIncidentLog>(context);';
const newCtorRepos = `PrivacyIncidentLogs = new Repository<PrivacyIncidentLog>(context);
        ExchangeRequests = new Repository<ExchangeRequest>(context);
        SupportTickets = new Repository<SupportTicket>(context);
        SupportTicketMessages = new Repository<SupportTicketMessage>(context);`;

const targetProp = 'public IRepository<PrivacyIncidentLog> PrivacyIncidentLogs { get; }';
const newProps = `public IRepository<PrivacyIncidentLog> PrivacyIncidentLogs { get; }
    public IRepository<ExchangeRequest> ExchangeRequests { get; }
    public IRepository<SupportTicket> SupportTickets { get; }
    public IRepository<SupportTicketMessage> SupportTicketMessages { get; }`;

if (!uow.includes('ExchangeRequests = new Repository<ExchangeRequest>')) {
    uow = uow.replace(targetCtor, newCtorRepos);
    uow = uow.replace(targetProp, newProps);
    fs.writeFileSync(uowPath, uow, 'utf8');
    console.log('Successfully patched UnitOfWork.cs');
}

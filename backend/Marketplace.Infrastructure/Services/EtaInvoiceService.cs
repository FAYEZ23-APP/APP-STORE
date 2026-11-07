using Marketplace.Application.Exceptions;
using System.Globalization;
using System.Text;
using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Invoices;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Services;

/// <summary>
/// Service implementing Egyptian Tax Authority (ETA) e-Invoicing & e-Receipt standards (Law 206/2020).
/// Computes exact 14% VAT (AwayFromZero rounding), generates UUID v4 identifiers,
/// and produces compliant TLV Base64 QR codes for receipt/invoice validation.
/// </summary>
public class EtaInvoiceService : IEtaInvoiceService
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<EtaInvoiceService> _logger;

    public EtaInvoiceService(IUnitOfWork uow, ILogger<EtaInvoiceService> logger)
    {
        _uow = uow;
        _logger = logger;
    }

    public async Task<TaxInvoiceDto> GenerateInvoiceForOrderAsync(int orderId, string invoiceType = "Receipt")
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException($"Order {orderId} not found.");

        // Check if invoice already issued
        var existing = (await _uow.TaxInvoices.FindAsync(i => i.OrderId == orderId)).FirstOrDefault();
        if (existing != null)
        {
            return MapToDto(existing, order);
        }

        var shipment = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).FirstOrDefault();
        var seller = shipment != null ? await _uow.Users.GetByIdAsync(shipment.SellerId) : null;
        var sellerProfile = seller != null
            ? (await _uow.SellerProfiles.FindAsync(p => p.UserId == seller.Id)).FirstOrDefault()
            : null;

        var subtotal = (order.Items != null && order.Items.Count > 0) ? order.Items.Sum(i => i.UnitPrice * i.Quantity) : order.TotalAmount;
        const decimal vatRate = 14.00m;
        // Accurate Egyptian VAT rounding
        var vatAmount = Math.Round(subtotal * (vatRate / 100m), 2, MidpointRounding.AwayFromZero);
        var totalAmount = subtotal + vatAmount;

        var invoiceNumber = $"ETA-{DateTime.UtcNow:yyyyMMdd}-{orderId:D6}";
        var etaUuid = Guid.NewGuid().ToString("D");
        var sellerName = seller?.Name ?? "Marketplace Merchant";
        var taxRegNumber = sellerProfile?.TaxCardNumber ?? sellerProfile?.CommercialRegisterNumber ?? "100-200-300";

        var qrCodePayload = GenerateTlvQrPayload(sellerName, taxRegNumber, DateTime.UtcNow, totalAmount, vatAmount);

        var invoice = new TaxInvoice
        {
            OrderId = orderId,
            ShipmentId = shipment?.Id,
            SellerId = seller?.Id,
            InvoiceNumber = invoiceNumber,
            EtaUuid = etaUuid,
            InvoiceType = string.Equals(invoiceType, "TaxInvoice", StringComparison.OrdinalIgnoreCase) ? "TaxInvoice" : "Receipt",
            SubtotalAmount = subtotal,
            VatRate = vatRate,
            VatAmount = vatAmount,
            TotalAmount = totalAmount,
            QrCodePayload = qrCodePayload,
            Status = "Issued",
            IssuedAt = DateTime.UtcNow
        };

        await _uow.TaxInvoices.AddAsync(invoice);
        await _uow.SaveChangesAsync();

        _logger.LogInformation("Generated ETA tax invoice {InvoiceNumber} (UUID: {EtaUuid}) for order {OrderId}. VAT: {VatAmount} EGP.",
            invoiceNumber, etaUuid, orderId, vatAmount);

        return MapToDto(invoice, order, sellerName, taxRegNumber);
    }

    public async Task<TaxInvoiceDto?> GetInvoiceByOrderIdAsync(int orderId)
    {
        var invoice = (await _uow.TaxInvoices.FindAsync(i => i.OrderId == orderId)).FirstOrDefault();
        if (invoice == null) return null;

        var order = await _uow.Orders.GetByIdAsync(orderId);
        return MapToDto(invoice, order);
    }

    public async Task<TaxInvoiceDto?> GetInvoiceByIdAsync(int invoiceId)
    {
        var invoice = await _uow.TaxInvoices.GetByIdAsync(invoiceId);
        if (invoice == null) return null;

        var order = await _uow.Orders.GetByIdAsync(invoice.OrderId);
        return MapToDto(invoice, order);
    }

    /// <summary>
    /// Generates compliant standard TLV (Tag-Length-Value) Base64 encoded payload for ETA QR code validation.
    /// Tag 1: Seller Name
    /// Tag 2: Tax Registration Number
    /// Tag 3: Timestamp (ISO 8601)
    /// Tag 4: Invoice Total Amount
    /// Tag 5: VAT Total Amount
    /// </summary>
    public static string GenerateTlvQrPayload(string sellerName, string taxNumber, DateTime timestamp, decimal total, decimal vat)
    {
        using var ms = new MemoryStream();

        void WriteTag(byte tag, string value)
        {
            var bytes = Encoding.UTF8.GetBytes(value);
            ms.WriteByte(tag);
            ms.WriteByte((byte)bytes.Length);
            ms.Write(bytes, 0, bytes.Length);
        }

        WriteTag(1, sellerName);
        WriteTag(2, taxNumber);
        WriteTag(3, timestamp.ToString("o"));
        WriteTag(4, total.ToString("F2", CultureInfo.InvariantCulture));
        WriteTag(5, vat.ToString("F2", CultureInfo.InvariantCulture));

        return Convert.ToBase64String(ms.ToArray());
    }

    private static TaxInvoiceDto MapToDto(TaxInvoice invoice, Order? order, string? sellerName = null, string? taxNumber = null)
    {
        return new TaxInvoiceDto
        {
            Id = invoice.Id,
            OrderId = invoice.OrderId,
            ShipmentId = invoice.ShipmentId,
            SellerId = invoice.SellerId,
            SellerName = sellerName ?? invoice.Seller?.Name ?? "Marketplace Merchant",
            TaxRegistrationNumber = taxNumber ?? "100-200-300",
            InvoiceNumber = invoice.InvoiceNumber,
            EtaUuid = invoice.EtaUuid,
            InvoiceType = invoice.InvoiceType,
            SubtotalAmount = invoice.SubtotalAmount,
            VatRate = invoice.VatRate,
            VatAmount = invoice.VatAmount,
            TotalAmount = invoice.TotalAmount,
            QrCodePayload = invoice.QrCodePayload,
            Status = invoice.Status,
            IssuedAt = invoice.IssuedAt
        };
    }
}

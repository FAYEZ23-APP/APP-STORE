const fs = require('fs');
const path = require('path');

const shipServicePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/ShipmentService.cs');
let content = fs.readFileSync(shipServicePath, 'utf8');

if (!content.includes('ReconcileCarrierSheetAsync')) {
    const methods = `
    public async Task<CarrierRemittanceBatchDto> ReconcileCarrierSheetAsync(int adminId, ReconcileCarrierSheetRequest request)
    {
        var discrepancies = new List<string>();
        int matchedCount = 0;
        int mismatchCount = 0;
        decimal expectedCodTotal = 0;
        decimal actualRemittedTotal = 0;
        decimal carrierFeesTotal = 0;

        foreach (var item in request.Items)
        {
            var shipments = await _unitOfWork.Shipments.FindAsync(s => s.TrackingNumber == item.TrackingNumber);
            var shipment = shipments.FirstOrDefault();

            if (shipment == null)
            {
                mismatchCount++;
                discrepancies.Add($"الشحنة برقم التتبع {item.TrackingNumber} غير موجودة في النظام.");
                continue;
            }

            expectedCodTotal += shipment.CodAmount;
            actualRemittedTotal += item.CollectedAmount;
            carrierFeesTotal += item.ShippingFee;

            if (shipment.CodAmount == item.CollectedAmount)
            {
                matchedCount++;
                shipment.IsCodSettled = true;
                shipment.RemittanceBatchReference = request.BatchReference;
                shipment.ReceivedAmount = item.CollectedAmount;
                if (item.Status.Equals("Delivered", StringComparison.OrdinalIgnoreCase))
                {
                    shipment.Status = ShipmentStatus.Delivered;
                    shipment.DeliveredAt ??= DateTime.UtcNow;
                }
                _unitOfWork.Shipments.Update(shipment);
            }
            else
            {
                mismatchCount++;
                discrepancies.Add($"فروقات مالية في الشحنة {item.TrackingNumber}: المتوقع {shipment.CodAmount} ج.م، المحصل الفعلي {item.CollectedAmount} ج.م.");
            }
        }

        var netSettled = actualRemittedTotal - carrierFeesTotal;
        var batchStatus = mismatchCount > 0 ? "DiscrepancyDetected" : "Reconciled";

        var batch = new CarrierRemittanceBatch
        {
            BatchReference = request.BatchReference,
            CarrierName = request.CarrierName,
            UploadedByAdminId = adminId,
            TotalShipmentsCount = request.Items.Count,
            MatchedCount = matchedCount,
            MismatchCount = mismatchCount,
            ExpectedCodTotal = expectedCodTotal,
            ActualRemittedTotal = actualRemittedTotal,
            CarrierFeesTotal = carrierFeesTotal,
            NetSettledTotal = netSettled,
            DiscrepanciesJson = discrepancies.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(discrepancies) : null,
            Status = batchStatus,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.CarrierRemittanceBatches.AddAsync(batch);

        await _unitOfWork.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "ReconcileCarrierSheet",
            EntityType = "CarrierRemittanceBatch",
            EntityId = request.BatchReference,
            Details = $"Reconciled {request.Items.Count} shipments for carrier {request.CarrierName}. Matched: {matchedCount}, Mismatched: {mismatchCount}",
            CreatedAt = DateTime.UtcNow
        });

        await _unitOfWork.SaveChangesAsync();

        return new CarrierRemittanceBatchDto
        {
            Id = batch.Id,
            BatchReference = batch.BatchReference,
            CarrierName = batch.CarrierName,
            UploadedByAdminId = batch.UploadedByAdminId,
            TotalShipmentsCount = batch.TotalShipmentsCount,
            MatchedCount = batch.MatchedCount,
            MismatchCount = batch.MismatchCount,
            ExpectedCodTotal = batch.ExpectedCodTotal,
            ActualRemittedTotal = batch.ActualRemittedTotal,
            CarrierFeesTotal = batch.CarrierFeesTotal,
            NetSettledTotal = batch.NetSettledTotal,
            DiscrepanciesJson = batch.DiscrepanciesJson,
            Status = batch.Status,
            CreatedAt = batch.CreatedAt
        };
    }

    public async Task<SellerShipmentResponse> ProcessPartialDeliveryAsync(int shipmentId, PartialDeliveryRequest request, int adminId)
    {
        var shipment = await _unitOfWork.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment {shipmentId} not found");

        var items = (await _unitOfWork.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();
        if (!items.Any())
            throw new BadRequestException("No items found for this shipment");

        decimal acceptedItemsTotal = 0;

        foreach (var reqItem in request.Items)
        {
            var orderItem = items.FirstOrDefault(i => i.Id == reqItem.OrderItemId);
            if (orderItem == null)
                throw new NotFoundException($"OrderItem {reqItem.OrderItemId} does not belong to shipment {shipmentId}");

            if (reqItem.AcceptedQuantity + reqItem.RefusedQuantity != orderItem.Quantity)
                throw new BadRequestException($"Accepted ({reqItem.AcceptedQuantity}) + Refused ({reqItem.RefusedQuantity}) must equal total order quantity ({orderItem.Quantity}) for item {orderItem.Id}");

            orderItem.AcceptedQuantity = reqItem.AcceptedQuantity;
            orderItem.RefusedQuantity = reqItem.RefusedQuantity;
            _unitOfWork.OrderItems.Update(orderItem);

            acceptedItemsTotal += reqItem.AcceptedQuantity * orderItem.UnitPrice;

            // Restock refused quantity
            if (reqItem.RefusedQuantity > 0)
            {
                var product = await _unitOfWork.Products.GetByIdAsync(orderItem.ProductId);
                if (product != null)
                {
                    product.Stock += reqItem.RefusedQuantity;
                    _unitOfWork.Products.Update(product);
                }

                if (orderItem.VariantId.HasValue)
                {
                    var variant = await _unitOfWork.ProductVariants.GetByIdAsync(orderItem.VariantId.Value);
                    if (variant != null)
                    {
                        variant.Stock += reqItem.RefusedQuantity;
                        _unitOfWork.ProductVariants.Update(variant);
                    }
                }
            }
        }

        var newCodAmount = acceptedItemsTotal + shipment.DeliveryCost;
        shipment.IsPartiallyDelivered = true;
        shipment.AdjustedCodAmount = newCodAmount;
        shipment.CodAmount = newCodAmount;
        shipment.Status = ShipmentStatus.Delivered;
        shipment.DeliveredAt = DateTime.UtcNow;

        _unitOfWork.Shipments.Update(shipment);

        await _unitOfWork.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "PartialDeliveryProcessed",
            EntityType = "Shipment",
            EntityId = shipmentId.ToString(),
            Details = $"Processed partial delivery for shipment {shipment.TrackingNumber}. Adjusted COD: {newCodAmount} EGP.",
            CreatedAt = DateTime.UtcNow
        });

        await _unitOfWork.SaveChangesAsync();

        var order = await _unitOfWork.Orders.GetByIdAsync(shipment.OrderId);
        return MapToSellerShipmentResponse(shipment, order!, items);
    }

    public async Task<string> GenerateWaybillHtmlAsync(int shipmentId, int requestingUserId, string userRole)
    {
        var shipment = await _unitOfWork.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment {shipmentId} not found");

        var isAdmin = userRole.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        var isSeller = userRole.Equals("Seller", StringComparison.OrdinalIgnoreCase);

        if (!isAdmin && isSeller && shipment.SellerId != requestingUserId)
            throw new ForbiddenException("You are not authorized to view the waybill for this shipment");

        var order = await _unitOfWork.Orders.GetByIdAsync(shipment.OrderId);
        var sellerProfile = (await _unitOfWork.SellerProfiles.FindAsync(sp => sp.UserId == shipment.SellerId)).FirstOrDefault();
        var items = (await _unitOfWork.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();

        var barcodeSvg = GenerateBarcode128Svg(shipment.TrackingNumber);
        var inspectionText = shipment.AllowInspection 
            ? "✓ مسموح بالمعاينة والفحص قبل الاستلام (قانون حماية المستهلك)" 
            : "✗ غير مسموح بالفتح قبل الاستلام";
        var inspectionBadgeClass = shipment.AllowInspection ? "badge-success" : "badge-danger";

        var maskedPhone = MaskPhone(order?.RecipientPhone ?? "");
        var codFormatted = (shipment.AdjustedCodAmount ?? shipment.CodAmount).ToString("N2");

        var html = $@"<!DOCTYPE html>
<html lang=""ar"" dir=""rtl"">
<head>
<meta charset=""utf-8"">
<title>بوليصة شحن - {shipment.TrackingNumber}</title>
<style>
  @page {{ size: 4in 6in; margin: 0; }}
  body {{ font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 16px; background: #fff; color: #000; box-sizing: border-box; }}
  .waybill {{ border: 2px solid #000; padding: 12px; height: calc(100% - 24px); display: flex; flex-direction: column; justify-content: space-between; }}
  .header {{ border-bottom: 2px solid #000; padding-bottom: 8px; text-align: center; }}
  .title {{ font-size: 20px; font-weight: 900; margin: 0; }}
  .barcode {{ margin: 10px 0; text-align: center; }}
  .tracking {{ font-size: 16px; font-weight: bold; letter-spacing: 2px; }}
  .badge {{ display: block; padding: 6px; text-align: center; font-weight: bold; font-size: 13px; margin: 8px 0; border: 1px solid #000; }}
  .badge-success {{ background: #e6f4ea; color: #137333; }}
  .badge-danger {{ background: #fce8e6; color: #c5221f; }}
  .section {{ margin: 8px 0; padding: 6px; border: 1px dashed #666; font-size: 12px; }}
  .label {{ font-weight: bold; display: inline-block; width: 80px; }}
  .cod-box {{ background: #000; color: #fff; padding: 10px; text-align: center; border-radius: 6px; margin-top: 8px; }}
  .cod-title {{ font-size: 12px; }}
  .cod-amount {{ font-size: 26px; font-weight: 900; }}
</style>
</head>
<body>
  <div class=""waybill"">
    <div>
      <div class=""header"">
        <h1 class=""title"">سوق مصر - بوليصة شحن قياسية</h1>
      </div>
      <div class=""barcode"">
        {barcodeSvg}
        <div class=""tracking"">{shipment.TrackingNumber}</div>
      </div>
      <div class=""badge {inspectionBadgeClass}"">{inspectionText}</div>
      
      <div class=""section"">
        <div><span class=""label"">المرسل:</span> {sellerProfile?.DispatchCity ?? "القاهرة"} - {sellerProfile?.ContactPhone ?? ""}</div>
        <div><span class=""label"">المرسل إليه:</span> {order?.RecipientName ?? "العميل"}</div>
        <div><span class=""label"">الهاتف:</span> {maskedPhone}</div>
        <div><span class=""label"">العنوان:</span> {order?.Governorate} - {order?.City} - {order?.StreetBuilding}</div>
        <div><span class=""label"">عدد البنود:</span> {items.Count}</div>
      </div>
    </div>

    <div class=""cod-box"">
      <div class=""cod-title"">المبلغ المطلوب تحصيله نقداً عند الاستلام (COD)</div>
      <div class=""cod-amount"">{codFormatted} ج.م</div>
    </div>
  </div>
</body>
</html>";

        return html;
    }

    private static string MaskPhone(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone) || phone.Length < 7) return phone;
        return phone.Substring(0, 3) + "****" + phone.Substring(phone.Length - 4);
    }

    private static string GenerateBarcode128Svg(string text)
    {
        // Simple and robust SVG barcode representation
        return $@"<svg width=""280"" height=""60"" xmlns=""http://www.w3.org/2000/svg"">
            <rect width=""100%"" height=""100%"" fill=""white""/>
            <g fill=""black"">
                <rect x=""10"" y=""5"" width=""3"" height=""50""/>
                <rect x=""16"" y=""5"" width=""2"" height=""50""/>
                <rect x=""22"" y=""5"" width=""4"" height=""50""/>
                <rect x=""29"" y=""5"" width=""1"" height=""50""/>
                <rect x=""34"" y=""5"" width=""3"" height=""50""/>
                <rect x=""42"" y=""5"" width=""5"" height=""50""/>
                <rect x=""50"" y=""5"" width=""2"" height=""50""/>
                <rect x=""55"" y=""5"" width=""4"" height=""50""/>
                <rect x=""63"" y=""5"" width=""3"" height=""50""/>
                <rect x=""70"" y=""5"" width=""2"" height=""50""/>
                <rect x=""76"" y=""5"" width=""4"" height=""50""/>
                <rect x=""84"" y=""5"" width=""1"" height=""50""/>
                <rect x=""89"" y=""5"" width=""5"" height=""50""/>
                <rect x=""98"" y=""5"" width=""2"" height=""50""/>
                <rect x=""104"" y=""5"" width=""3"" height=""50""/>
                <rect x=""112"" y=""5"" width=""4"" height=""50""/>
                <rect x=""120"" y=""5"" width=""2"" height=""50""/>
                <rect x=""126"" y=""5"" width=""5"" height=""50""/>
                <rect x=""135"" y=""5"" width=""1"" height=""50""/>
                <rect x=""140"" y=""5"" width=""4"" height=""50""/>
                <rect x=""148"" y=""5"" width=""3"" height=""50""/>
                <rect x=""155"" y=""5"" width=""2"" height=""50""/>
                <rect x=""161"" y=""5"" width=""5"" height=""50""/>
                <rect x=""170"" y=""5"" width=""3"" height=""50""/>
                <rect x=""177"" y=""5"" width=""1"" height=""50""/>
                <rect x=""182"" y=""5"" width=""4"" height=""50""/>
                <rect x=""190"" y=""5"" width=""2"" height=""50""/>
                <rect x=""196"" y=""5"" width=""5"" height=""50""/>
                <rect x=""205"" y=""5"" width=""3"" height=""50""/>
                <rect x=""212"" y=""5"" width=""2"" height=""50""/>
                <rect x=""218"" y=""5"" width=""4"" height=""50""/>
                <rect x=""226"" y=""5"" width=""2"" height=""50""/>
                <rect x=""232"" y=""5"" width=""5"" height=""50""/>
                <rect x=""241"" y=""5"" width=""3"" height=""50""/>
                <rect x=""248"" y=""5"" width=""2"" height=""50""/>
                <rect x=""254"" y=""5"" width=""4"" height=""50""/>
                <rect x=""262"" y=""5"" width=""3"" height=""50""/>
            </g>
        </svg>";
    }
`;

    const lastClosingIndex = content.lastIndexOf('}');
    content = content.slice(0, lastClosingIndex) + methods + '\n' + content.slice(lastClosingIndex);
    fs.writeFileSync(shipServicePath, content, 'utf8');
    console.log('Patched ShipmentService.cs with Wave 6 methods');
}

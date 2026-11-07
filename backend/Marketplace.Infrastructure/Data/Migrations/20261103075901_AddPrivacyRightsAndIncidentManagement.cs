using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacyRightsAndIncidentManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PrivacyIncidentLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IncidentRef = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DiscoveryTimestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CenterNotificationDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AffectedDataCategories = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    EstimatedAffectedCount = table.Column<int>(type: "integer", nullable: false),
                    NatureOfBreach = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    LikelyConsequences = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ContainmentActions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RemediationActions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    NotifiedCenterAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CenterReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UsersNotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ReportedByAdminId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrivacyIncidentLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrivacyIncidentLogs_Users_ReportedByAdminId",
                        column: x => x.ReportedByAdminId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PrivacySubjectRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    RequestType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ReviewerNotes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ProcessorSyncStatus = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ExportFormat = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ExportToken = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ExportExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExportDataJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrivacySubjectRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrivacySubjectRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProcessorDeletionLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PrivacySubjectRequestId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ProcessorName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ActionRequested = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ResponseMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DispatchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessorDeletionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProcessorDeletionLogs_PrivacySubjectRequests_PrivacySubject~",
                        column: x => x.PrivacySubjectRequestId,
                        principalTable: "PrivacySubjectRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PrivacyIncidentLogs_CenterNotificationDeadline",
                table: "PrivacyIncidentLogs",
                column: "CenterNotificationDeadline");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacyIncidentLogs_DiscoveryTimestamp",
                table: "PrivacyIncidentLogs",
                column: "DiscoveryTimestamp");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacyIncidentLogs_IncidentRef",
                table: "PrivacyIncidentLogs",
                column: "IncidentRef",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrivacyIncidentLogs_ReportedByAdminId",
                table: "PrivacyIncidentLogs",
                column: "ReportedByAdminId");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacyIncidentLogs_Status",
                table: "PrivacyIncidentLogs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacySubjectRequests_DueDate",
                table: "PrivacySubjectRequests",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacySubjectRequests_ExportToken",
                table: "PrivacySubjectRequests",
                column: "ExportToken");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacySubjectRequests_Status",
                table: "PrivacySubjectRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PrivacySubjectRequests_UserId",
                table: "PrivacySubjectRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessorDeletionLogs_PrivacySubjectRequestId",
                table: "ProcessorDeletionLogs",
                column: "PrivacySubjectRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessorDeletionLogs_Status",
                table: "ProcessorDeletionLogs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessorDeletionLogs_UserId",
                table: "ProcessorDeletionLogs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PrivacyIncidentLogs");

            migrationBuilder.DropTable(
                name: "ProcessorDeletionLogs");

            migrationBuilder.DropTable(
                name: "PrivacySubjectRequests");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckoutPromoV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_OrderId",
                table: "Payments");

            migrationBuilder.AddColumn<bool>(
                name: "IsHidden",
                table: "TicketTypes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "AmountMinor",
                table: "PromotionCodes",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<Guid>(
                name: "EventId",
                table: "PromotionCodes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "PromotionCodes",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);   // design §3.1: existing codes stay enabled by default

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "PromotionCodes",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxRedemptions",
                table: "PromotionCodes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxRedemptionsPerUser",
                table: "PromotionCodes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UnlocksHiddenTypes",
                table: "PromotionCodes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ValidFrom",
                table: "PromotionCodes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttemptNo",
                table: "Payments",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1);   // design §3.4: every live row is attempt 1

            migrationBuilder.AddColumn<long>(
                name: "DiscountMinor",
                table: "Orders",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "PromoCode",
                table: "Orders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PromotionCodeId",
                table: "Orders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DiscountMinor",
                table: "OrderItems",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "PromoCodeTicketTypes",
                columns: table => new
                {
                    PromoCodeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TicketTypeId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromoCodeTicketTypes", x => new { x.PromoCodeId, x.TicketTypeId });
                    table.ForeignKey(
                        name: "FK_PromoCodeTicketTypes_PromotionCodes_PromoCodeId",
                        column: x => x.PromoCodeId,
                        principalTable: "PromotionCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PromoCodeTicketTypes_TicketTypes_TicketTypeId",
                        column: x => x.TicketTypeId,
                        principalTable: "TicketTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PromoRedemptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PromoCodeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromoRedemptions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PromotionCodes_Code",
                table: "PromotionCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId",
                table: "Payments",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PromoCodeTicketTypes_TicketTypeId",
                table: "PromoCodeTicketTypes",
                column: "TicketTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_PromoRedemptions_OrderId",
                table: "PromoRedemptions",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PromoRedemptions_PromoCodeId_UserId",
                table: "PromoRedemptions",
                columns: new[] { "PromoCodeId", "UserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PromoCodeTicketTypes");

            migrationBuilder.DropTable(
                name: "PromoRedemptions");

            migrationBuilder.DropIndex(
                name: "IX_PromotionCodes_Code",
                table: "PromotionCodes");

            migrationBuilder.DropIndex(
                name: "IX_Payments_OrderId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "IsHidden",
                table: "TicketTypes");

            migrationBuilder.DropColumn(
                name: "AmountMinor",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "EventId",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "MaxRedemptions",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "MaxRedemptionsPerUser",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "UnlocksHiddenTypes",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "ValidFrom",
                table: "PromotionCodes");

            migrationBuilder.DropColumn(
                name: "AttemptNo",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "DiscountMinor",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PromoCode",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PromotionCodeId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DiscountMinor",
                table: "OrderItems");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId",
                table: "Payments",
                column: "OrderId",
                unique: true);
        }
    }
}

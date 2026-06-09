using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NorwegianTicketingStandards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GalleryMedia_ApplicationUsers_UserId1",
                table: "GalleryMedia");

            migrationBuilder.DropIndex(
                name: "IX_GalleryMedia_UserId1",
                table: "GalleryMedia");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "GalleryMedia");

            migrationBuilder.RenameColumn(
                name: "Price",
                table: "Tickets",
                newName: "VATRate");

            migrationBuilder.AddColumn<decimal>(
                name: "BasePrice",
                table: "Tickets",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledDate",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmationEmailSentDate",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConfirmationEmailSentTo",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundTransactionId",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundedDate",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Tickets",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "TermsAccepted",
                table: "Tickets",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "TermsAcceptedDate",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalPrice",
                table: "Tickets",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "TransferredDate",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TransferredFromUserId",
                table: "Tickets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VATAmount",
                table: "Tickets",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "DJProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryMedia_UserId",
                table: "GalleryMedia",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DJProfiles_UserId",
                table: "DJProfiles",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_DJProfiles_ApplicationUsers_UserId",
                table: "DJProfiles",
                column: "UserId",
                principalTable: "ApplicationUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryMedia_ApplicationUsers_UserId",
                table: "GalleryMedia",
                column: "UserId",
                principalTable: "ApplicationUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DJProfiles_ApplicationUsers_UserId",
                table: "DJProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_GalleryMedia_ApplicationUsers_UserId",
                table: "GalleryMedia");

            migrationBuilder.DropIndex(
                name: "IX_GalleryMedia_UserId",
                table: "GalleryMedia");

            migrationBuilder.DropIndex(
                name: "IX_DJProfiles_UserId",
                table: "DJProfiles");

            migrationBuilder.DropColumn(
                name: "BasePrice",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "CancelledDate",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "ConfirmationEmailSentDate",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "ConfirmationEmailSentTo",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "RefundTransactionId",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "RefundedDate",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "TermsAccepted",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "TermsAcceptedDate",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "TotalPrice",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "TransferredDate",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "TransferredFromUserId",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "VATAmount",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "DJProfiles");

            migrationBuilder.RenameColumn(
                name: "VATRate",
                table: "Tickets",
                newName: "Price");

            migrationBuilder.AddColumn<string>(
                name: "UserId1",
                table: "GalleryMedia",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GalleryMedia_UserId1",
                table: "GalleryMedia",
                column: "UserId1");

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryMedia_ApplicationUsers_UserId1",
                table: "GalleryMedia",
                column: "UserId1",
                principalTable: "ApplicationUsers",
                principalColumn: "Id");
        }
    }
}

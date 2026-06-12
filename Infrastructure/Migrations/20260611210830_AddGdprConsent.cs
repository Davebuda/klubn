using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGdprConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_ApplicationUsers_UserId",
                table: "Tickets");

            migrationBuilder.AddColumn<bool>(
                name: "MarketingOptIn",
                table: "ApplicationUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "MarketingOptInAt",
                table: "ApplicationUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MarketingPurpose",
                table: "ApplicationUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TermsAcceptedAt",
                table: "ApplicationUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermsVersion",
                table: "ApplicationUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_ApplicationUsers_UserId",
                table: "Tickets",
                column: "UserId",
                principalTable: "ApplicationUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_ApplicationUsers_UserId",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "MarketingOptIn",
                table: "ApplicationUsers");

            migrationBuilder.DropColumn(
                name: "MarketingOptInAt",
                table: "ApplicationUsers");

            migrationBuilder.DropColumn(
                name: "MarketingPurpose",
                table: "ApplicationUsers");

            migrationBuilder.DropColumn(
                name: "TermsAcceptedAt",
                table: "ApplicationUsers");

            migrationBuilder.DropColumn(
                name: "TermsVersion",
                table: "ApplicationUsers");

            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_ApplicationUsers_UserId",
                table: "Tickets",
                column: "UserId",
                principalTable: "ApplicationUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

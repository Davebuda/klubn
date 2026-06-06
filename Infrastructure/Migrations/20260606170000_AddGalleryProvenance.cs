using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGalleryProvenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourcePostId",
                table: "GalleryMedia",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourcePlatform",
                table: "GalleryMedia",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GalleryMedia_SourcePostId",
                table: "GalleryMedia",
                column: "SourcePostId",
                unique: true,
                filter: "\"SourcePostId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GalleryMedia_SourcePostId",
                table: "GalleryMedia");

            migrationBuilder.DropColumn(
                name: "SourcePostId",
                table: "GalleryMedia");

            migrationBuilder.DropColumn(
                name: "SourcePlatform",
                table: "GalleryMedia");
        }
    }
}

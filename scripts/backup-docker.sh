#!/bin/bash

# Docker PostgreSQL Backup Script for DJ-DiP
# This script backs up the PostgreSQL database running in Docker

set -e

# Configuration
BACKUP_DIR="./backups"
CONTAINER_NAME="${POSTGRES_CONTAINER:-djdip-postgres}"
DB_NAME="${POSTGRES_DB:-djdip_db}"
DB_USER="${POSTGRES_USER:-djdip_user}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="djdip_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting Docker PostgreSQL backup for DJ-DiP..."
echo "Container: $CONTAINER_NAME"
echo "Database: $DB_NAME"
echo "Timestamp: $TIMESTAMP"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container $CONTAINER_NAME is not running"
    exit 1
fi

# Create backup
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -F p > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_DIR/$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup created: $BACKUP_DIR/$BACKUP_FILE"

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "Backup size: $BACKUP_SIZE"

# Remove old backups (older than RETENTION_DAYS)
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "djdip_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "djdip_backup_*.sql.gz" -type f | wc -l)
echo "Total backups: $BACKUP_COUNT"

echo "Backup completed successfully!"

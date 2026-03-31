# Database Migrations

This directory contains SQL migration files for the Heretek OpenClaw PostgreSQL database.

## Migration File Format

Each migration file follows this naming convention:

```
{version}_{description}.sql
```

- `version`: Zero-padded 3-digit version number (e.g., `001`, `002`, `003`)
- `description`: Snake-case description of the migration (e.g., `initial_schema`, `add_agent_state`)

## File Structure

Each migration file contains two sections:

```sql
-- Migration: Description of migration
-- Version: 1
-- Created: 2026-03-31
-- Description: Brief description of what this migration does

-- UP
-- Migration SQL goes here
CREATE TABLE example (...);

-- DOWN
-- Rollback SQL goes here
DROP TABLE example;
```

## Available Migrations

| Version | File | Description |
|---------|------|-------------|
| 001 | `001_initial_schema.sql` | Initial database schema with core tables |
| 002 | `002_add_agent_state.sql` | Agent state tracking tables |

## Running Migrations

### Apply all pending migrations

```bash
node scripts/db-migrate.js up
```

### Dry-run (preview without executing)

```bash
node scripts/db-migrate.js up --dry-run
```

### Check migration status

```bash
node scripts/db-migrate.js status
```

### Rollback last migration

```bash
node scripts/db-migrate.js down
```

### Rollback to specific version

```bash
node scripts/db-rollback.js --target 1
```

### Rollback all migrations

```bash
node scripts/db-rollback.js --all
```

### Create new migration

```bash
node scripts/db-migrate.js create --name add_new_table
```

## Environment Variables

Configure database connection using environment variables:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=heretek
export POSTGRES_USER=heretek
export POSTGRES_PASSWORD=your_password
```

## Version Tracking

Migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64)
);
```

## Best Practices

1. **Always provide DOWN SQL** - Every migration should have rollback SQL
2. **Test migrations** - Always test migrations in development before production
3. **Backup first** - Always backup your database before running migrations
4. **Use transactions** - Wrap migrations in transactions when possible
5. **Never modify old migrations** - Create new migrations for schema changes
6. **Use descriptive names** - Migration names should clearly describe the change

## Transaction Support

For migrations that need to be atomic, wrap your SQL in a transaction:

```sql
-- UP
BEGIN;

CREATE TABLE table1 (...);
CREATE TABLE table2 (...);

COMMIT;

-- DOWN
BEGIN;

DROP TABLE table2;
DROP TABLE table1;

COMMIT;
```

## Related Documentation

- [Database Migrations Guide](../docs/operations/DATABASE_MIGRATIONS.md) - Complete migration guide
- [Migration Runner](../scripts/db-migrate.js) - Migration script documentation
- [Rollback Script](../scripts/db-rollback.js) - Rollback script documentation

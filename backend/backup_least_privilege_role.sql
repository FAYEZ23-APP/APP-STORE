-- ==============================================================================
-- Least-Privilege Database Backup Role (marketplace_backup)
-- Project: Egypt Shop (Marketplace MVP)
-- Reference: PostgreSQL Security & Backup Best Practices
--
-- INSTRUCTIONS FOR DATABASE ADMINISTRATOR:
-- 1. Apply this script manually to the production database using a superuser account.
-- 2. Replace 'REPLACE_WITH_STRONG_RANDOM_PASSWORD' with a 32+ character generated secret.
-- 3. Store the credentials securely in the production backup environment variables
--    (PGUSER=marketplace_backup, PGPASSWORD=...).
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketplace_backup') THEN
        CREATE ROLE marketplace_backup WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOINHERIT
            NOREPLICATION
            NOBYPASSRLS
            CONNECTION LIMIT 3
            PASSWORD 'REPLACE_WITH_STRONG_RANDOM_PASSWORD';
    END IF;
END $$;

-- In PostgreSQL 14+, the predefined role pg_read_all_data grants read-only access
-- across all tables, views, and sequences in all schemas without granting write or DDL rights.
GRANT pg_read_all_data TO marketplace_backup;

-- Grant connect on the specific target database
GRANT CONNECT ON DATABASE "MarketplaceMVP" TO marketplace_backup;

-- Ensure the backup user cannot alter schema or create new objects in the public schema
REVOKE CREATE ON SCHEMA public FROM marketplace_backup;

-- Restrict execution of sensitive administrative functions if any exist
ALTER ROLE marketplace_backup SET default_transaction_read_only = on;
ALTER ROLE marketplace_backup SET statement_timeout = '2h';

COMMENT ON ROLE marketplace_backup IS 'Dedicated least-privilege service account for automated encrypted pg_dump operations.';

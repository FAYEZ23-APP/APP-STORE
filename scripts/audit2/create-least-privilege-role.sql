-- ============================================================================
-- scripts/audit2/create-least-privilege-role.sql
-- Least-Privilege Database Role Proposal for Marketplace Application
-- DO NOT EXECUTE DIRECTLY - Review and apply manually by DBA
-- ============================================================================

-- 1. Create dedicated application user role (NO SUPERUSER, NO CREATEDB, NO CREATEROLE)
-- Note: Replace '<STRONG_SECURE_PASSWORD>' with a generated high-entropy secret.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketplace_app') THEN
        CREATE ROLE marketplace_app WITH 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOINHERIT 
            NOREPLICATION 
            PASSWORD '<STRONG_SECURE_PASSWORD>';
    END IF;
END $$;

-- 2. Revoke default public schema create privileges from public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 3. Grant connection privileges to the application database
GRANT CONNECT ON DATABASE "MarketplaceMVP" TO marketplace_app;

-- 4. Grant schema usage (cannot alter schema DDL)
GRANT USAGE ON SCHEMA public TO marketplace_app;

-- 5. Grant strictly required DML operations on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO marketplace_app;

-- 6. Grant sequence operations for identity columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO marketplace_app;

-- 7. Ensure future tables created by migrations retain least-privilege access
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO marketplace_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO marketplace_app;

-- 8. Connection string configuration guidance:
-- Host=db.internal;Port=5432;Database=MarketplaceMVP;Username=marketplace_app;Password=<STRONG_SECURE_PASSWORD>;SSL Mode=Require;Trust Server Certificate=false;

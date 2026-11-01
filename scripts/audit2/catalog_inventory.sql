-- Comprehensive Catalog Inspection for TEST_DB

\echo '=== EXTENSIONS ==='
SELECT extname, extversion FROM pg_extension;

\echo '=== TABLES IN PUBLIC ==='
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo '=== VIEWS IN PUBLIC ==='
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';

\echo '=== COLUMNS ==='
SELECT table_name, column_name, ordinal_position, data_type, udt_name,
       character_maximum_length, numeric_precision, numeric_scale,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

\echo '=== PRIMARY KEYS ==='
SELECT tc.table_name, tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.ordinal_position;

\echo '=== FOREIGN KEYS WITH ON UPDATE / ON DELETE ==='
SELECT 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

\echo '=== INDEXES ==='
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo '=== CHECK CONSTRAINTS ==='
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(c.oid) AS constraint_def
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype = 'c'
ORDER BY table_name, conname;

\echo '=== SEQUENCES ==='
SELECT sequence_schema, sequence_name 
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

\echo '=== TRIGGERS ==='
SELECT event_object_table AS table_name, trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

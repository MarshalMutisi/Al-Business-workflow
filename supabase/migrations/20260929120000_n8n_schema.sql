-- A private schema for a hosted n8n to keep its workflows, credentials and execution history in this database
-- (n8n: DB_TYPE=postgresdb, DB_POSTGRESDB_SCHEMA=n8n). Like `langgraph`, it is outside `public`, so the
-- Supabase REST API never exposes it.
create schema if not exists n8n;
revoke all on schema n8n from anon, authenticated;

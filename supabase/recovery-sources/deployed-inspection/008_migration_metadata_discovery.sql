-- Result set: schemas that may contain migration metadata
select schema_name
from information_schema.schemata
where lower(schema_name) similar to '%(migration|schema|version|history|flyway|prisma|drizzle|knex|liquibase|supabase)%'
order by schema_name;

-- Result set: tables that may contain migration metadata
select table_schema, table_name, table_type
from information_schema.tables
where lower(table_schema || '.' || table_name) similar to '%(migration|schema|version|history|flyway|prisma|drizzle|knex|liquibase|supabase)%'
order by table_schema, table_name;

-- Result set: catalog relations that may contain migration metadata
select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind as relation_kind
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where lower(n.nspname || '.' || c.relname) similar to '%(migration|schema|version|history|flyway|prisma|drizzle|knex|liquibase|supabase)%'
order by schema_name, relation_name;

-- Result set: columns on candidate metadata tables
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where exists (
  select 1
  from information_schema.tables t
  where t.table_schema = c.table_schema
    and t.table_name = c.table_name
    and lower(t.table_schema || '.' || t.table_name) similar to '%(migration|schema|version|history|flyway|prisma|drizzle|knex|liquibase|supabase)%'
)
order by c.table_schema, c.table_name, c.ordinal_position;

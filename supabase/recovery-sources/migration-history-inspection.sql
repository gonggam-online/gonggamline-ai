-- READ ONLY. Run only through an operator-approved Supabase SQL Editor session.

select to_regclass('supabase_migrations.schema_migrations')
  as migration_history_table;

select table_schema,
       table_name,
       ordinal_position,
       column_name,
       data_type,
       is_nullable
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;

select *
from supabase_migrations.schema_migrations
order by version;

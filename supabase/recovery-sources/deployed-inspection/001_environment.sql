-- Result set: environment
select
  current_database() as database_name,
  current_user as database_user,
  current_setting('server_version') as server_version,
  current_setting('server_version_num') as server_version_number,
  now() as inspected_at,
  pg_is_in_recovery() as is_replica
order by database_name, database_user;

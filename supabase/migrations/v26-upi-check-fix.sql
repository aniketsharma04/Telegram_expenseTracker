-- v26: v24's UPI ID checks used {2,256}, but Postgres caps a regex repeat
-- count at 255, so the pattern only failed when a row actually supplied a
-- UPI ID ("invalid regular expression: invalid repetition count(s)") — every
-- save of a UPI ID errored. Real UPI handles are far shorter; 64 is ample.
-- (v24 is fixed in place too, so fresh installs never get the bad pattern.)
alter table users  drop constraint if exists users_upi_id_check;
alter table users  add  constraint users_upi_id_check
  check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,64}$');
alter table people drop constraint if exists people_upi_id_check;
alter table people add  constraint people_upi_id_check
  check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,64}$');

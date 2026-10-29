-- v18: what a goal is for (car, bike, home, gadget, trip, emergency, other),
-- so the app checks it against the right rule of thumb (20/4/10 for vehicles,
-- 20/30/40 for a home, six months for an emergency fund). Null means "work it
-- out from the name", which is what goals made before v18 keep doing.
alter table goals add column if not exists kind text
  check (kind in ('car', 'bike', 'home', 'gadget', 'trip', 'emergency', 'other'));

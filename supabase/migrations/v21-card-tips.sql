-- v21: the "next time here, use this card" line on spend alerts can be
-- turned off from Aaj Cards (Privacy & data) or by turning Cards off.
-- On by default; it only ever appears for someone who named two cards.
alter table card_profiles
  add column if not exists spend_tips boolean not null default true;

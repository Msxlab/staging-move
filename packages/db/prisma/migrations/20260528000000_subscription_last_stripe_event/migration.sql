-- Stripe delivers webhook events at-least-once and out-of-order. Record the
-- `event.created` timestamp of the most recent Stripe event applied to each
-- subscription so the webhook handler can skip a stale retry that would
-- otherwise overwrite newer billing state. Nullable: existing rows have no
-- event applied yet, and the handler treats NULL as "no event seen".
ALTER TABLE `Subscription`
  ADD COLUMN `lastStripeEventAt` DATETIME(3) NULL;

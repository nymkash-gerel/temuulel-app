-- Enable Supabase Realtime for the notifications table
-- This allows the NotificationBell component to receive instant updates
-- instead of polling every 30 seconds.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;          -- already published
  WHEN undefined_object THEN NULL;          -- publication absent (non-Supabase target)
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'realtime: could not add % — enable it from the Supabase dashboard.', 'notifications';
END $$;

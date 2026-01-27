-- Enable Supabase Realtime for the notifications table
-- This allows the NotificationBell component to receive instant updates
-- instead of polling every 30 seconds.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

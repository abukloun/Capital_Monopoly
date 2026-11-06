# Supabase multiplayer security rollout

The browser client uses Supabase Anonymous Sign-Ins. Each browser receives an
Auth user ID; room snapshots are readable only to room members, writable only
by the room owner, and Realtime is limited to members of the matching room.

## Dashboard steps

1. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**.
2. Deploy the updated `index.html`. It remains compatible with the current
   schema until the migration below is applied.
3. Apply `migrations/20261106_secure_anonymous_room_access.sql` to the Capital
   project (`dnrmuzdguwfebchykwrv`).
4. In **Realtime → Settings**, turn off **Allow public access**. Private room
   channels then enforce the `realtime.messages` membership policies.
5. Reload open game tabs so they sign in and join their rooms using the private
   channel configuration.

Room codes are invitations: anyone who knows a valid code can join that room.
The publishable API key does not grant room access on its own.

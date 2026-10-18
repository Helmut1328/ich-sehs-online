/*
  Öffentliche Konfiguration für das Browser-Frontend.
  Hier niemals einen service_role- oder secret-Schlüssel eintragen.
  Die Supabase-URL und der Publishable/anon-Key sind für den Browser gedacht.
*/
window.GAME_CONFIG = {
  SUPABASE_URL: "https://wxymjgjwndavcglgbyq.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "HIER_DEINEN_SUPABASE_PUBLISHABLE_ODER_ANON_KEY_EINTRAGEN",
  TRACKING_FUNCTION_URL: "https://wxymjgjwndavcglgbyq.supabase.co/functions/v1/track-game-view"
};

// One shared Supabase client for every page.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// "Keep me signed in" decides where the login is stored: this device (localStorage) or this tab only (sessionStorage).
const keep = () => { try { return localStorage.getItem('mf_keep') !== '0'; } catch (e) { return true; } };
const storage = {
  getItem: (k) => { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch (e) { return null; } },
  setItem: (k, v) => { try { (keep() ? localStorage : sessionStorage).setItem(k, v); } catch (e) {} },
  removeItem: (k) => { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) {} },
};

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
// verified email, or a Google account
export const confirmed = (u) => !!u && (!!u.email_confirmed_at || (!!u.app_metadata && !!u.app_metadata.provider && u.app_metadata.provider !== 'email'));

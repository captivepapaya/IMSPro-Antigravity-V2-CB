
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Credentials provided by user
const SUPABASE_URL = 'https://qmlvhjhtepryxgnkhyko.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtbHZoamh0ZXByeXhnbmtoeWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NTMzMDgsImV4cCI6MjA4MDAyOTMwOH0.LPM_6FYSTSiPfu_al3W2hb3h5IY-oeQ0THK9ZxgMMbA';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    try {
        supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (error) {
        console.error("Supabase Init Failed:", error);
        throw new Error("Could not initialize Supabase client");
    }
  }
  return supabaseInstance;
};

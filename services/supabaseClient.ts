
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

// IMPORTANT: If you encounter "Invalid API key" errors, please verify:
// 1. The SUPABASE_ANON_KEY in constants.ts matches your Supabase project's public anon key exactly.
// 2. Your Supabase project's Row Level Security (RLS) policies grant 'anon' role permissions for the tables ('requests', 'audits') and actions (SELECT, INSERT, UPDATE, DELETE) your app performs.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

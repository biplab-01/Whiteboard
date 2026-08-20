import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = 'https://baenogvsuhqxkjfcffbn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZW5vZ3ZzdWhxeGtqZmNmZmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjgyMDYsImV4cCI6MjEwMDkwNDIwNn0.ajzcZDgKo4rHlutjkrb7qVsYKU2tlK5nxNpx1Gs6fr8';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

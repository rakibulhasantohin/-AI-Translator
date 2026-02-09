
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.0';

const supabaseUrl = 'https://pieitzdqxngiyovxesht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZWl0emRxeG5naXlvdnhlc2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTUzNTYsImV4cCI6MjA4NjIzMTM1Nn0.TeJKtIVEnJLc8u2U7-0VWPHpxw_6-Bg3ti1__D0sBVc';

export const supabase = createClient(supabaseUrl, supabaseKey);

import Chart from 'chart.js/auto';
import { createClient } from '@supabase/supabase-js';
// Match the global APIs used by the existing static HTML app.
window.Chart = Chart;
window.supabase = { createClient };

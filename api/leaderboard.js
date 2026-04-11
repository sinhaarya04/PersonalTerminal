const { createClient } = require('@supabase/supabase-js');

let supabase = null;
function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return null;
    supabase = createClient(url, key);
  }
  return supabase;
}

module.exports = async function handler(req, res) {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Not configured' });

  const { method } = req;

  // GET /api/leaderboard — all users ranked by return %
  if (method === 'GET') {
    const { data, error } = await db
      .from('leaderboard')
      .select('*')
      .order('total_return_pct', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST /api/leaderboard — upsert a user's portfolio snapshot
  if (method === 'POST') {
    const { user_id, university, total_value, total_return_pct, cash, num_positions } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { data, error } = await db.from('leaderboard').upsert({
      user_id,
      university: university || '',
      total_value: total_value ?? 100000,
      total_return_pct: total_return_pct ?? 0,
      cash: cash ?? 100000,
      num_positions: num_positions ?? 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data?.[0] || {});
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

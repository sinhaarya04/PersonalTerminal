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

  // GET /api/charts?user_id=...&ticker=... (ticker optional)
  if (method === 'GET') {
    const { user_id, ticker } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    let query = db.from('saved_charts').select('*').eq('user_id', user_id);
    if (ticker) query = query.eq('ticker', ticker);
    query = query.order('saved_at', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST /api/charts — upsert a chart
  if (method === 'POST') {
    const { user_id, ticker, drawings, indicators, chart_mode, range } = req.body;
    if (!user_id || !ticker) return res.status(400).json({ error: 'user_id and ticker required' });

    const { data, error } = await db.from('saved_charts').upsert({
      user_id,
      ticker: ticker.toUpperCase(),
      drawings: drawings || [],
      indicators: indicators || [],
      chart_mode: chart_mode || 'CANDLE',
      range: range || '1Y',
      saved_at: new Date().toISOString(),
    }, { onConflict: 'user_id,ticker' }).select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data?.[0] || {});
  }

  // DELETE /api/charts?user_id=...&ticker=...
  if (method === 'DELETE') {
    const { user_id, ticker } = req.query;
    if (!user_id || !ticker) return res.status(400).json({ error: 'user_id and ticker required' });

    const { error } = await db.from('saved_charts').delete().eq('user_id', user_id).eq('ticker', ticker);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

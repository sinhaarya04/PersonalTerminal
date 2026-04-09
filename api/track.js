const { createClient } = require('@supabase/supabase-js');

let supabase = null;
function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // use service role key server-side
    if (!url || !key) return null;
    supabase = createClient(url, key);
  }
  return supabase;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = getSupabase();
  if (!db) {
    return res.status(503).json({ error: 'Analytics not configured' });
  }

  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' });
    }

    // Cap batch size to prevent abuse
    const batch = events.slice(0, 50).map(e => ({
      user_id: String(e.user_id || 'anonymous').slice(0, 255),
      event_type: String(e.event_type || 'unknown').slice(0, 100),
      payload: e.payload || {},
      session_id: String(e.session_id || '').slice(0, 100),
      created_at: e.timestamp || new Date().toISOString(),
    }));

    const { error } = await db.from('events').insert(batch);
    if (error) {
      console.error('Supabase insert error:', error.message);
      return res.status(500).json({ error: 'Failed to store events' });
    }

    res.status(200).json({ ok: true, count: batch.length });
  } catch (err) {
    console.error('Track error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
};

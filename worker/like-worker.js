/*
 * いいね機能の API(Cloudflare Workers + D1)
 *
 *   GET  /likes?ids=a,b,c  … 作品ごとのいいね数を返す  例: {"a": 3, "b": 0}
 *   POST /likes/作品ID      … いいねを1つ増やして、新しい数を返す  例: {"id": "a", "count": 4}
 *
 * いたずら対策
 *   ・サイト(ALLOWED_ORIGIN)以外のページからは使えないようにする(CORS)
 *   ・works_data.json に載っている作品IDだけ受け付ける
 *   ・同じIPアドレスからは、同じ作品に1日1回まで(IPアドレスは IP_SALT を混ぜて暗号化してから保存)
 */
export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    try {
      // いいね数の取得
      if (request.method === 'GET' && url.pathname === '/likes') {
        const ids = (url.searchParams.get('ids') || '').split(',').filter(isValidId).slice(0, 100);
        const counts = Object.fromEntries(ids.map((id) => [id, 0]));
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(',');
          const { results } = await env.DB
            .prepare(`SELECT work_id, count FROM likes WHERE work_id IN (${placeholders})`)
            .bind(...ids).all();
          results.forEach((row) => { counts[row.work_id] = row.count; });
        }
        return json(counts);
      }

      // いいねを増やす
      const match = url.pathname.match(/^\/likes\/([^/]+)$/);
      if (request.method === 'POST' && match) {
        const id = decodeURIComponent(match[1]);
        if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden' }, 403);
        if (!isValidId(id) || !(await isKnownWork(id, env))) return json({ error: 'unknown work' }, 404);

        const ipHash = await hashIP(request.headers.get('CF-Connecting-IP') || '', env.IP_SALT || '');
        const day = new Date().toISOString().slice(0, 10);

        // 今日まだ押していなければ記録して +1(押していたら数は増やさず、今の数だけ返す)
        const logged = await env.DB
          .prepare('INSERT OR IGNORE INTO like_log (work_id, ip_hash, day) VALUES (?, ?, ?)')
          .bind(id, ipHash, day).run();
        if (logged.meta.changes > 0) {
          await env.DB
            .prepare('INSERT INTO likes (work_id, count) VALUES (?, 1) ON CONFLICT(work_id) DO UPDATE SET count = count + 1')
            .bind(id).run();
        }
        const row = await env.DB.prepare('SELECT count FROM likes WHERE work_id = ?').bind(id).first();
        return json({ id, count: row ? row.count : 0 });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: 'server error' }, 500);
    }
  }
};

/*-作品IDとして正しい形か(小文字英数字とハイフン)-*/
function isValidId(id) {
  return /^[a-z0-9-]{1,64}$/.test(id);
}

/*-サイトの works_data.json に載っている作品か(5分間キャッシュして、毎回は取りに行かない)-*/
async function isKnownWork(id, env) {
  const res = await fetch(env.WORKS_DATA_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.items || []).some((item) => item.id === id);
}

/*-IPアドレスをそのまま保存しないよう、秘密の文字列を混ぜて SHA-256 で変換-*/
async function hashIP(ip, salt) {
  const bytes = new TextEncoder().encode(salt + ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

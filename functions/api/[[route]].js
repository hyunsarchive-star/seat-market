// Cloudflare Pages Function: /api/*   (KV 바인딩 이름: SEATS, 비밀 변수: ADMIN_PASSWORD)
const SEATS = new Set(['1-1','1-2','1-3','1-4','2-1','2-2','2-3','2-4','3-1','3-2','3-3','3-4','3-5','4-1','4-2','4-3','4-4','5-1','5-2','5-3','5-4']);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' } });
const clean = v => String(v ?? '').trim().replace(/\s+/g, ' ');

export async function onRequest({ request, env, params }) {
  const route = [].concat(params.route || []).join('/');
  const m = request.method;
  const kv = env.SEATS;
  if (!kv) return json({ error: 'KV 바인딩(SEATS)이 설정되지 않았어요.' }, 500);

  // 학생: 평가 저장 (학생×자리마다 별도 키 → 서로 덮어쓰지 않음)
  if (route === 'rate' && m === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }
    const name = clean(b.name).slice(0, 12).normalize('NFC');
    const reason = clean(b.reason).slice(0, 120);
    const score = Number(b.score);
    if (!name) return json({ error: '이름이 필요해요.' }, 400);
    if (!SEATS.has(b.seat)) return json({ error: '없는 자리예요.' }, 400);
    if (!Number.isInteger(score) || score === 0 || Math.abs(score) > 5) return json({ error: '점수가 올바르지 않아요.' }, 400);
    if (!reason) return json({ error: '이유를 작성해야 해요.' }, 400);
    await kv.put(`r:${b.seat}:${name}`, '1', { metadata: { name, seat: b.seat, score, reason, at: Date.now() } });
    return json({ ok: true });
  }

  // 교사 전용
  if (route === 'results' || route === 'sep') {
    if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD가 설정되지 않았어요.' }, 500);
    if (request.headers.get('x-admin') !== env.ADMIN_PASSWORD) return json({ error: 'unauthorized' }, 401);

    if (route === 'results' && m === 'GET') {
      const ratings = []; let cursor;
      do {
        const l = await kv.list({ prefix: 'r:', cursor });
        l.keys.forEach(k => k.metadata && ratings.push(k.metadata));
        cursor = l.list_complete ? undefined : l.cursor;
      } while (cursor);
      return json({ ratings, sep: (await kv.get('cfg:sep', 'json')) || {} });
    }
    if (route === 'sep' && m === 'PUT') {
      let b; try { b = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }
      const out = {};
      for (const [k, v] of Object.entries(b.sep || {})) if (SEATS.has(k) && Number.isFinite(+v)) out[k] = +v;
      await kv.put('cfg:sep', JSON.stringify(out));
      return json({ ok: true });
    }
  }
  return json({ error: 'not found' }, 404);
}

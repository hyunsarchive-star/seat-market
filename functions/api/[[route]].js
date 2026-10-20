// Cloudflare Pages Function: /api/*   (KV 바인딩: SEATS, 비밀 변수: ADMIN_PASSWORD)
const SEATS = new Set(['1-1','1-2','1-3','1-4','2-1','2-2','2-3','2-4','3-1','3-2','3-3','3-4','3-5','4-1','4-2','4-3','4-4','5-1','5-2','5-3','5-4']);
const MONTHS = [10, 11, 12];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' } });
const clean = v => String(v ?? '').trim().replace(/\s+/g, ' ');
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

async function getConf(kv) {
  return (await kv.get('cfg:conf', 'json')) || {};
}

export async function onRequest({ request, env, params }) {
  const route = [].concat(params.route || []).join('/');
  const m = request.method;
  const kv = env.SEATS;
  if (!kv) return json({ error: 'KV 바인딩(SEATS)이 설정되지 않았어요.' }, 500);

  // 학생: 지금 평가를 받는 달과 마감된 달
  if (route === 'state' && m === 'GET') {
    const c = await getConf(kv);
    return json({ active: c.active || 10, locked: Object.keys(c.fixed || {}).map(Number) });
  }

  // 학생: 평가 저장 (달×자리×학생마다 별도 키 → 서로 덮어쓰지 않음)
  if (route === 'rate' && m === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }
    const name = clean(b.name).slice(0, 12).normalize('NFC');
    const extra = clean(b.extra).slice(0, 100);
    const tags = (Array.isArray(b.tags) ? b.tags : []).map(t => clean(t).slice(0, 40)).filter(Boolean).slice(0, 6);
    const score = Number(b.score);
    if (!name) return json({ error: '이름이 필요해요.' }, 400);
    if (!SEATS.has(b.seat)) return json({ error: '없는 자리예요.' }, 400);
    if (!Number.isInteger(score) || score === 0 || Math.abs(score) > 5) return json({ error: '점수가 올바르지 않아요.' }, 400);
    if (!tags.length && !extra) return json({ error: '이유를 하나 이상 골라 주세요.' }, 400);
    const c = await getConf(kv);
    const month = c.active || 10;
    if (c.fixed && c.fixed[month]) return json({ error: `${month}월 시세가 이미 확정돼서 평가를 받지 않아요.` }, 409);
    const meta = { name, seat: b.seat, month, score, tags, extra, at: Date.now() };
    // KV 메타데이터는 1024바이트까지라서 넘으면 거절
    if (new TextEncoder().encode(JSON.stringify(meta)).length > 1000) return json({ error: '이유가 너무 길어요. 조금 줄여 주세요.' }, 400);
    await kv.put(`r:${month}:${b.seat}:${name}`, '1', { metadata: meta });
    return json({ ok: true, month });
  }

  // 교사 전용
  if (route === 'results' || route === 'conf' || route === 'import') {
    if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD가 설정되지 않았어요.' }, 500);
    if (request.headers.get('x-admin') !== env.ADMIN_PASSWORD) return json({ error: 'unauthorized' }, 401);

    // 처음 데이터 넣기: 교사 화면에서 kv-seed.json 파일을 골라 올리면 여기로 조금씩 나눠서 들어와요
    if (route === 'import' && m === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }
      const items = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
      let n = 0;
      await Promise.all(items.map(async it => {
        const k = String(it && it.key || '');
        if (k !== 'cfg:conf' && !/^r:\d+:[^:]+:.+/.test(k)) return;
        const opt = it.metadata ? { metadata: it.metadata } : undefined;
        await kv.put(k, typeof it.value === 'string' ? it.value : JSON.stringify(it.value ?? '1'), opt);
        n++;
      }));
      return json({ ok: true, n });
    }

    if (route === 'results' && m === 'GET') {
      const best = new Map(); let cursor;
      do {
        const l = await kv.list({ prefix: 'r:', cursor });
        for (const k of l.keys) {
          const d = k.metadata; if (!d) continue;
          const r = { ...d, month: d.month || 10 };
          const id = `${r.month}|${r.seat}|${r.name}`;
          const old = best.get(id);
          if (!old || r.at >= old.at) best.set(id, r);
        }
        cursor = l.list_complete ? undefined : l.cursor;
      } while (cursor);
      return json({ ratings: [...best.values()], conf: await getConf(kv) });
    }

    if (route === 'conf' && m === 'PUT') {
      let b; try { b = await request.json(); } catch { return json({ error: '잘못된 요청이에요.' }, 400); }
      const c = await getConf(kv);
      if (b.sep) {
        const o = {};
        for (const [k, v] of Object.entries(b.sep)) if (SEATS.has(k) && Number.isFinite(+v)) o[k] = +v;
        c.sep = o;
      }
      if (b.params) c.params = { dn: num(b.params.dn, 0, 95, 30), up: num(b.params.up, 0, 500, 70), base: num(b.params.base, 1, 100000, 450) };
      if (b.fixed) {
        const f = {};
        for (const mo of MONTHS) {
          const src = b.fixed[mo];
          if (src && typeof src === 'object') {
            f[mo] = {};
            for (const [k, v] of Object.entries(src)) if (SEATS.has(k) && Number.isFinite(+v)) f[mo][k] = +v;
          }
        }
        c.fixed = f;
      }
      if (b.active !== undefined) {
        if (!MONTHS.includes(+b.active)) return json({ error: '없는 달이에요.' }, 400);
        c.active = +b.active;
      }
      await kv.put('cfg:conf', JSON.stringify(c));
      return json({ ok: true, conf: c });
    }
  }
  return json({ error: 'not found' }, 404);
}

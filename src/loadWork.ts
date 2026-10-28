async function parseMaybeGzip(r: Response): Promise<unknown> {
  // 只读一次响应体：避免 gzip 场景下重新 fetch 造成双倍下载
  const buf = await r.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 2));
  const isGzip = head[0] === 0x1f && head[1] === 0x8b;
  if (!isGzip) return JSON.parse(new TextDecoder().decode(buf));
  const stream = new Blob([buf])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

export async function loadWorkJson(): Promise<unknown> {
  // 优先拉新文件名（绕开 CDN 对旧 work.json.gz 的顽固缓存）
  try {
    const r = await fetch("./app-data.gz");
    if (r.ok) return await parseMaybeGzip(r);
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch("./work.json.gz");
    if (r.ok) return await parseMaybeGzip(r);
  } catch {
    /* fall back to plain json */
  }
  const r = await fetch("./work.json");
  if (!r.ok) throw Error("缺少 work.json");
  return r.json();
}

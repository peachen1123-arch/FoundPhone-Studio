async function parseMaybeGzip(r: Response): Promise<unknown> {
  const text = await r.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(text);
  // 数据是 gzip 二进制（服务器未自动解压），手动解压
  const buf = await (await fetch(r.url)).arrayBuffer();
  const stream = new Blob([buf])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

export async function loadWorkJson(): Promise<unknown> {
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

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

const MEDIA_RE = /^media\/([\w.-]+\.(?:jpe?g|png|webp|gif))$/i;

function collectMediaRefs(node: unknown, out: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectMediaRefs(n, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>))
      collectMediaRefs(v, out);
    return;
  }
  if (typeof node !== "string") return;
  const m = MEDIA_RE.exec(node);
  if (m) out.add(m[1]);
}

async function mediaIntact(data: unknown): Promise<boolean> {
  const files = new Set<string>();
  collectMediaRefs(data, files);
  if (!files.size) return true;
  const results = await Promise.all(
    [...files].map(async (f) => {
      try {
        const r = await fetch(`./media/${f}`, { method: "HEAD" });
        return r.ok;
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}

const DATA_VERSION = "93";

export async function loadWorkJson(): Promise<unknown> {
  // 优先拉新文件名（绕开 CDN 对旧 work.json.gz 的顽固缓存）
  try {
    const r = await fetch("./app-data.gz?v=" + DATA_VERSION);
    if (r.ok) {
      const data = await parseMaybeGzip(r);
      // 瘦身版依赖 media/ 静态资源；若资源缺失（部署不全/缓存异常），
      // 落到内嵌图片的完整版，避免整机图片「集体消失」。
      if (await mediaIntact(data)) return data;
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch("./work.json.gz?v=" + DATA_VERSION);
    if (r.ok) return await parseMaybeGzip(r);
  } catch {
    /* fall back to plain json */
  }
  const r = await fetch("./work.json?v=" + DATA_VERSION);
  if (!r.ok) throw Error("缺少 work.json");
  return r.json();
}

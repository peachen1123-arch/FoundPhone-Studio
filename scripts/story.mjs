import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
const [
  mode = "validate",
  file = process.env.STORY_FILE || "stories/template/story.json",
] = process.argv.slice(2);
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
let source = "",
  json = "",
  lineOffset = 0;
// Map JSON paths to source positions without executing any author code.
function positions(text) {
  let i = 0;
  const out = new Map();
  const ws = () => {
    while (/\s/.test(text[i] || "") && i < text.length) i++;
  };
  const str = () => {
    const a = i++;
    while (i < text.length) {
      if (text[i++] === '"') break;
      if (text[i - 1] === "\\") i++;
    }
    return JSON.parse(text.slice(a, i));
  };
  function value(p) {
    ws();
    out.set(p, i);
    if (text[i] === "{") {
      i++;
      ws();
      while (text[i] !== "}") {
        const key = str();
        ws();
        i++;
        value(p ? p + "." + key : key);
        ws();
        if (text[i] !== ",") break;
        i++;
        ws();
      }
      i++;
    } else if (text[i] === "[") {
      i++;
      ws();
      let n = 0;
      while (text[i] !== "]") {
        value(p + "." + n++);
        ws();
        if (text[i] !== ",") break;
        i++;
        ws();
      }
      i++;
    } else if (text[i] === '"') str();
    else {
      while (i < text.length && !/[\s,}\]]/.test(text[i])) i++;
    }
  }
  value("");
  return out;
}
try {
  source = await readFile(file, "utf8");
  if (Buffer.byteLength(source) > 100 * 1024 * 1024)
    throw Error("脚本不能超过100MB");
  json = source;
  if (/\.md$/i.test(file)) {
    const match = /```json\s*\n([\s\S]*?)```/.exec(source);
    if (!match)
      throw Error(
        "Markdown 需要一个 ```json 剧情数据块；自然语言由创作 AI 转换，不在运行时调用 AI",
      );
    json = match[1];
    lineOffset =
      source.slice(0, match.index + match[0].indexOf(match[1])).split("\n")
        .length - 1;
  }
  const raw = JSON.parse(json);
  const { compileStory, storySchema } = await server.ssrLoadModule(
    "/src/story-engine/compiler.ts",
  );
  const { story, work } = compileStory(raw);
  if (mode === "test" || mode === "build") {
    const { testStory } = await server.ssrLoadModule(
      "/src/story-engine/testStory.ts",
    );
    const errors = testStory(story, work);
    if (errors.length) throw Error(errors.join("\n"));
  }
  if (mode === "schema") {
    const { z } = await import("zod");
    await mkdir("schemas", { recursive: true });
    await writeFile(
      "schemas/story.schema.json",
      JSON.stringify(z.toJSONSchema(storySchema), null, 2) + "\n",
    );
  } else if (mode === "build") {
    await mkdir("public", { recursive: true });
    // 大图抽离：把 >24KB 的 data: 图片挪到 public/media/<hash>.<ext>，
    // 主包只保留引用，避免每次打开都要先下载整包图片。
    const BIG = 24 * 1024;
    const { createHash } = await import("node:crypto");
    const assets = new Map(); // filename -> Buffer
    const walk = (node) => {
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === "object") {
        for (const k of Object.keys(node)) node[k] = walk(node[k]);
        return node;
      }
      if (typeof node !== "string" || !node.startsWith("data:") || node.length < BIG)
        return node;
      const m = /^data:(image\/[a-z+]+);base64,([\s\S]+)$/.exec(node);
      if (!m) return node;
      const buf = Buffer.from(m[2], "base64");
      if (buf.length < BIG) return node;
      const ext = m[1].split("/")[1].replace("jpeg", "jpg");
      const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
      const name = `${hash}.${ext}`;
      assets.set(name, buf);
      return `media/${name}`;
    };
    const slim = walk(structuredClone(work));
    if (assets.size) {
      await mkdir("public/media", { recursive: true });
      for (const [name, buf] of assets) await writeFile(`public/media/${name}`, buf);
    }
    console.log(`  抽离大图 ${assets.size} 张 → public/media/`);
    // 双轨兼容：
    // - app-data.gz：瘦身版（media/ 引用），新前端秒开
    // - work.json / work.json.gz：图片内嵌完整版，兼容手机上未更新的旧 Service Worker
    await writeFile("public/work.json", JSON.stringify(work, null, 2) + "\n");
    const { gzipSync } = await import("node:zlib");
    await writeFile(
      "public/work.json.gz",
      gzipSync(Buffer.from(JSON.stringify(work, null, 2)), { level: 9 }),
    );
    await writeFile(
      "public/app-data.gz",
      gzipSync(Buffer.from(JSON.stringify(slim, null, 2)), { level: 9 }),
    );
    const blank = compileStory(
      JSON.parse(await readFile("stories/blank/story.json", "utf8")),
    ).work;
    await writeFile(
      "public/blank-work.json",
      JSON.stringify(blank, null, 2) + "\n",
    );
    {
      const preview = compileStory(
        JSON.parse(await readFile("stories/test-preview/story.json", "utf8")),
      ).work;
      await writeFile(
        "public/test-work.json",
        JSON.stringify(preview, null, 2) + "\n",
      );
    }
  } else if (!["validate", "test"].includes(mode))
    throw Error("未知命令 " + mode);
  console.log(
    `${file}: ${mode} 通过 (${work.apps.filter((a) => a.installed).length} Apps, ${Object.values(work.data).flat().length} records, ${work.nodes.length} events, ${story.tests.length} paths)`,
  );
} catch (e) {
  let map = new Map();
  try {
    map = positions(json);
  } catch {}
  const issues = e.issues?.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  })) || [{ field: e.field || "", message: e.message }];
  for (const issue of issues) {
    let field = issue.field;
    while (!map.has(field) && field.includes("."))
      field = field.slice(0, field.lastIndexOf("."));
    const syntaxPosition = /position (\d+)/.exec(issue.message);
    const pos = syntaxPosition
      ? Number(syntaxPosition[1])
      : map.get(field) || 0;
    const line = json.slice(0, pos).split("\n").length + lineOffset;
    console.error(`${file}:${line} [${issue.field || "$"}] ${issue.message}`);
  }
  process.exitCode = 1;
} finally {
  await server.close();
}

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Phone } from "../Phone";
import { validateWork, type Work } from "../schema";
import { loadWorkJson } from "../loadWork";
import "../styles.css";
import "./player.css";
function StoryPlayer() {
  const [work, setWork] = useState<Work | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      let x: unknown;
      try {
        const mode = new URLSearchParams(location.search);
        const url =
          mode.get("preview") === "test"
            ? "./test-work.json"
            : mode.get("template") === "blank"
              ? "./blank-work.json"
              : "./work.json.gz";
        if (url === "./work.json.gz") {
          x = await loadWorkJson();
        } else {
          const r = await fetch(url, { signal: abort.signal });
          if (!r.ok) throw Error("缺少作品文件，请刷新重试");
          x = await r.json();
        }
        const w = validateWork(x);
        document.title =
          w.title === "捡手机" ? "捡手机" : w.title + " · 捡手机";
        setWork(w);
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setError(String(e) + "，请刷新重试");
      }
    })();
    return () => abort.abort();
  }, []);
  return (
    <main className="story-runtime">
      {work ? (
        <Phone work={work} />
      ) : (
        <p role="status">{error || "正在打开手机…"}</p>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<StoryPlayer />);

import { parseSections } from "../blocks/utils";
import type { Block, MediaType, Module } from "../types";

export interface ModuleMaterial {
  url: string;
  filename: string;
  type: MediaType;
  moduleTitle: string;
}

function typeFromUrl(url: string): MediaType {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext))
    return "image";
  if (["mp4", "webm", "mov", "ogg", "m4v"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "other";
}

function filenameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split("?")[0].split("/").pop() || "file");
  } catch {
    return url.split("?")[0].split("/").pop() || "file";
  }
}

function collectBlockUrls(
  block: Block,
  out: { url: string; type: MediaType }[],
): void {
  if (block.type === "image" && block.data.url) {
    out.push({ url: block.data.url, type: "image" });
  } else if (block.type === "video" && block.data.url) {
    out.push({ url: block.data.url, type: "video" });
  } else if (block.type === "row") {
    block.data.children.forEach((child) => collectBlockUrls(child.block, out));
  }
}

export function materialsFromModules(modules: Module[]): ModuleMaterial[] {
  const seen = new Set<string>();
  const result: ModuleMaterial[] = [];

  const add = (url: string, moduleTitle: string, type?: MediaType) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push({
      url,
      filename: filenameFromUrl(url),
      type: type ?? typeFromUrl(url),
      moduleTitle,
    });
  };

  for (const m of modules) {
    const title = m.title || "(Untitled module)";

    if (m.heroImageUrl) add(m.heroImageUrl, title, "image");

    for (const section of parseSections(m.meta.module_blocks)) {
      const urls: { url: string; type: MediaType }[] = [];
      section.blocks.forEach((b) => collectBlockUrls(b, urls));
      urls.forEach((u) => add(u.url, title, u.type));

      if (section.heroImage) add(section.heroImage, title, "image");

      for (const qb of section.quizBlocks) {
        if (qb.type === "multiple_choice" && qb.data.imageUrl)
          add(qb.data.imageUrl, title, "image");
      }
    }

    const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRe.exec(m.content ?? "")) !== null) {
      add(match[1], title, "image");
    }
  }

  return result;
}

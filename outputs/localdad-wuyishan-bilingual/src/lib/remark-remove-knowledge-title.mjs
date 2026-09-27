export default function remarkRemoveKnowledgeTitle() {
  return (tree, file) => {
    const filePath = String(file.path ?? "").replaceAll("\\", "/");
    if (!filePath.includes("/src/content/knowledge/")) return;

    const firstContentIndex = tree.children.findIndex((node) => node.type !== "yaml");
    const firstContent = tree.children[firstContentIndex];
    if (firstContent?.type === "heading" && firstContent.depth === 1) tree.children.splice(firstContentIndex, 1);

    const legacyLearningHeadings = new Set(["speaking practice", "guide sentences"]);
    const nodeText = (node) => node?.value ?? (node?.children ?? []).map(nodeText).join("");
    const legacySectionIndexes = tree.children
      .map((node, index) => node?.type === "heading" && node.depth === 2 && legacyLearningHeadings.has(nodeText(node).trim().toLowerCase()) ? index : -1)
      .filter((index) => index >= 0)
      .reverse();
    for (const index of legacySectionIndexes) {
      let end = index + 1;
      while (end < tree.children.length) {
        const next = tree.children[end];
        if (next?.type === "heading" && next.depth <= 2) break;
        end += 1;
      }
      tree.children.splice(index, end - index);
    }
  };
}

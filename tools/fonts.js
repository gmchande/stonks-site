// Marks whether a card draws in JetBrains Mono, the site's own file, at
// every weight its text uses: <html data-fonts="loaded">, or "missing" and
// the weights that did not load. The render scripts read the mark from the
// load that takes the shot, and fail without "loaded".
addEventListener("load", async () => {
  const weights = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    const own = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.data.trim());
    const style = getComputedStyle(el);
    if (own && style.fontFamily.includes("JetBrains Mono")) weights.add(style.fontWeight);
  }
  const missing = [];
  for (const weight of [...weights].sort()) {
    const faces = await document.fonts.load(`${weight} 16px "JetBrains Mono"`).catch(() => []);
    if (!faces.length || faces.some(face => face.status !== "loaded")) missing.push(weight);
  }
  document.documentElement.dataset.fonts = weights.size && !missing.length ? "loaded" : `missing ${missing.join(" ") || "every weight"}`;
});

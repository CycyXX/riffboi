// Small helper for pixel-font text. `size` is the line height in px (8 = 1x, 16 = 2x ...).
// RetroFont's base size is the 6px glyph width, so convert to keep integer pixel scaling.
export function text(scene, x, y, str, size = 8, tint = 0xffffff) {
  const t = scene.add.bitmapText(x, y, 'pixfont', String(str).toUpperCase(), (size / 8) * 6);
  t.setTint(tint);
  if (t.setDropShadow) t.setDropShadow(1, 1, 0x000000, 1);
  return t;
}

// Text contrast (WCAG 2). Phase colors carry white text, so any color a Top
// picks must keep white text at 4.5:1 or better.
function channel(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m)
        return 1;
    const n = parseInt(m[1], 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** Contrast of white text on this color, from 1 to 21. */
export function whiteTextContrast(hex) {
    return 1.05 / (luminance(hex) + 0.05);
}

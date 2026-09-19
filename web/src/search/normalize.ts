/** NFKD 折叠变音符并小写。搜 "Nurnberg" 必须命中 "Nürnberg"。 */
export function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 折叠后按非字母数字切词。连字符也切，"Vision–Language" -> ["vision","language"]。 */
export function tokenize(s: string): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** 展板号识别：M-PM-001 / mpm001 都算。 */
export function asBoardNumber(q: string): string | null {
  const m = fold(q).replace(/[^a-z0-9]/g, '').match(/^([mtw])(am|pm)(\d{1,3})$/);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2].toUpperCase()}-${m[3].padStart(3, '0')}`;
}

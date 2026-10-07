// Code 39 barcode as SVG (財政部手機條碼載具使用 Code 39).
// Each pattern: 9 elements, bar/space alternating starting with a bar; 1 = wide.
const T = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001',
  '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
  'A': '100001001', 'B': '001001001', 'C': '101001000', 'D': '000011001', 'E': '100011000',
  'F': '001011000', 'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011', 'O': '100010010',
  'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110',
  'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000',
  'Z': '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
  '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010',
};

/** 手機條碼格式：「/」開頭 + 7 碼（0-9、A-Z、. - +） */
export const isValidCarrier = (s) => /^\/[0-9A-Z.+-]{7}$/.test(s);

export function code39Svg(text, { narrow = 2, ratio = 3, height = 100, quiet = 10 } = {}) {
  const full = `*${text.toUpperCase()}*`;
  const wide = narrow * ratio;
  let x = quiet;
  const rects = [];
  for (let c = 0; c < full.length; c++) {
    const p = T[full[c]];
    if (!p) throw new Error(`Code 39 不支援字元：${full[c]}`);
    for (let i = 0; i < 9; i++) {
      const w = p[i] === '1' ? wide : narrow;
      if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
      x += w;
    }
    x += narrow; // inter-character gap
  }
  x += quiet - narrow;
  return `<svg viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" role="img" aria-label="條碼 ${text}" xmlns="http://www.w3.org/2000/svg"><rect width="${x}" height="${height}" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
}

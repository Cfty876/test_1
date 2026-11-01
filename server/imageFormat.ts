/** Inspect dimensions without decompressing untrusted pictures on the server. */
export function imageFormat(bytes: Buffer): { type: string; extension: string; width: number; height: number } | null {
  let width = 0, height = 0, type = '', extension = '';
  if (bytes.length >= 33 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16) === 'IHDR') {
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); type = 'image/png'; extension = 'png';
  } else if (bytes.length > 20 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') {
    type = 'image/webp'; extension = 'webp'; const chunk = bytes.toString('ascii',12,16);
    if (chunk === 'VP8X' && bytes.length >= 30) { width = 1 + bytes.readUIntLE(24,3); height = 1 + bytes.readUIntLE(27,3); }
    else if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = bytes.readUInt32LE(21); width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff); }
    else if (chunk === 'VP8 ' && bytes.length >= 30 && bytes.subarray(23,26).equals(Buffer.from([0x9d,0x01,0x2a]))) { width = bytes.readUInt16LE(26) & 0x3fff; height = bytes.readUInt16LE(28) & 0x3fff; }
  } else if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    type = 'image/jpeg'; extension = 'jpg'; let offset = 2;
    while (offset + 4 < bytes.length && offset < 262144) {
      if (bytes[offset++] !== 0xff) return null;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++]; if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const length = bytes.readUInt16BE(offset); if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 8) return null; height = bytes.readUInt16BE(offset+3); width = bytes.readUInt16BE(offset+5); break;
      }
      offset += length;
    }
  }
  return width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 20_000_000 ? { type, extension, width, height } : null;
}

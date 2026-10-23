// src/utils/image.js
// Nhận diện ảnh theo nội dung tệp (không tin phần mở rộng hay kiểu tệp do máy khách gửi) và đọc kích thước – mục 4.9.5, 4.10.6

/**
 * Trả về kiểu ảnh, phần mở rộng và kích thước; không phải ảnh JPG/PNG/WEBP thì trả null.
 */
export function inspectImage(buf) {
  if (!buf || buf.length < 12) return null;

  // PNG: bắt đầu bằng 89 50 4E 47, chiều rộng/cao nằm ở byte 16–23
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: 'image/png', ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: bắt đầu bằng FF D8, kích thước nằm trong đoạn đánh dấu SOF
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) { offset++; continue; }
      const marker = buf[offset + 1];
      const size = buf.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', ext: 'jpg', width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + size;
    }
    return { mime: 'image/jpeg', ext: 'jpg', width: null, height: null };
  }

  // WEBP: bắt đầu bằng "RIFF" và có chữ "WEBP" ở byte 8–11
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    let width = null;
    let height = null;
    if (chunk === 'VP8X' && buf.length >= 30) {
      width = 1 + buf.readUIntLE(24, 3);
      height = 1 + buf.readUIntLE(27, 3);
    } else if (chunk === 'VP8 ' && buf.length >= 30) {
      width = buf.readUInt16LE(26) & 0x3fff;
      height = buf.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    return { mime: 'image/webp', ext: 'webp', width, height };
  }

  return null;
}

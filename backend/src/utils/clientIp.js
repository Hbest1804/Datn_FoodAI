// src/utils/clientIp.js
// IP thật của người dùng để giới hạn tần suất / hạn mức khách.
// Bản chạy thật đứng sau Cloudflare → Nginx → backend: req.ip (theo "trust proxy") chỉ ra IP của proxy,
// khiến mọi người dùng bị tính chung một IP. Cloudflare ghi IP thật vào CF-Connecting-IP nên ưu tiên header này.

import net from 'node:net';

export function getClientIp(req) {
  const cf = req.headers?.['cf-connecting-ip'];
  const cfIp = typeof cf === 'string' ? cf.trim() : '';
  if (cfIp && net.isIP(cfIp)) return cfIp;
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

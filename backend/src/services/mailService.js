// src/services/mailService.js
// Gửi thư điện tử qua máy chủ thư SMTP (mã đặt lại mật khẩu – mục 4.1.5)

import nodemailer from 'nodemailer';
import { env } from '../config/appConfig.js';

let transporter = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/**
 * Gửi mã đặt lại mật khẩu. Chưa cấu hình máy chủ thư: môi trường phát triển in mã ra nhật ký để thử nghiệm,
 * môi trường chạy thật ném lỗi để API trả 502 EMAIL_SEND_FAILED.
 */
export async function sendPasswordResetEmail(to, code, link) {
  const tx = getTransporter();
  if (!tx) {
    if (env.nodeEnv === 'production') throw new Error('SMTP chưa được cấu hình');
    console.log(`📧 [Dev] Chưa cấu hình SMTP – mã đặt lại mật khẩu cho ${to}: ${code} (${link})`);
    return;
  }
  await tx.sendMail({
    from: env.smtp.from,
    to,
    subject: 'Mã đặt lại mật khẩu – Trợ lý ẩm thực',
    text: `Mã đặt lại mật khẩu của bạn là: ${code}\nHoặc mở liên kết: ${link}\nMã có hiệu lực trong 15 phút và chỉ dùng được một lần.\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Mã đặt lại mật khẩu của bạn là:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>`
      + `<p>Hoặc <a href="${link}">bấm vào đây</a> để đặt mật khẩu mới.</p>`
      + '<p>Mã có hiệu lực trong 15 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>',
  });
}

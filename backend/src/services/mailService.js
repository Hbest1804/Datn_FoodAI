// src/services/mailService.js
// Gửi thư điện tử qua máy chủ thư SMTP (mã đặt lại mật khẩu – mục 4.1.5)

import nodemailer from 'nodemailer';
import { env } from '../config/appConfig.js';
import { renderPasswordResetEmail } from '../templates/passwordResetEmail.js';

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
export async function sendPasswordResetEmail(to, code, link, name) {
  const tx = getTransporter();
  if (!tx) {
    if (env.nodeEnv === 'production') throw new Error('SMTP chưa được cấu hình');
    console.log(`📧 [Dev] Chưa cấu hình SMTP – mã đặt lại mật khẩu cho ${to}: ${code} (${link})`);
    return;
  }
  const { subject, html, text } = renderPasswordResetEmail({ code, link, name });
  await tx.sendMail({ from: env.smtp.from, to, subject, text, html });
}

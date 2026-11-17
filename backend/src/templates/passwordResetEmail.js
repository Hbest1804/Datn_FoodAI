// src/templates/passwordResetEmail.js
// Giao diện email đặt lại mật khẩu (ChefAI).
//
// Bố cục dùng bảng + style nội tuyến để hiển thị đẹp trên mọi ứng dụng thư (Gmail, Outlook…).
// Hiệu ứng chuyển động (@keyframes) là phần tăng cường: chạy trên Apple Mail / iOS Mail,
// Thunderbird, Samsung Mail, Outlook.com…; ứng dụng không hỗ trợ (Gmail, Outlook desktop)
// vẫn thấy bản tĩnh đầy đủ vì trạng thái cuối của mọi hiệu ứng trùng với style nội tuyến.

const BRAND = {
  name: 'ChefAI',
  tagline: 'Trợ lý ẩm thực Việt',
  primary: '#ea580c',
  primaryDark: '#c2410c',
  accent: '#fed7aa',
  hero: '#431407',
  bg: '#fff7ed',
  text: '#1c1917',
  muted: '#78716c',
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLE = `
  @keyframes floatY { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(6deg); } }
  @keyframes steam { 0% { opacity: 0; transform: translateY(8px) scaleY(.6); } 40% { opacity: .9; } 100% { opacity: 0; transform: translateY(-22px) scaleY(1.2); } }
  @keyframes popIn { 0% { opacity: 0; transform: translateY(14px) scale(.6); } 70% { opacity: 1; transform: translateY(-3px) scale(1.08); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shimmer { 0% { background-position: -220px 0; } 100% { background-position: 220px 0; } }
  @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(253,186,116,.55); } 70% { box-shadow: 0 0 0 16px rgba(253,186,116,0); } 100% { box-shadow: 0 0 0 0 rgba(253,186,116,0); } }
  @keyframes glow { 0%,100% { text-shadow: 0 0 0 rgba(234,88,12,0); } 50% { text-shadow: 0 0 14px rgba(234,88,12,.35); } }
  @keyframes tick { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
  @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

  .hero { background-size: 220% 220% !important; animation: gradientMove 9s ease infinite; }
  .float1 { display: inline-block; animation: floatY 3.2s ease-in-out infinite; }
  .float2 { display: inline-block; animation: floatY 3.8s ease-in-out .6s infinite; }
  .float3 { display: inline-block; animation: floatY 4.2s ease-in-out 1.2s infinite; }
  .steam span { display: inline-block; animation: steam 2.4s ease-out infinite; }
  .steam span:nth-child(2) { animation-delay: .5s; }
  .steam span:nth-child(3) { animation-delay: 1s; }
  .bowl { display: inline-block; animation: pulseRing 2.6s ease-out infinite; }
  .fade1 { animation: fadeUp .7s ease-out .1s both; }
  .fade2 { animation: fadeUp .7s ease-out .3s both; }
  .fade3 { animation: fadeUp .7s ease-out 1.5s both; }
  .fade4 { animation: fadeUp .7s ease-out 1.8s both; }
  .digit { animation: popIn .55s cubic-bezier(.2,.9,.3,1.3) both, glow 3s ease-in-out 2s infinite; }
  .d1 { animation-delay: .5s, 2s; } .d2 { animation-delay: .62s, 2.1s; } .d3 { animation-delay: .74s, 2.2s; }
  .d4 { animation-delay: .86s, 2.3s; } .d5 { animation-delay: .98s, 2.4s; } .d6 { animation-delay: 1.1s, 2.5s; }
  .btn { background-image: linear-gradient(110deg, ${BRAND.primary} 0%, ${BRAND.primary} 40%, #fb923c 50%, ${BRAND.primary} 60%, ${BRAND.primary} 100%) !important;
         background-size: 440px 100% !important; animation: shimmer 2.8s linear infinite; }
  .btn:hover { background-color: ${BRAND.primaryDark} !important; }
  .clock { display: inline-block; animation: tick 1.6s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }
  @media only screen and (max-width: 520px) {
    .container { width: 100% !important; }
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .digit { width: 38px !important; height: 50px !important; font-size: 26px !important; }
    .h1 { font-size: 24px !important; }
  }
`;

/**
 * @param {{ code: string, link: string, name?: string, minutes?: number, maxAttempts?: number }} p
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderPasswordResetEmail({ code, link, name, minutes = 15, maxAttempts = 5 }) {
  const safeName = escapeHtml(name || 'bạn');
  const safeLink = escapeHtml(link);
  const digits = String(code).split('');
  const year = new Date().getFullYear();

  const digitCells = digits.map((d, i) => `
            <td style="padding:0 4px;">
              <div class="digit d${i + 1}" style="width:46px;height:58px;line-height:58px;border-radius:14px;background:#ffffff;border:2px solid #fed7aa;
                   box-shadow:0 6px 16px rgba(234,88,12,.12);font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:30px;font-weight:800;
                   color:${BRAND.primary};text-align:center;">${escapeHtml(d)}</div>
            </td>`).join('');

  const subject = `🔐 Đặt lại mật khẩu ${BRAND.name} của bạn`;

  const html = `<!doctype html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>Đặt lại mật khẩu</title>
  <style>${STYLE}</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased;">
  <!-- Dòng xem trước trong hộp thư -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Mã xác nhận của bạn đã sẵn sàng – hiệu lực ${minutes} phút. Đừng chia sẻ mã với ai nhé.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:32px 12px;">

      <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0"
             style="width:560px;max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(67,20,7,.12);
                    font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

        <!-- HERO -->
        <tr><td class="hero" align="center"
                style="background-color:${BRAND.hero};background-image:linear-gradient(135deg,${BRAND.hero} 0%,#9a3412 45%,${BRAND.primary} 100%);padding:34px 24px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="font-size:22px;opacity:.9;"><span class="float1">🌿</span></td>
              <td align="center">
                <div style="font-size:15px;font-weight:800;letter-spacing:3px;color:${BRAND.accent};">${BRAND.name.toUpperCase()}</div>
                <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:2px;">${BRAND.tagline}</div>
              </td>
              <td align="right" style="font-size:22px;opacity:.9;"><span class="float2">🥢</span></td>
            </tr>
          </table>

          <div class="steam" style="height:26px;margin-top:18px;font-size:16px;color:rgba(255,255,255,.7);letter-spacing:6px;">
            <span>〰</span><span>〰</span><span>〰</span>
          </div>
          <div class="bowl" style="width:96px;height:96px;line-height:96px;border-radius:50%;background:rgba(253,186,116,.14);border:2px solid rgba(253,186,116,.45);font-size:48px;text-align:center;">🍜</div>

          <div class="fade1">
            <h1 class="h1" style="margin:22px 0 6px;font-size:28px;line-height:1.25;color:#ffffff;font-weight:800;">Quên mật khẩu? Chuyện nhỏ! <span class="float3">✨</span></h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:rgba(255,255,255,.78);">Mình nấu lại cho bạn một chiếc chìa khóa mới ngay đây.</p>
          </div>
        </td></tr>

        <!-- BODY -->
        <tr><td class="px" style="padding:34px 40px 8px;">
          <p class="fade2" style="margin:0 0 6px;font-size:16px;color:${BRAND.text};">Xin chào <strong>${safeName}</strong> 👋</p>
          <p class="fade2" style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${BRAND.muted};">
            Chúng tôi vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND.name} của bạn. Hãy nhập mã dưới đây vào ứng dụng:
          </p>

          <!-- CODE -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:linear-gradient(180deg,#fff7ed 0%,#ffedd5 100%);background-color:#fff3e6;border:1px dashed #fdba74;border-radius:20px;">
            <tr><td align="center" style="padding:22px 10px 8px;font-size:12px;font-weight:700;letter-spacing:2px;color:${BRAND.primary};">MÃ XÁC NHẬN CỦA BẠN</td></tr>
            <tr><td align="center" style="padding:6px 10px 14px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${digitCells}
              </tr></table>
            </td></tr>
            <tr><td align="center" style="padding:0 10px 20px;font-size:13px;color:${BRAND.muted};">
              <span class="clock">⏳</span>&nbsp; Hết hạn sau <strong style="color:${BRAND.text};">${minutes} phút</strong>
            </td></tr>
          </table>

          <!-- DIVIDER -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="fade3" style="margin:26px 0 22px;">
            <tr>
              <td width="45%" style="border-top:1px solid #fde4cc;font-size:0;line-height:0;">&nbsp;</td>
              <td align="center" style="padding:0 12px;font-size:12px;color:#94a3b8;white-space:nowrap;">hoặc</td>
              <td width="45%" style="border-top:1px solid #fde4cc;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>

          <!-- BUTTON -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="fade3">
            <tr><td align="center" style="border-radius:999px;background:${BRAND.primary};box-shadow:0 10px 24px rgba(234,88,12,.32);">
              <a href="${safeLink}" target="_blank" class="btn"
                 style="display:inline-block;padding:16px 38px;border-radius:999px;background-color:${BRAND.primary};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:.3px;">
                Đặt mật khẩu mới &nbsp;→
              </a>
            </td></tr>
          </table>

          <!-- TIPS -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="fade4" style="margin:30px 0 8px;background:#fffaf5;border-radius:16px;">
            <tr><td style="padding:18px 20px;font-size:13px;line-height:1.7;color:${BRAND.muted};">
              <div style="font-weight:700;color:${BRAND.text};margin-bottom:6px;">🛡️ Lưu ý an toàn</div>
              • Mã chỉ dùng được <strong>một lần</strong> và bị hủy nếu nhập sai <strong>${maxAttempts} lần</strong>.<br>
              • ${BRAND.name} <strong>không bao giờ</strong> hỏi mã này qua điện thoại hay tin nhắn.<br>
              • Không phải bạn yêu cầu? Cứ bỏ qua email này – mật khẩu hiện tại vẫn an toàn.
            </td></tr>
          </table>

          <p class="fade4" style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;word-break:break-all;">
            Nút không hoạt động? Sao chép liên kết sau vào trình duyệt:<br>
            <a href="${safeLink}" style="color:${BRAND.primary};">${safeLink}</a>
          </p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td align="center" class="px" style="padding:26px 40px 30px;">
          <div style="font-size:20px;letter-spacing:8px;">🍲🥗🍤🍰</div>
          <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
            Chúc bạn nấu ăn vui vẻ! — Đội ngũ ${BRAND.name}<br>
            © ${year} ${BRAND.name} · Email tự động, vui lòng không trả lời.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Xin chào ${name || 'bạn'},`,
    '',
    `Mã đặt lại mật khẩu ${BRAND.name} của bạn là: ${code}`,
    `Hoặc mở liên kết: ${link}`,
    '',
    `Mã có hiệu lực trong ${minutes} phút, chỉ dùng được một lần và bị hủy nếu nhập sai ${maxAttempts} lần.`,
    'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    '',
    `— Đội ngũ ${BRAND.name}`,
  ].join('\n');

  return { subject, html, text };
}

import React from 'react';

/**
 * Tô cơm trắng vẽ bằng SVG (bát sứ men trắng viền xanh, cơm vun đầy, đôi đũa gác bên).
 * Dùng ở tâm vòng món ăn xoay trên banner trang chủ; không tải ảnh nên hiện ngay.
 */
export const RiceBowl: React.FC<{ size?: number }> = ({ size = 170 }) => (
  <svg width={size} height={size * 0.86} viewBox="0 0 200 172" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="rb-rice" cx="45%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="70%" stopColor="#F6F1E7" />
        <stop offset="100%" stopColor="#E7DDCB" />
      </radialGradient>
      <linearGradient id="rb-bowl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E3E8F2" />
      </linearGradient>
      <linearGradient id="rb-chop" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#7C2D12" />
      </linearGradient>
    </defs>

    {/* Đôi đũa cắm sau tô, ló lên phía trên bên phải */}
    <line x1="120" y1="80" x2="176" y2="4" stroke="url(#rb-chop)" strokeWidth="6" strokeLinecap="round" />
    <line x1="132" y1="82" x2="192" y2="14" stroke="url(#rb-chop)" strokeWidth="6" strokeLinecap="round" />

    {/* Cơm vun đầy, có vài hạt rời */}
    <path d="M30 86 C34 44 70 30 100 30 C130 30 166 44 170 86 Z" fill="url(#rb-rice)" />
    {[
      [70, 52, -20], [88, 44, 10], [108, 46, -8], [126, 54, 22], [80, 66, 35],
      [100, 60, -30], [120, 70, 15], [62, 72, 5], [140, 74, -25], [96, 76, 40],
    ].map(([x, y, r], i) => (
      <ellipse key={i} cx={x} cy={y} rx="4.2" ry="2.1" transform={`rotate(${r} ${x} ${y})`} fill="#FFFFFF" stroke="#E8DCC6" strokeWidth="0.8" />
    ))}

    {/* Thân tô */}
    <path d="M18 84 H182 C180 124 146 150 100 150 C54 150 20 124 18 84 Z" fill="url(#rb-bowl)" />
    <path d="M18 84 H182" stroke="#1D4ED8" strokeWidth="4" strokeLinecap="round" />
    <path d="M28 98 H172" stroke="#1D4ED8" strokeWidth="1.6" strokeOpacity="0.55" />
    {/* Họa tiết hoa văn xanh trên thân */}
    {[56, 100, 144].map((x) => (
      <g key={x} transform={`translate(${x} 118)`} stroke="#2563EB" strokeWidth="1.8" fill="none" strokeLinecap="round">
        <circle r="6" />
        <path d="M-12 0 C-8 -6 -4 -6 0 0 C4 6 8 6 12 0" />
      </g>
    ))}
    {/* Đế tô */}
    <path d="M74 148 H126 L122 160 H78 Z" fill="#DCE3EF" />
    <path d="M78 160 H122" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round" />
    {/* Ánh sáng phản chiếu */}
    <path d="M36 96 C40 116 54 132 72 140" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeOpacity="0.8" />
  </svg>
);

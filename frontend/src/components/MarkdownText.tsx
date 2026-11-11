import React from 'react';

// Hiển thị câu trả lời Markdown của chatbot (in đậm, in nghiêng, tiêu đề, danh sách) bằng phần tử React.
// Không dùng innerHTML nên nội dung do mô hình sinh ra không thể chèn mã vào trang.

/** Chữ trong một dòng: **đậm**, *nghiêng*, `mã`. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[1] !== undefined) nodes.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={key}>{match[2]}</em>);
    else nodes.push(<code key={key} className="px-1 rounded bg-slate-200/70">{match[3]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const key = `l-${idx}`;
        if (!line.trim()) return <div key={key} className="h-1.5" />;

        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        if (heading) return <div key={key} className="font-bold">{renderInline(heading[1], key)}</div>;

        // Thụt lề theo số khoảng trắng đầu dòng để giữ cấp của danh sách lồng nhau
        const indent = Math.min(3, Math.floor((line.match(/^\s*/)?.[0].length || 0) / 2));
        const style = indent ? { marginLeft: `${indent * 0.9}rem` } : undefined;

        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={key} className="flex gap-2" style={style}>
              <span className="shrink-0">•</span>
              <span className="min-w-0">{renderInline(bullet[1], key)}</span>
            </div>
          );
        }

        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (numbered) {
          return (
            <div key={key} className="flex gap-2" style={style}>
              <span className="shrink-0 font-semibold">{numbered[1]}.</span>
              <span className="min-w-0">{renderInline(numbered[2], key)}</span>
            </div>
          );
        }

        return <div key={key} style={style}>{renderInline(line.trim(), key)}</div>;
      })}
    </div>
  );
};

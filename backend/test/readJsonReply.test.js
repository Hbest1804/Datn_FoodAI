// test/readJsonReply.test.js
// Đọc JSON trả lời của Gemini: không bao giờ để chuỗi JSON thô lọt ra giao diện chatbot

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonReply } from '../src/services/aiService.js';

const full = '{"outcome":"answered","content":"Chào bạn!\\n\\nGợi ý **Cơm tấm**.","matched_dish_ids":["a1"]}';

describe('readJsonReply', () => {
  it('JSON hợp lệ', () => {
    const { parsed } = readJsonReply(full);
    assert.equal(parsed.content, 'Chào bạn!\n\nGợi ý **Cơm tấm**.');
    assert.deepEqual(parsed.matched_dish_ids, ['a1']);
  });

  it('có rào ```json hoặc chữ thừa trước/sau', () => {
    for (const t of ['```json\n' + full + '\n```', 'Đây là kết quả:\n' + full + '\nHết.']) {
      assert.equal(readJsonReply(t).parsed.outcome, 'answered', t);
    }
  });

  it('bị cắt giữa chừng (chạm giới hạn token)', () => {
    const { parsed } = readJsonReply('{\n  "outcome": "answered",\n  "content": "Chào bạn! Với mục tiêu **2500 kcal**,\\n\\nbữa sáng nên');
    assert.equal(parsed.outcome, 'answered');
    assert.equal(parsed.content, 'Chào bạn! Với mục tiêu **2500 kcal**,\n\nbữa sáng nên…');
  });

  it('dấu " chưa thoát trong content', () => {
    const { parsed } = readJsonReply('{"outcome":"answered","content":"Món "chữa cháy" nhanh","matched_dish_ids":[]}');
    assert.equal(parsed.content, 'Món "chữa cháy" nhanh');
  });

  it('văn bản thường (không phải JSON) thì parsed = null', () => {
    assert.equal(readJsonReply('Xin chào, tôi chỉ hỗ trợ nấu ăn.').parsed, null);
  });
});

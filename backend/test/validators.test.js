// test/validators.test.js
// Unit tests cho các hàm validators cốt lõi trong backend

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, isStrongPassword, sanitizeSearchKeyword } from '../src/utils/validators.js';

describe('Validators Unit Tests', () => {
  describe('isValidEmail', () => {
    it('chấp nhận email hợp lệ', () => {
      assert.strictEqual(isValidEmail('admin@culina.ai'), true);
      assert.strictEqual(isValidEmail('user.test+tag@domain.com.vn'), true);
    });

    it('từ chối email không hợp lệ', () => {
      assert.strictEqual(isValidEmail('invalid-email'), false);
      assert.strictEqual(isValidEmail(''), false);
      assert.strictEqual(isValidEmail(null), false);
      assert.strictEqual(isValidEmail(undefined), false);
      assert.strictEqual(isValidEmail('@nodomain.com'), false);
    });
  });

  describe('isStrongPassword', () => {
    it('chấp nhận mật khẩu hợp lệ (>=8 ký tự, gồm chữ hoa, thường và số)', () => {
      assert.strictEqual(isStrongPassword('Admin@123'), true);
      assert.strictEqual(isStrongPassword('Passw0rd'), true);
      assert.strictEqual(isStrongPassword('Abcd12345'), true);
    });

    it('từ chối mật khẩu dưới 8 ký tự', () => {
      assert.strictEqual(isStrongPassword('Abc12'), false);
      assert.strictEqual(isStrongPassword('Abc1234'), false);
    });

    it('từ chối mật khẩu thiếu chữ hoa hoặc chữ thường hoặc số', () => {
      assert.strictEqual(isStrongPassword('alllowercase123'), false); // thiếu hoa
      assert.strictEqual(isStrongPassword('ALLUPPERCASE123'), false); // thiếu thường
      assert.strictEqual(isStrongPassword('NoDigitsHere!'), false);   // thiếu số
      assert.strictEqual(isStrongPassword(''), false);
      assert.strictEqual(isStrongPassword(null), false);
    });
  });

  describe('sanitizeSearchKeyword', () => {
    it('làm sạch các ký tự đặc biệt nguy hiểm để chống PostgREST filter injection', () => {
      const malicious = 'thịt bò,is_deleted.eq.true)%';
      const cleaned = sanitizeSearchKeyword(malicious);
      assert.strictEqual(cleaned, 'thịt bòis_deletedeqtrue');
      assert.strictEqual(cleaned.includes(','), false);
      assert.strictEqual(cleaned.includes('('), false);
      assert.strictEqual(cleaned.includes(')'), false);
      assert.strictEqual(cleaned.includes('.'), false);
      assert.strictEqual(cleaned.includes('%'), false);
    });

    it('xử lý chuỗi rỗng và kiểu dữ liệu không hợp lệ an toàn', () => {
      assert.strictEqual(sanitizeSearchKeyword(null), '');
      assert.strictEqual(sanitizeSearchKeyword(undefined), '');
      assert.strictEqual(sanitizeSearchKeyword(123), '');
      assert.strictEqual(sanitizeSearchKeyword('   rau cải   '), 'rau cải');
    });

    it('cắt ngắn từ khóa vượt quá 100 ký tự', () => {
      const longStr = 'a'.repeat(150);
      assert.strictEqual(sanitizeSearchKeyword(longStr).length, 100);
    });
  });
});

// test/resetCredentials.test.js
// Kiểm tra đầu vào của POST /auth/reset-password/verify và POST /auth/reset-password (UC15, FR-16)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseResetCredentials } from '../src/utils/validators.js';

const LINK_TOKEN = 'Q2hlZkFJLXJlc2V0LXRva2VuLTMyLWJ5dGVzLWJhc2U2NA';

describe('parseResetCredentials', () => {
  it('nhận token dài trong liên kết email', () => {
    assert.deepEqual(parseResetCredentials({ token: ` ${LINK_TOKEN} ` }), { credentials: { token: LINK_TOKEN } });
  });

  it('nhận email + mã 6 số', () => {
    assert.deepEqual(parseResetCredentials({ email: 'thien@example.com', code: '012345' }), {
      credentials: { email: 'thien@example.com', code: '012345' },
    });
  });

  it('từ chối mã 6 số gửi một mình (không kèm email)', () => {
    const { errors } = parseResetCredentials({ code: '012345' });
    assert.deepEqual(errors.map((e) => e.field), ['email']);
  });

  it('từ chối mã 6 số đặt vào trường token như cách cũ', () => {
    const { errors } = parseResetCredentials({ token: '012345' });
    assert.equal(errors[0].field, 'token');
  });

  it('từ chối mã không phải 6 chữ số', () => {
    for (const code of ['12345', '1234567', '12a456', 123456]) {
      const { errors } = parseResetCredentials({ email: 'thien@example.com', code });
      assert.deepEqual(errors.map((e) => e.field), ['code'], `code=${code}`);
    }
  });

  it('body rỗng báo thiếu cả email và mã', () => {
    const { errors } = parseResetCredentials(undefined);
    assert.deepEqual(errors.map((e) => e.field), ['email', 'code']);
  });
});

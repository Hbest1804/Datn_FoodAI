// src/middlewares/uploadMiddleware.js
// Nhận tệp gửi dạng biểu mẫu (trường "file") bằng thư viện multer, giữ trong bộ nhớ.
// Nội dung ảnh được kiểm tra lại theo các byte đầu tệp ở tầng xử lý.

import multer from 'multer';
import { sendError } from '../utils/http.js';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function createUpload({ maxBytes, accept, typeMessage }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!accept(file)) {
        const err = new Error(typeMessage);
        err.code = 'UNSUPPORTED_MEDIA_TYPE';
        return cb(err);
      }
      cb(null, true);
    },
  }).single('file');

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 413, 'FILE_TOO_LARGE', `Tệp vượt dung lượng cho phép (tối đa ${maxBytes / 1024 / 1024} MB).`);
      }
      if (err.code === 'UNSUPPORTED_MEDIA_TYPE') return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', err.message);
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return sendError(res, 422, 'VALIDATION_ERROR', 'Chỉ gửi một tệp trong trường "file".');
      }
      return next(err);
    });
  };
}

const imageOnly = (file) => IMAGE_MIME_TYPES.includes(file.mimetype);
const IMAGE_MESSAGE = 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.';

/** 4.9.5 Ảnh đại diện: tối đa 2 MB */
export const handleAvatarUpload = createUpload({ maxBytes: 2 * 1024 * 1024, accept: imageOnly, typeMessage: IMAGE_MESSAGE });

/** 4.10.6 Ảnh món ăn: tối đa 5 MB */
export const handleDishImageUpload = createUpload({ maxBytes: 5 * 1024 * 1024, accept: imageOnly, typeMessage: IMAGE_MESSAGE });

/** 4.10.8 File nhập món: .xlsx hoặc .csv, tối đa 5 MB */
export const handleImportUpload = createUpload({
  maxBytes: 5 * 1024 * 1024,
  accept: (file) => /\.(xlsx|csv)$/i.test(file.originalname || ''),
  typeMessage: 'File phải là .xlsx hoặc .csv.',
});

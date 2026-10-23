// src/middlewares/uploadMiddleware.js
// Middleware xử lý tải tệp ảnh từ máy lên (multipart/form-data) bằng multer

import multer from 'multer';

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Upload Avatar người dùng (Mục 5.6.1):
 * Tối đa 2MB, định dạng JPG/PNG/WEBP. Trường: 'file'.
 */
const avatarMulter = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error('Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPG, PNG hoặc WEBP.');
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      err.status = 415;
      return cb(err, false);
    }
    cb(null, true);
  },
}).single('file');

export function handleAvatarUpload(req, res, next) {
  avatarMulter(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Ảnh vượt dung lượng cho phép (tối đa 2 MB).',
          },
        });
      }
      if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        return res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: err.message,
          },
        });
      }
      return next(err);
    }
    next();
  });
}

/**
 * Upload Ảnh món ăn / danh mục (Mục 4.10.6):
 * Tối đa 5MB, định dạng JPG/PNG/WEBP. Trường: 'file'.
 */
const dishMulter = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error('Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPG, PNG hoặc WEBP.');
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      err.status = 415;
      return cb(err, false);
    }
    cb(null, true);
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

export function handleDishImageUpload(req, res, next) {
  dishMulter(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Ảnh vượt dung lượng cho phép (tối đa 5 MB).',
          },
        });
      }
      if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        return res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: err.message,
          },
        });
      }
      return next(err);
    }
    if (!req.file && req.files) {
      req.file = req.files['file']?.[0] || req.files['image']?.[0] || null;
    }
    next();
  });
}

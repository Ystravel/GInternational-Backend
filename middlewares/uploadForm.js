import multer from 'multer'
// import { v2 as cloudinary } from 'cloudinary'
// import { CloudinaryStorage } from 'multer-storage-cloudinary'
import path from 'path'
import fs from 'fs'
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_NAME,
//   api_key: process.env.CLOUDINARY_KEY,
//   api_secret: process.env.CLOUDINARY_SECRET
// })

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'forms', // 指定存放表單的資料夾
//     allowed_formats: ['pdf'],
//     resource_type: 'raw' // 設定為 raw 以支援 PDF 檔案
// 設定存儲位置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.env.UPLOAD_PATH, 'forms')
    // 確保目錄存在
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: function (req, file, cb) {
    // 生成檔案名稱: 時間戳_原始檔名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  fileFilter (req, file, callback) {
    if (file.mimetype === 'application/pdf') {
      callback(null, true)
    } else {
      callback(new Error('FORMAT'), false)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
}).single('pdf')

export default (req, res, next) => {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '檔案太大'
        })
      }
      return res.status(400).json({
        success: false,
        message: '上傳錯誤'
      })
    } else if (error) {
      if (error.message === 'FORMAT') {
        return res.status(400).json({
          success: false,
          message: '檔案格式錯誤，僅支援 PDF 檔案'
        })
      }
      return res.status(500).json({
        success: false,
        message: '未知錯誤'
      })
    }

    // 設定檔案的完整 URL
    if (req.file) {
      req.file.path = `${process.env.UPLOAD_URL}/forms/${req.file.filename}`
    }

    next()
  })
}

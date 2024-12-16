import { Schema, model, Error, ObjectId } from 'mongoose'
import bcrypt from 'bcrypt'
import UserRole from '../enums/UserRole.js'

const schema = new Schema({
  name: {
    type: String,
    required: [true, '請輸入使用者姓名']
  },
  email: { // 公司email
    type: String,
    unique: true,
    lowercase: true,
    required: [true, '請輸入公司email']
  },
  password: {
    type: String,
    required: [true, '請輸入使用者密碼']
  },
  userId: {
    type: String,
    sparse: true,
    unique: true,
    uppercase: true,
    set: v => (v === '' ? null : v)
  },
  adminId: {
    type: String,
    sparse: true,
    unique: true,
    uppercase: true,
    set: v => (v === '' ? null : v)
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true
  },
  role: {
    type: Number,
    required: true,
    default: UserRole.USER  // 改回 0，對應一般使用者
  },
  note: {
    type: String
  },
  resetPasswordToken: {
    type: String,
    default: undefined
  },
  resetPasswordExpires: {
    type: Date,
    default: undefined
  },
  lastEmailSent: { // 新增欄位跟蹤最後一次發送郵件的時間
    type: Date,
    default: undefined
  },
  avatar: {
    type: String,
    default: 'https://res.cloudinary.com/dcwkukgf3/image/upload/v1733472837/avatar_purple_robot_fenjig.webp'
  },
  tokens: {
    type: [String]
  }
}, {
  timestamps: true, // 使用者帳號建立時間、更新時間
  versionKey: false
})

schema.index(
  { resetPasswordExpires: 1 },
  {
    expireAfterSeconds: 1800, // 設定為 30 分鐘
    background: true // 在後台建立索引，避免阻塞應用
  }
)

schema.pre('save', function (next) {
  const user = this // this 指向 User model
  if (user.isModified('password')) {
    if (user.password.length < 8) {
      const error = new Error.ValidationError()
      error.addError('password', new Error.ValidatorError({ message: '使用者密碼長度不符' }))
      next(error)
      return
    } else {
      user.password = bcrypt.hashSync(user.password, 10)
    }
  }
  next()
})

export default model('users', schema)

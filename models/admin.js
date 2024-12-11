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
  adminId: {
    type: String,
    sparse: true,
    unique: true,
    uppercase: true,
    set: v => (v === '' ? null : v)
  },
  note: {
    type: String
  },
  avatar: {
    type: String,
    default: 'https://res.cloudinary.com/dcwkukgf3/image/upload/v1733904310/avatar_purple_robot_admin_yi29bu.webp'
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

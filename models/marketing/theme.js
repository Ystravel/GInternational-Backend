import { Schema, model } from 'mongoose'

const themeSchema = new Schema({
  // 主題名稱
  name: {
    type: String,
    required: [true, '請輸入主題名稱'],
    trim: true
  },
  // 是否啟用
  isActive: {
    type: Boolean,
    default: true
  },
  // 排序
  order: {
    type: Number,
    default: 0
  },
  // 建立者
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: [true, '請選擇建立者']
  },
  // 最後修改者
  lastModifier: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: [true, '請選擇最後修改者']
  }
}, {
  timestamps: true
})

// 索引
themeSchema.index({ name: 1 }, { unique: true })
themeSchema.index({ isActive: 1 })
themeSchema.index({ order: 1 })

export default model('marketingThemes', themeSchema) 
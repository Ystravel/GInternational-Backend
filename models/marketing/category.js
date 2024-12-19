import { Schema, model } from 'mongoose'

const categorySchema = new Schema({
  // 名稱
  name: {
    type: String,
    required: [true, '請輸入名稱'],
    trim: true
  },
  // 類型：1=廣告渠道, 2=平台, 3=項目, 4=細項
  type: {
    type: Number,
    required: [true, '請選擇類型'],
    enum: [1, 2, 3, 4]
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
categorySchema.index({ name: 1, type: 1 }, { unique: true })
categorySchema.index({ type: 1 })
categorySchema.index({ isActive: 1 })
categorySchema.index({ order: 1 })

export default model('marketingCategories', categorySchema) 
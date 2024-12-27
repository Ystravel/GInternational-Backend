import { Schema, model } from 'mongoose'

const categorySchema = new Schema({
  // 名稱
  name: {
    type: String,
    required: [true, '請輸入名稱'],
    trim: true
  },
  // 類型：0=行銷主題, 1=廣告渠道, 2=平台, 3=線別
  type: {
    type: Number,
    required: [true, '請選擇類型'],
    enum: [0, 1, 2, 3]
  },
  // 是否啟用
  isActive: {
    type: Boolean,
    default: true
  },
  // 排序
  order: {
    type: Number,
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
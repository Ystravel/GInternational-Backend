import { Schema, model } from 'mongoose'

const monthlyBudgetSchema = new Schema({
  JAN: { type: Number, default: 0 },
  FEB: { type: Number, default: 0 },
  MAR: { type: Number, default: 0 },
  APR: { type: Number, default: 0 },
  MAY: { type: Number, default: 0 },
  JUN: { type: Number, default: 0 },
  JUL: { type: Number, default: 0 },
  AUG: { type: Number, default: 0 },
  SEP: { type: Number, default: 0 },
  OCT: { type: Number, default: 0 },
  NOV: { type: Number, default: 0 },
  DEC: { type: Number, default: 0 }
}, {
  _id: false
})

const budgetItemSchema = new Schema({
  // 廣告渠道
  channel: {
    type: Schema.Types.ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇廣告渠道']
  },
  // 平台
  platform: {
    type: Schema.Types.ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇平台']
  },
  // 月度預算
  monthlyBudget: {
    type: monthlyBudgetSchema,
    required: [true, '請填寫預算']
  }
}, {
  _id: false
})

const budgetSchema = new Schema({
  // 年度
  year: {
    type: Number,
    required: [true, '請選擇年度']
  },
  // 預算主題
  theme: {
    type: Schema.Types.ObjectId,
    ref: 'marketingThemes',
    required: [true, '請選擇預算主題']
  },
  // 預算項目列表
  items: [budgetItemSchema],
  // 狀態：draft=草稿, published=已發布
  status: {
    type: String,
    required: [true, '請選擇狀態'],
    enum: ['draft', 'published'],
    default: 'draft'
  },
  // 備註
  note: {
    type: String,
    default: ''
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
budgetSchema.index({ year: 1, theme: 1 }, { unique: true })
budgetSchema.index({ status: 1 })
budgetSchema.index({ 'items.channel': 1 })
budgetSchema.index({ 'items.platform': 1 })

export default model('marketingBudgets', budgetSchema) 
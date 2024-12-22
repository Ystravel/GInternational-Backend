import { Schema, model, ObjectId } from 'mongoose'

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
  _id: false,
  virtuals: {
    total: {
      get() {
        return Object.values(this).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
      }
    }
  }
})

const budgetItemSchema = new Schema({
  // 廣告渠道
  channel: {
    type: ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇廣告渠道']
  },
  // 平台
  platform: {
    type: ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇平台']
  },
  // 月度預算
  monthlyBudget: {
    type: monthlyBudgetSchema,
    required: [true, '請填寫預算']
  }
}, {
  _id: false,
  virtuals: {
    total: {
      get() {
        return this.monthlyBudget.total
      }
    }
  }
})

const budgetSchema = new Schema({
  // 年度
  year: {
    type: Number,
    required: [true, '請選擇年度']
  },
  // 預算主題
  theme: {
    type: ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇預算主題']
  },
  // 預算項目列表
  items: [budgetItemSchema],
  // 備註
  note: {
    type: String,
    default: ''
  },
  // 建立者
  creator: {
    type: ObjectId,
    ref: 'users',
    required: [true, '請選擇建立者']
  },
  // 最後修改者
  lastModifier: {
    type: ObjectId,
    ref: 'users',
    required: [true, '請選擇最後修改者']
  }
}, {
  timestamps: true,
  virtuals: {
    totalBudget: {
      get() {
        return this.items.reduce((total, item) => total + item.total, 0)
      }
    }
  }
})

// 索引
budgetSchema.index({ year: 1, theme: 1 }, { unique: true })
budgetSchema.index({ 'items.channel': 1 })
budgetSchema.index({ 'items.platform': 1 })

// 靜態方法
budgetSchema.statics.getMonthlyBudget = async function (year, month, theme, channel, platform) {
  const monthKey = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][month - 1]
  
  const result = await this.findOne({
    year,
    theme,
    items: {
      $elemMatch: {
        channel,
        platform
      }
    }
  }).select(`items.$`)

  if (!result || !result.items[0]) return 0
  return result.items[0].monthlyBudget[monthKey] || 0
}

// 查詢助手
budgetSchema.query.byYearTheme = function (year, theme) {
  return this.where({ year, theme })
}

budgetSchema.query.byChannel = function (channel) {
  return this.where({ 'items.channel': channel })
}

budgetSchema.query.byPlatform = function (platform) {
  return this.where({ 'items.platform': platform })
}

export default model('marketingBudgets', budgetSchema) 
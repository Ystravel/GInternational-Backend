import { Schema, model, ObjectId } from 'mongoose'

const expenseSchema = new Schema({
  // 年度
  year: {
    type: Number,
    required: [true, '請選擇年度']
  },
  // 發票日期
  invoiceDate: {
    type: Date,
    required: [true, '請選擇發票日期']
  },
  // 預算主題
  theme: {
    type: ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇預算主題']
  },
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
  // 細項
  detail: {
    type: ObjectId,
    ref: 'marketingCategories',
    required: [true, '請選擇細項']
  },
  // 關聯的預算表
  relatedBudget: {
    type: ObjectId,
    ref: 'marketingBudgets',
    default: null
  },
  // 費用金額
  expense: {
    type: Number,
    required: [true, '請填寫費用']
  },
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
    month: {
      get() {
        return this.invoiceDate.getMonth() + 1
      }
    },
    monthKey: {
      get() {
        return ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][this.month - 1]
      }
    }
  }
})

// 索引
expenseSchema.index({ year: 1, invoiceDate: 1 })
expenseSchema.index({ year: 1, theme: 1 }, { unique: false })
expenseSchema.index({ year: 1, channel: 1 }, { unique: false })
expenseSchema.index({ year: 1, platform: 1 }, { unique: false })
expenseSchema.index({ year: 1, detail: 1 }, { unique: false })
expenseSchema.index({ relatedBudget: 1 }, { unique: false })

// 靜態方法
expenseSchema.statics.getMonthlyTotal = async function (year, month, theme, channel, platform) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const result = await this.aggregate([
    {
      $match: {
        invoiceDate: {
          $gte: startDate,
          $lte: endDate
        },
        theme,
        ...(channel && { channel }),
        ...(platform && { platform })
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$expense' }
      }
    }
  ])

  return result[0]?.total || 0
}

// 查詢助手
expenseSchema.query.byDateRange = function (startDate, endDate) {
  return this.where('invoiceDate').gte(startDate).lte(endDate)
}

expenseSchema.query.byYearMonth = function (year, month) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)
  return this.byDateRange(startDate, endDate)
}

expenseSchema.query.byYearTheme = function (year, theme) {
  return this.where({ year, theme })
}

expenseSchema.query.byChannel = function (channel) {
  return this.where({ channel })
}

expenseSchema.query.byPlatform = function (platform) {
  return this.where({ platform })
}

export default model('marketingExpenses', expenseSchema) 
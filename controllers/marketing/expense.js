import { StatusCodes } from 'http-status-codes'
import Expense from '../../models/marketing/expense.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'
import mongoose from 'mongoose'

// 創建實際花費
export const create = async (req, res) => {
  try {
    console.log('Creating expense with data:', req.body)

    const result = await Expense.create({
      ...req.body,
      creator: req.user._id,
      lastModifier: req.user._id
    })

    await logCreate(req.user, result, 'marketingExpenses')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費創建成功',
      result
    })
  } catch (error) {
    console.error('Error creating expense:', error)
    handleError(res, error)
  }
}

// 取得實際花費列表
export const getAll = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1

    // 建立基本的聚合管道
    const pipeline = []

    // 建立 match 條件
    const matchConditions = {}

    // 處理日期範圍查詢
    if (req.query.startDate && req.query.endDate) {
      try {
        // 解析日期
        const startDate = new Date(req.query.startDate)
        const endDate = new Date(req.query.endDate)

        // 設置 match 條件
        matchConditions.invoiceDate = {
          $gte: startDate,
          $lte: endDate
        }

        // 調試日誌
        console.log('後端日期處理:', {
          收到的開始日期: req.query.startDate,
          收到的結束日期: req.query.endDate,
          解析後開始日期: startDate.toISOString(),
          解析後結束日期: endDate.toISOString()
        })
      } catch (error) {
        console.error('日期處理錯誤:', error)
      }
    }

    // 處理其他搜尋條件
    if (req.query.theme && validator.isMongoId(req.query.theme)) {
      matchConditions.theme = new mongoose.Types.ObjectId(req.query.theme)
    }
    if (req.query.channel && validator.isMongoId(req.query.channel)) {
      matchConditions.channel = new mongoose.Types.ObjectId(req.query.channel)
    }
    if (req.query.platform && validator.isMongoId(req.query.platform)) {
      matchConditions.platform = new mongoose.Types.ObjectId(req.query.platform)
    }
    if (req.query.detail && validator.isMongoId(req.query.detail)) {
      matchConditions.detail = new mongoose.Types.ObjectId(req.query.detail)
    }
    if (req.query.relatedBudget && validator.isMongoId(req.query.relatedBudget)) {
      matchConditions.relatedBudget = new mongoose.Types.ObjectId(req.query.relatedBudget)
    }

    // 添加 $match 階段
    pipeline.push({ $match: matchConditions })

    // 關聯查詢
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'creator',
          foreignField: '_id',
          as: 'creator'
        }
      },
      { $unwind: '$creator' },
      {
        $lookup: {
          from: 'marketingcategories',
          localField: 'theme',
          foreignField: '_id',
          as: 'theme'
        }
      },
      { $unwind: '$theme' },
      {
        $lookup: {
          from: 'marketingcategories',
          localField: 'channel',
          foreignField: '_id',
          as: 'channel'
        }
      },
      { $unwind: '$channel' },
      {
        $lookup: {
          from: 'marketingcategories',
          localField: 'platform',
          foreignField: '_id',
          as: 'platform'
        }
      },
      { $unwind: '$platform' },
      {
        $lookup: {
          from: 'marketingcategories',
          localField: 'detail',
          foreignField: '_id',
          as: 'detail'
        }
      },
      { $unwind: '$detail' },
      {
        $lookup: {
          from: 'marketingbudgets',
          localField: 'relatedBudget',
          foreignField: '_id',
          as: 'relatedBudget'
        }
      },
      {
        $unwind: {
          path: '$relatedBudget',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'marketingcategories',
          localField: 'relatedBudget.theme',
          foreignField: '_id',
          as: 'relatedBudget.theme'
        }
      },
      {
        $unwind: {
          path: '$relatedBudget.theme',
          preserveNullAndEmptyArrays: true
        }
      }
    )

    // 添加排序
    pipeline.push({ $sort: { invoiceDate: -1, createdAt: -1 } })

    // 計算總數的管道
    const countPipeline = [...pipeline, { $count: 'total' }]

    // 添加分頁
    pipeline.push(
      { $skip: (page - 1) * itemsPerPage },
      { $limit: itemsPerPage }
    )

    // 執行查詢
    const [result, totalCount] = await Promise.all([
      Expense.aggregate(pipeline),
      Expense.aggregate(countPipeline)
    ])

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data: result,
        totalItems: totalCount[0]?.total || 0,
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
    console.error('Error in getAll:', error)
    handleError(res, error)
  }
}

// 取得單一實際花費
export const getById = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const result = await Expense.findById(req.params.id)
      .populate('theme', 'name')
      .populate('channel', 'name')
      .populate('platform', 'name')
      .populate('detail', 'name')
      .populate('relatedBudget', 'year theme')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')

    if (!result) throw new Error('NOT_FOUND')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 編輯實際花費
export const edit = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const updateData = {
      ...req.body,
      lastModifier: req.user._id
    }

    const originalExpense = await Expense.findById(req.params.id)
    if (!originalExpense) {
      throw new Error('NOT_FOUND')
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('channel', 'name')
      .populate('platform', 'name')
      .populate('detail', 'name')
      .populate('relatedBudget', 'year theme')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')

    await logUpdate(req.user, updatedExpense, 'marketingExpenses', originalExpense.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費更新成功',
      result: updatedExpense
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 刪除實際花費
export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      throw new Error('NOT_FOUND')
    }

    await logDelete(req.user, expense, 'marketingExpenses')
    await expense.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費刪除成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得月度統計
export const getMonthlyStats = async (req, res) => {
  try {
    const { year, month, theme, channel, platform } = req.query

    if (!year || !month || !theme) {
      throw new Error('PARAMS_REQUIRED')
    }

    const total = await Expense.getMonthlyTotal(
      parseInt(year),
      parseInt(month),
      theme,
      channel,
      platform
    )

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: { total }
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 統一錯誤處理
const handleError = (res, error) => {
  console.error('Error details:', error)

  if (error.name === 'ValidationError') {
    const key = Object.keys(error.errors)[0]
    const message = error.errors[key].message
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message
    })
  }

  if (error.message === 'NOT_FOUND') {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: '找不到實際花費記錄'
    })
  }

  if (error.message === 'ID') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '無效的ID格式'
    })
  }

  if (error.message === 'PARAMS_REQUIRED') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '請提供必要的參數'
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
import { StatusCodes } from 'http-status-codes'
import Expense from '../../models/marketing/expense.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'
import mongoose from 'mongoose'

// 創建實際花費
export const create = async (req, res) => {
  try {
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
    handleError(res, error)
  }
}

// 取得實際花費列表
export const getAll = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1
    const matchQuery = {}

    // 處理年度篩選
    if (req.query.year) {
      matchQuery.year = parseInt(req.query.year)
    }

    // 處理主題篩選
    if (req.query.theme && validator.isMongoId(req.query.theme)) {
      matchQuery.theme = new mongoose.Types.ObjectId(req.query.theme)
    }

    // 處理渠道篩選
    if (req.query.channel && validator.isMongoId(req.query.channel)) {
      matchQuery.channel = new mongoose.Types.ObjectId(req.query.channel)
    }

    // 處理平台篩選
    if (req.query.platform && validator.isMongoId(req.query.platform)) {
      matchQuery.platform = new mongoose.Types.ObjectId(req.query.platform)
    }

    // 處理細項篩選
    if (req.query.detail && validator.isMongoId(req.query.detail)) {
      matchQuery.detail = new mongoose.Types.ObjectId(req.query.detail)
    }

    // 處理關聯預算表篩選
    if (req.query.relatedBudget && validator.isMongoId(req.query.relatedBudget)) {
      matchQuery.relatedBudget = new mongoose.Types.ObjectId(req.query.relatedBudget)
    }

    // 處理日期範圍篩選
    if (req.query.startDate && req.query.endDate) {
      matchQuery.invoiceDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      }
    }

    // 處理關鍵字搜尋
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i')
      const searchQuery = [
        { note: searchRegex }
      ]

      // 如果搜尋字串是數字，也加入金額搜尋
      const searchNumber = parseFloat(req.query.search)
      if (!isNaN(searchNumber)) {
        searchQuery.push({ expense: searchNumber })
      }

      matchQuery.$or = searchQuery
    }

    // 建立基本的聚合管道
    const pipeline = [
      // 首先進行主要的篩選
      { $match: matchQuery },

      // 然後進行關聯查詢
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
          from: 'users',
          localField: 'lastModifier',
          foreignField: '_id',
          as: 'lastModifier'
        }
      },
      { $unwind: '$lastModifier' },
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
      }
    ]

    // 如果有搜尋關鍵字，添加對 creator.name 的搜尋
    if (req.query.search) {
      pipeline.push({
        $match: {
          $or: [
            { 'creator.name': new RegExp(req.query.search, 'i') },
            ...matchQuery.$or
          ]
        }
      })
    }

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
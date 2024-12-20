import { StatusCodes } from 'http-status-codes'
import Expense from '../../models/marketing/expense.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'

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
    const query = {}

    // 處理年度篩選
    if (req.query.year) {
      query.year = parseInt(req.query.year)
    }

    // 處理主題篩選
    if (req.query.theme && validator.isMongoId(req.query.theme)) {
      query.theme = req.query.theme
    }

    // 處理渠道篩選
    if (req.query.channel && validator.isMongoId(req.query.channel)) {
      query.channel = req.query.channel
    }

    // 處理平台篩選
    if (req.query.platform && validator.isMongoId(req.query.platform)) {
      query.platform = req.query.platform
    }

    // 處理日期範圍篩選
    if (req.query.startDate && req.query.endDate) {
      query.invoiceDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      }
    }

    // 處理關鍵字搜尋
    if (req.query.search) {
      query.$or = [
        { note: { $regex: req.query.search, $options: 'i' } }
      ]
    }

    const result = await Expense.find(query)
      .populate('theme', 'name')
      .populate('channel', 'name')
      .populate('platform', 'name')
      .populate('detail', 'name')
      .populate('relatedBudget', 'year theme')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)

    const total = await Expense.countDocuments(query)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data: result,
        totalItems: total,
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
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
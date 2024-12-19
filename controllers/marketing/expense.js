import { StatusCodes } from 'http-status-codes'
import Expense from '../../models/marketing/expense.js'
import Budget from '../../models/marketing/budget.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'

// 創建實際花費表
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
      message: '實際花費表創建成功',
      result
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得實際花費表列表
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

    // 處理狀態篩選
    if (req.query.status) {
      query.status = req.query.status
    }

    const result = await Expense.find(query)
      .populate('theme', 'name')
      .populate('relatedBudget')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')
      .populate('items.project', 'name')
      .populate('items.detail', 'name')
      .sort({ year: -1, createdAt: -1 })
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

// 取得單一實際花費表
export const getById = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const result = await Expense.findById(req.params.id)
      .populate('theme', 'name')
      .populate('relatedBudget')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')
      .populate('items.project', 'name')
      .populate('items.detail', 'name')

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

// 編輯實際花費表
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

    // 如果狀態是已發布，就不能修改
    if (originalExpense.status === 'published') {
      throw new Error('PUBLISHED')
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('relatedBudget')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')
      .populate('items.project', 'name')
      .populate('items.detail', 'name')

    await logUpdate(req.user, updatedExpense, 'marketingExpenses', originalExpense.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費表更新成功',
      result: updatedExpense
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 刪除實際花費表
export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      throw new Error('NOT_FOUND')
    }

    // 如果狀態是已發布，就不能刪除
    if (expense.status === 'published') {
      throw new Error('PUBLISHED')
    }

    await logDelete(req.user, expense, 'marketingExpenses')
    await expense.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費表刪除成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 發布實際花費表
export const publish = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      throw new Error('NOT_FOUND')
    }

    if (expense.status === 'published') {
      throw new Error('ALREADY_PUBLISHED')
    }

    const updateData = {
      status: 'published',
      lastModifier: req.user._id
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('relatedBudget')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')
      .populate('items.project', 'name')
      .populate('items.detail', 'name')

    await logUpdate(req.user, updatedExpense, 'marketingExpenses', expense.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費表發布成功',
      result: updatedExpense
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得可關聯的預算表
export const getBudgetOptions = async (req, res) => {
  try {
    const { year, theme } = req.query
    if (!year || !theme) throw new Error('PARAMS_REQUIRED')

    const budgets = await Budget.find({
      year: parseInt(year),
      theme: theme,
      status: 'published'
    })
      .select('year theme')
      .populate('theme', 'name')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: budgets
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

  if (error.code === 11000) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '該年度的實際花費表已存在'
    })
  }

  if (error.message === 'NOT_FOUND') {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: '找不到實際花費表'
    })
  }

  if (error.message === 'ID') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '無效的ID格式'
    })
  }

  if (error.message === 'PUBLISHED') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '已發布的實際花費表不能修改'
    })
  }

  if (error.message === 'ALREADY_PUBLISHED') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '實際花費表已經發布'
    })
  }

  if (error.message === 'PARAMS_REQUIRED') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '請提供年度和主題'
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
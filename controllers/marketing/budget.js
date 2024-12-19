import { StatusCodes } from 'http-status-codes'
import Budget from '../../models/marketing/budget.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'

// 創建預算表
export const create = async (req, res) => {
  try {
    const result = await Budget.create({
      ...req.body,
      creator: req.user._id,
      lastModifier: req.user._id
    })

    await logCreate(req.user, result, 'marketingBudgets')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算表創建成功',
      result
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得預算表列表
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

    const result = await Budget.find(query)
      .populate('theme', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')
      .sort({ year: -1, createdAt: -1 })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)

    const total = await Budget.countDocuments(query)

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

// 取得單一預算表
export const getById = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const result = await Budget.findById(req.params.id)
      .populate('theme', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')

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

// 編輯預算表
export const edit = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const updateData = {
      ...req.body,
      lastModifier: req.user._id
    }

    const originalBudget = await Budget.findById(req.params.id)
    if (!originalBudget) {
      throw new Error('NOT_FOUND')
    }

    // 如果狀態是已發布，就不能修改
    if (originalBudget.status === 'published') {
      throw new Error('PUBLISHED')
    }

    const updatedBudget = await Budget.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')

    await logUpdate(req.user, updatedBudget, 'marketingBudgets', originalBudget.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算表更新成功',
      result: updatedBudget
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 刪除預算表
export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const budget = await Budget.findById(req.params.id)
    if (!budget) {
      throw new Error('NOT_FOUND')
    }

    // 如果狀態是已發布，就不能刪除
    if (budget.status === 'published') {
      throw new Error('PUBLISHED')
    }

    await logDelete(req.user, budget, 'marketingBudgets')
    await budget.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算表刪除成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 發布預算表
export const publish = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const budget = await Budget.findById(req.params.id)
    if (!budget) {
      throw new Error('NOT_FOUND')
    }

    if (budget.status === 'published') {
      throw new Error('ALREADY_PUBLISHED')
    }

    const updateData = {
      status: 'published',
      lastModifier: req.user._id
    }

    const updatedBudget = await Budget.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .populate('items.channel', 'name')
      .populate('items.platform', 'name')

    await logUpdate(req.user, updatedBudget, 'marketingBudgets', budget.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算表發布成功',
      result: updatedBudget
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得年度選項
export const getYearOptions = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear()
    const years = []
    
    // 從2024年開始到當前年份後5年
    for (let year = 2024; year <= currentYear + 5; year++) {
      years.push(year)
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: years
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
      message: '該年度的預算表已存在'
    })
  }

  if (error.message === 'NOT_FOUND') {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: '找不到預算表'
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
      message: '已發布的預算表不能修改'
    })
  }

  if (error.message === 'ALREADY_PUBLISHED') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '預算表已經發布'
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
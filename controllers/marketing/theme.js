import { StatusCodes } from 'http-status-codes'
import Theme from '../../models/marketing/theme.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'

// 創建預算主題
export const create = async (req, res) => {
  try {
    const result = await Theme.create({
      ...req.body,
      creator: req.user._id,
      lastModifier: req.user._id
    })

    await logCreate(req.user, result, 'marketingThemes')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算主題創建成功',
      result
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得所有預算主題
export const getAll = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1
    const query = {}

    // 處理啟用狀態篩選
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true'
    }

    const result = await Theme.find(query)
      .populate('creator', 'name')
      .populate('lastModifier', 'name')
      .sort({ [req.query.sortBy || 'order']: req.query.sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)

    const total = await Theme.countDocuments(query)

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

// 編輯預算主題
export const edit = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const updateData = {
      ...req.body,
      lastModifier: req.user._id
    }

    const originalTheme = await Theme.findById(req.params.id)
    if (!originalTheme) {
      throw new Error('NOT_FOUND')
    }

    const updatedTheme = await Theme.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('creator', 'name')
      .populate('lastModifier', 'name')

    await logUpdate(req.user, updatedTheme, 'marketingThemes', originalTheme.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算主題更新成功',
      result: updatedTheme
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 刪除預算主題
export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const theme = await Theme.findById(req.params.id)
    if (!theme) {
      throw new Error('NOT_FOUND')
    }

    await logDelete(req.user, theme, 'marketingThemes')
    await theme.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '預算主題刪除成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得啟用中的預算主題選項
export const getOptions = async (req, res) => {
  try {
    const themes = await Theme.find({ isActive: true })
      .select('name')
      .sort({ order: 1 })

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: themes
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
      message: '預算主��名稱重複'
    })
  }

  if (error.message === 'NOT_FOUND') {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: '找不到預算主題'
    })
  }

  if (error.message === 'ID') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '無效的ID格式'
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
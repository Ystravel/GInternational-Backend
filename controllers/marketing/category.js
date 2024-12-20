import { StatusCodes } from 'http-status-codes'
import Category from '../../models/marketing/category.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'

// 創建廣告類別
export const create = async (req, res) => {
  try {
    const result = await Category.create({
      ...req.body,
      creator: req.user._id,
      lastModifier: req.user._id
    })

    await logCreate(req.user, result, 'marketingCategories')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '廣告類別創建成功',
      result
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得所有廣告類別
export const getAll = async (req, res) => {
  try {
    const itemsPerPage = 15 // 固定每頁 20 筆
    const pages = {
      0: parseInt(req.query.page0) || 1,
      1: parseInt(req.query.page1) || 1,
      2: parseInt(req.query.page2) || 1,
      3: parseInt(req.query.page3) || 1
    }

    // 基本查詢條件
    let baseQuery = {}
    if (req.query.quickSearch) {
      baseQuery.name = new RegExp(req.query.quickSearch, 'i')
    }

    // 取得每種類型的資料
    const results = await Promise.all([0, 1, 2, 3].map(async type => {
      const query = { ...baseQuery, type }
      const data = await Category.find(query)
        .populate('creator', 'name')
        .populate('lastModifier', 'name')
        .sort({ order: 1 })
        .skip((pages[type] - 1) * itemsPerPage)
        .limit(itemsPerPage)

      const total = await Category.countDocuments(query)

      return {
        type,
        data,
        total,
        currentPage: pages[type],
        totalPages: Math.ceil(total / itemsPerPage)
      }
    }))

    // 組合回傳資料
    const result = {
      marketingThemes: results[0],
      advertisingChannels: results[1],
      platforms: results[2],
      details: results[3]
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 編輯廣告類別
export const edit = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const updateData = {
      ...req.body,
      lastModifier: req.user._id
    }

    const originalCategory = await Category.findById(req.params.id)
    if (!originalCategory) {
      throw new Error('NOT_FOUND')
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('creator', 'name')
      .populate('lastModifier', 'name')

    await logUpdate(req.user, updatedCategory, 'marketingCategories', originalCategory.toObject(), updateData)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '廣告類別更新成功',
      result: updatedCategory
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 刪除廣告類別
export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const category = await Category.findById(req.params.id)
    if (!category) {
      throw new Error('NOT_FOUND')
    }

    await logDelete(req.user, category, 'marketingCategories')
    await category.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '廣告類別刪除成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 取得特定類型的選項
export const getOptions = async (req, res) => {
  try {
    const { type } = req.query
    if (!type) throw new Error('TYPE_REQUIRED')

    const categories = await Category.find({
      type: parseInt(type),
      isActive: true
    })
      .select('name')
      .sort({ order: 1 })

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: categories
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
      message: '廣告類別名稱重複'
    })
  }

  if (error.message === 'NOT_FOUND') {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: '找不到廣告類���'
    })
  }

  if (error.message === 'ID') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '無效的ID格式'
    })
  }

  if (error.message === 'TYPE_REQUIRED') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '請指定類型'
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
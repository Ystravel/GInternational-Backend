import { StatusCodes } from 'http-status-codes'
import Category from '../../models/marketing/category.js'
import validator from 'validator'
import { logCreate, logUpdate, logDelete } from '../../services/auditLogService.js'
import Budget from '../../models/marketing/budget.js'
import Expense from '../../models/marketing/expense.js'

// 創建廣告類別
export const create = async (req, res) => {
  try {
    // 檢查新順序是否有效
    const maxOrder = await Category.countDocuments({ type: req.body.type })
    const newOrder = parseInt(req.body.order) || (maxOrder + 1)

    if (newOrder < 1) {
      throw new Error('ORDER_TOO_SMALL')
    }
    if (newOrder > maxOrder + 1) {
      throw new Error('ORDER_TOO_LARGE')
    }

    // 如果要插入特定位置
    if (newOrder <= maxOrder) {
      // 取得所有同類型的項目
      const allItems = await Category.find({ type: req.body.type })
        .sort({ order: 1 })

      // 建立批量更新操作
      const bulkOps = allItems
        .filter(item => item.order >= newOrder)
        .map(item => ({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { order: item.order + 1 } }
          }
        }))

      // 批量更新所有項目
      if (bulkOps.length > 0) {
        await Category.bulkWrite(bulkOps)
      }
    }

    const result = await Category.create({
      ...req.body,
      order: newOrder,
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

    const originalCategory = await Category.findById(req.params.id)
    if (!originalCategory) {
      throw new Error('NOT_FOUND')
    }

    // 如果排序有變更
    const newOrder = parseInt(req.body.order)
    if (!isNaN(newOrder) && newOrder !== originalCategory.order) {
      // 檢查新順序是否有效
      const maxOrder = await Category.countDocuments({ type: originalCategory.type })
      
      if (newOrder < 1) {
        throw new Error('ORDER_TOO_SMALL')
      }
      if (newOrder > maxOrder) {
        throw new Error('ORDER_TOO_LARGE')
      }

      // 取得所有同類型的項目
      const allItems = await Category.find({ type: originalCategory.type })
        .sort({ order: 1 })

      // 重新計算所有項目的順序
      const updatedItems = []
      let currentOrder = 1

      // 先處理順序小於新順序的項目
      allItems.forEach(item => {
        if (item._id.toString() === originalCategory._id.toString()) {
          return // 跳過當前項目
        }
        
        if (currentOrder === newOrder) {
          currentOrder++ // 跳過新順序
        }

        if (item.order !== currentOrder) {
          updatedItems.push({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: { order: currentOrder } }
            }
          })
        }
        currentOrder++
      })

      // 更新當前項目到新順序
      const updateData = {
        ...req.body,
        order: newOrder,
        lastModifier: req.user._id
      }

      // 批量更新所有項目
      if (updatedItems.length > 0) {
        await Category.bulkWrite(updatedItems)
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
    } else {
      // 如果沒有更改順序，只更新其他欄位
      const updateData = {
        ...req.body,
        lastModifier: req.user._id
      }
      delete updateData.order // 移除 order 欄位，保持原有順序

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
    }
  } catch (error) {
    console.error('Edit category error:', error)
    handleError(res, error)
  }
}

// 刪除廣告類別
export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    // 先查詢項目是否存在
    const category = await Category.findById(req.params.id)
    if (!category) throw new Error('NOT_FOUND')

    // 檢查是否有關聯的預算資料
    const budgetCount = await Budget.countDocuments({
      $or: [
        { theme: category._id },
        { 'items.channel': category._id },
        { 'items.platform': category._id }
      ]
    })

    if (budgetCount > 0) {
      throw new Error('BUDGET_REFERENCE')
    }

    // 檢查是否有關聯的支出資料
    const expenseCount = await Expense.countDocuments({
      $or: [
        { theme: category._id },
        { channel: category._id },
        { platform: category._id },
        { 'details.detail': category._id }
      ]
    })

    if (expenseCount > 0) {
      throw new Error('EXPENSE_REFERENCE')
    }

    // 執行刪除
    await Category.deleteOne({ _id: category._id })

    // 更新其他項目的順序
    await Category.updateMany(
      { type: category.type },
      [
        {
          $set: {
            order: {
              $cond: {
                if: { $gt: ['$order', category.order] },
                then: { $subtract: ['$order', 1] },
                else: '$order'
              }
            }
          }
        }
      ]
    )

    await logDelete(req.user, category, 'marketingCategories')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '廣告類別刪除成功'
    })
  } catch (error) {
    console.error('Delete category error:', error)
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

// 獲取最大排序值
export const getMaxOrder = async (req, res) => {
  try {
    const { type } = req.query
    if (type === undefined) throw new Error('TYPE_REQUIRED')

    const maxOrder = await Category.findOne({ type: parseInt(type) })
      .sort({ order: -1 })
      .select('order')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: (maxOrder?.order || 0) + 1
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
      message: '找不到廣告類別'
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

  if (error.message === 'ORDER_TOO_SMALL') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '排序不能小於1'
    })
  }

  if (error.message === 'ORDER_TOO_LARGE') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '排序超出範圍'
    })
  }

  if (error.message === 'BUDGET_REFERENCE') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '此分類已有預算資料使用，無法刪除'
    })
  }

  if (error.message === 'EXPENSE_REFERENCE') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: '此分類已有實際支出資料使用，無法刪除'
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
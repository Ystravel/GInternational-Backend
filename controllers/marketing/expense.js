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

    // 在記錄異動前先填充所有關聯資料
    const populatedResult = await Expense.findById(result._id)
      .populate('theme', 'name')
      .populate('channel', 'name')
      .populate('platform', 'name')
      .populate('details.detail', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')

    await logCreate(req.user, populatedResult, 'marketingExpenses')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '實際花費創建成功',
      result: populatedResult
    })
  } catch (error) {
    console.error('Error creating expense:', error)
    handleError(res, error)
  }
}

// 取得實際花費列表
export const getAll = async (req, res) => {
  try {
    const query = { }
    const { search, theme, channel, platform, detail } = req.query
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1

    // 處理發票日期範圍搜尋
    if (req.query.invoiceDateStart && req.query.invoiceDateEnd) {
      query.invoiceDate = {
        $gte: new Date(req.query.invoiceDateStart),
        $lte: new Date(req.query.invoiceDateEnd)
      }
    }

    // 處理建立日期範圍搜尋
    if (req.query.createdDateStart && req.query.createdDateEnd) {
      query.createdAt = {
        $gte: new Date(req.query.createdDateStart),
        $lte: new Date(req.query.createdDateEnd)
      }
    }

    // 其他搜尋條件
    if (theme) query.theme = new mongoose.Types.ObjectId(theme)
    if (channel) query.channel = new mongoose.Types.ObjectId(channel)
    if (platform) query.platform = new mongoose.Types.ObjectId(platform)
    if (detail) query['details.detail'] = new mongoose.Types.ObjectId(detail)
    if (search) {
      query.$or = [
        { note: { $regex: search, $options: 'i' } },
        { 'creator.name': { $regex: search, $options: 'i' } }
      ]
    }

    // 建立基本的聚合管道
    const pipeline = []

    // 關聯查詢
    pipeline.push(
      { $lookup: { from: 'marketingcategories', localField: 'theme', foreignField: '_id', as: 'theme' } },
      { $unwind: '$theme' },
      { $lookup: { from: 'marketingcategories', localField: 'channel', foreignField: '_id', as: 'channel' } },
      { $unwind: '$channel' },
      { $lookup: { from: 'marketingcategories', localField: 'platform', foreignField: '_id', as: 'platform' } },
      { $unwind: '$platform' },
      { $lookup: { from: 'marketingcategories', localField: 'details.detail', foreignField: '_id', as: 'detailsInfo' } },
      { $lookup: { from: 'users', localField: 'creator', foreignField: '_id', as: 'creator' } },
      { $unwind: '$creator' }
    )

    // 添加基本 match 條件
    if (Object.keys(query).length > 0) {
      pipeline.push({ $match: query })
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
      .populate('details.detail', 'name')
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

    // 獲取並填充原始資料
    const originalExpense = await Expense.findById(req.params.id)
      .populate('theme', 'name')
      .populate('channel', 'name')
      .populate('platform', 'name')
      .populate('details.detail', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')

    if (!originalExpense) {
      throw new Error('NOT_FOUND')
    }

    // 更新資料並填充
    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('channel', 'name')
      .populate('platform', 'name')
      .populate('details.detail', 'name')
      .populate('creator', 'name')
      .populate('lastModifier', 'name')

    // 準備原始資料
    const originalData = {
      invoiceDate: originalExpense.invoiceDate,
      year: originalExpense.year,
      totalExpense: originalExpense.totalExpense,
      note: originalExpense.note,
      theme: originalExpense.theme?.name,
      channel: originalExpense.channel?.name,
      platform: originalExpense.platform?.name,
      details: originalExpense.details.map(d => ({
        detail: d.detail?.name,
        amount: d.amount
      }))
    }

    // 準備新資料
    const newData = {
      invoiceDate: updatedExpense.invoiceDate,
      year: updatedExpense.year,
      totalExpense: updatedExpense.totalExpense,
      note: updatedExpense.note,
      theme: updatedExpense.theme?.name,
      channel: updatedExpense.channel?.name,
      platform: updatedExpense.platform?.name,
      details: updatedExpense.details.map(d => ({
        detail: d.detail?.name,
        amount: d.amount
      }))
    }

    // 記錄異動
    await logUpdate(
      req.user,
      updatedExpense,
      'marketingExpenses',
      originalData,
      newData
    )

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
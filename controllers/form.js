import Form from '../models/form.js'
import { StatusCodes } from 'http-status-codes'
import FormTemplate from '../models/formTemplate.js'
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'
import { logCreate, logUpdate, logDelete } from '../services/auditLogService.js'


// 創建表單
export const create = async (req, res) => {
  try {

    // 1. 先檢查單號是否重複
    const existingForm = await Form.findOne({ formNumber: req.body.formNumber })
    if (existingForm) {
      // 如果發現單號重複，刪除已上傳的 PDF 檔案
      if (req.body.pdfUrl) {
        const filename = path.basename(req.body.pdfUrl)
        const filePath = path.join(process.env.UPLOAD_PATH, 'forms', filename)
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        } catch (error) {
          console.error('刪除 PDF 檔案失敗:', error)
        }
      }

      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '表單編號已存在'
      })
    }

    // 2. 創建表單
    const result = await Form.create({
      formNumber: req.body.formNumber,
      formTemplate: req.body.formTemplate,
      creator: req.user._id,
      pdfUrl: req.body.pdfUrl,
      formData: {
        ...req.body.formData // 展開所有其他欄位
      }
    })

    // 記錄審計日誌
    await logCreate(req.user, {
      ...result.toObject(),
      formNumber: result.formNumber
    }, 'forms')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '表單建立成功',
      result
    })
  } catch (error) {
    // 如果創建失敗，也要刪除已上傳的 PDF 檔案
    if (req.body.pdfUrl) {
      const filename = path.basename(req.body.pdfUrl)
      const filePath = path.join(process.env.UPLOAD_PATH, 'forms', filename)
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (deleteError) {
        console.error('刪除 PDF 檔案失敗:', deleteError)
      }
    }

    console.error('創建失敗:', error)
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      const message = error.errors[key].message
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message,
        validationError: error.errors
      })
    } else if (error.code === 11000) {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '表單編號已存在'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '未知錯誤',
        error: error.message
      })
    }
  }
}

// 搜尋表單
export const search = async (req, res) => {
  try {
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10
    const page = parseInt(req.query.page) || 1
    const query = {}

    // 處理日期範圍查詢 (先處理日期)
    if (req.query.date) {
      const dates = Array.isArray(req.query.date) ? req.query.date : [req.query.date]
      if (dates.length === 1) {
        const startDate = new Date(dates[0])
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(dates[0])
        endDate.setHours(23, 59, 59, 999)
        query.createdAt = { $gte: startDate, $lte: endDate }
      } else if (dates.length === 2) {
        const startDate = new Date(dates[0])
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(dates[1])
        endDate.setHours(23, 59, 59, 999)
        query.createdAt = { $gte: startDate, $lte: endDate }
      }
    }

    // 處理具體模板搜尋
    if (req.query.formTemplate) {
      query.formTemplate = new mongoose.Types.ObjectId(req.query.formTemplate)
    } else {
      const templateQuery = {}
      if (req.query.type) {
        templateQuery.type = req.query.type
      }
      if (Object.keys(templateQuery).length > 0) {
        const templates = await FormTemplate.find(templateQuery).select('_id')
        const templateIds = templates.map(t => t._id)
        query.formTemplate = { $in: templateIds }
      }
    }

    // 添加快速搜尋功能
    if (req.query.quickSearch) {
      const searchRegex = new RegExp(req.query.quickSearch, 'i')
      query.$or = [
        { formNumber: searchRegex },
        { 'formData.customerName': searchRegex },
        { 'formData.projectName': searchRegex },
        // 添加對表單項目的搜尋
        { 'formData.items.name': searchRegex },      // 銳皇報價單的項目名稱
        { 'formData.items.category': searchRegex },  // 永信旅遊報價單的項目類別
        { 'formData.items.description': searchRegex } // 兩種報價單都有的項目說明
      ]
    }

    // 設置排序
    const sortField = req.query.sort || 'formNumber'
    const sortOrder = req.query.order === 'desc' ? -1 : 1

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'formtemplates',
          localField: 'formTemplate',
          foreignField: '_id',
          as: 'formTemplate'
        }
      },
      { $unwind: { path: '$formTemplate', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'creator',
          foreignField: '_id',
          as: 'creator'
        }
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          formNumber: 1,
          clientName: '$formData.customerName',
          projectName: '$formData.projectName',
          pdfUrl: 1,
          createdAt: 1,
          formTemplate: {
            _id: 1,
            name: 1,
            type: 1
          },
          creator: {
            _id: 1,
            name: 1,
            role: 1,
            adminId: 1,
            userId: 1
          }
        }
      },
      { $sort: { [sortField]: sortOrder } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: (page - 1) * itemsPerPage },
            { $limit: itemsPerPage }
          ]
        }
      }
    ]

    const [result] = await Form.aggregate(pipeline)

    const totalItems = result.metadata[0]?.total || 0

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data: result.data,
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / itemsPerPage)
      }
    })
  } catch (error) {
    console.error('搜尋失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '搜尋失敗'
    })
  }
}

// 刪除表單
export const remove = async (req, res) => {
  try {
    const result = await Form.findById(req.params.id)
    if (!result) throw new Error('NOT_FOUND')

    // 記錄審計日誌
    await logDelete(req.user, {
      ...result.toObject(),
      formNumber: result.formNumber
    }, 'forms')

    // 從 URL 中提取檔案名稱
    const filename = path.basename(result.pdfUrl)
    const filePath = path.join(process.env.UPLOAD_PATH, 'forms', filename)

    // 刪除實體檔案
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      console.error('刪除檔案失敗:', error)
    }

    await result.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '表單刪除成功'
    })
  } catch (error) {
    console.error('刪除表單失敗:', error)
    if (error.message === 'NOT_FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到表單'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '刪除失敗',
        error: error.message
      })
    }
  }
}

// 上傳 PDF
export const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請上傳 PDF 檔案'
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'PDF 上傳成功',
      result: {
        url: req.file.path,
        filename: req.file.filename
      }
    })
  } catch (error) {
    console.error('上傳失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '上傳失敗'
    })
  }
}

// 新增表單搜尋建議
export const getSuggestions = async (req, res) => {
  try {
    const { search } = req.query
    if (!search) {
      return res.status(StatusCodes.OK).json({
        success: true,
        result: []
      })
    }

    const searchRegex = new RegExp(search, 'i')
    const query = {
      $or: [
        { formNumber: searchRegex },
        { clientName: searchRegex }
      ]
    }

    const forms = await Form.find(query)
      .select('_id formNumber clientName')
      .limit(10)
      .lean()

    res.status(StatusCodes.OK).json({
      success: true,
      result: forms
    })
  } catch (error) {
    console.error('取得表單建議失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '取得表單建議失敗'
    })
  }
}

// 取得銳皇報價單的下一個單號
export const getRayHuangQuotationNextNumber = async (req, res) => {
  try {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0')
    const currentDay = String(today.getDate()).padStart(2, '0')
    const currentDate = `${currentYear}${currentMonth}${currentDay}`

    // 查找當天最大的流水號
    const latestForm = await Form.findOne({
      formNumber: new RegExp(`^${currentDate}`),
      formTemplate: req.query.templateId
    }).sort({ formNumber: -1 })

    let nextNumber
    if (latestForm) {
      // 如果當天有資料，取最後4位數字(流水號)加1
      const currentSeq = parseInt(latestForm.formNumber.slice(-4))
      nextNumber = `${currentDate}${String(currentSeq + 1).padStart(4, '0')}`
    } else {
      // 如果當天沒有資料，從0001開始
      nextNumber = `${currentDate}0001`
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: nextNumber
    })
  } catch (error) {
    console.error('取得銳皇報價單單號失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '取得單號失敗'
    })
  }
}

export const getYstravelQuotationNextNumber = async (req, res) => {
  try {
    const { templateId } = req.query
    if (!templateId) {
      throw new Error('缺少必要參數')
    }

    // 取得當前年月
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `YST${year}${month}`

    // 找出最後一個單號
    const lastForm = await Form.findOne({
      formNumber: new RegExp(`^${prefix}`),
      formTemplate: templateId
    }).sort({ formNumber: -1 })

    let nextNumber = 1
    if (lastForm) {
      // 從最後一個單號取得序號並加1
      const lastNumber = parseInt(lastForm.formNumber.slice(-3))
      nextNumber = lastNumber + 1
    }

    // 組合新單號 (YST + 年 + 月 + 3位數序號)
    const formNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`

    res.status(200).json({
      success: true,
      message: '取得下一個單號成功',
      result: formNumber
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '取得下一個單號失敗',
      error: error.message
    })
  }
}
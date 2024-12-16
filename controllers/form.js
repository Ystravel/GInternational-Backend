import Form from '../models/form.js'
import { StatusCodes } from 'http-status-codes'
import FormTemplate from '../models/formTemplate.js'
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'
import { logCreate, logUpdate, logDelete } from '../services/auditLogService.js'

// 取得下一個表單編號
export const getNextNumber = async (req, res) => {
  try {
    const today = new Date()
    const currentDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const currentMonth = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`

    // 查找當月最大的流水號
    const latestForm = await Form.findOne({
      formNumber: new RegExp(`^${currentMonth}`)
    }).sort({ formNumber: -1 })

    let nextNumber
    if (latestForm) {
      // 如果當月有資料，取最後4位數字(流水號)加1
      const currentSeq = parseInt(latestForm.formNumber.slice(-4))
      nextNumber = `${currentDate}${String(currentSeq + 1).padStart(4, '0')}`
    } else {
      // 如果當月沒有資料，從0001開始
      nextNumber = `${currentDate}0001`
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: nextNumber
    })
  } catch (error) {
    console.error('取得表單編號失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '取得表單編號失敗'
    })
  }
}

// 創建表單
export const create = async (req, res) => {
  try {
    console.log('收到創建請求')
    console.log('請求資料:', req.body)

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
            console.log('已刪除重複單號的 PDF 檔案:', filePath)
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
      clientName: req.body.clientName,
      formTemplate: req.body.formTemplate,
      creator: req.user._id,
      pdfUrl: req.body.pdfUrl,
      projectName: req.body.projectName
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
          console.log('已刪除失敗的 PDF 檔案:', filePath)
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
        { clientName: searchRegex },
        { projectName: searchRegex }
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
          clientName: 1,
          projectName: 1,
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
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
    console.error('搜尋失敗，錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '搜尋失敗',
      error: error.message
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
    console.log('收到上傳請求')
    console.log('檔案資訊:', req.file)
    if (!req.file) {
      console.log('沒有收到檔案')
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請上傳 PDF 檔案'
      })
    }

    console.log('上傳成功，傳資訊:', {
      url: req.file.path,
      filename: req.file.filename
    })
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

import FormTemplate from '../models/formTemplate.js'
import { StatusCodes } from 'http-status-codes'
import { logCreate, logUpdate, logDelete } from '../services/auditLogService.js'

// 創建表單模板
export const create = async (req, res) => {
  try {
    console.log('收到的資料:', req.body)

    if (!req.body.name || !req.body.type || !req.body.componentName) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少必填欄位',
        missingFields: {
          name: !req.body.name,
          type: !req.body.type,
          componentName: !req.body.componentName
        }
      })
    }

    const result = await FormTemplate.create({
      name: req.body.name,
      type: req.body.type,
      componentName: req.body.componentName
    })

    // 記錄審計日誌
    await logCreate(req.user, result, 'formTemplates')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '表單模板建立成功',
      result
    })
  } catch (error) {
    console.error('創建失敗:', error)
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      const message = error.errors[key].message
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message,
        validationError: error.errors
      })
    } else if (error.name === 'MongoServerError' && error.code === 11000) {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '表單名稱已存在'
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

// 取得所有表單模板
export const getAll = async (req, res) => {
  try {
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10
    const page = parseInt(req.query.page) || 1

    const [result] = await FormTemplate.aggregate([
      { $sort: { name: 1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: (page - 1) * itemsPerPage },
            { $limit: itemsPerPage }
          ]
        }
      }
    ])

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
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '未知錯誤'
    })
  }
}

// 編輯表單模板
export const edit = async (req, res) => {
  try {
    const original = await FormTemplate.findById(req.params.id)
    if (!original) throw new Error('NOT FOUND')

    const result = await FormTemplate.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        type: req.body.type,
        componentName: req.body.componentName
      },
      { new: true, runValidators: true }
    )

    // 記錄審計日誌
    await logUpdate(req.user, result, 'formTemplates', original.toObject(), req.body)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '表單模板修改成功',
      result
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      const message = error.errors[key].message
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message
      })
    } else if (error.message === 'ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '表單模板 ID 格式錯誤'
      })
    } else if (error.message === 'NOT FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到表單模板'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '未知錯誤'
      })
    }
  }
}

// 刪除表單模板
export const remove = async (req, res) => {
  try {
    const result = await FormTemplate.findById(req.params.id)
    if (!result) throw new Error('NOT FOUND')

    // 記錄審計日誌
    await logDelete(req.user, result, 'formTemplates')

    await result.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '表單模板刪除成功'
    })
  } catch (error) {
    if (error.message === 'ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '表單模板 ID 格式錯誤'
      })
    } else if (error.message === 'NOT FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到表單模板'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '未知錯誤'
      })
    }
  }
}

// 取得單個表單模板
export const getById = async (req, res) => {
  try {
    const result = await FormTemplate.findById(req.params.id)

    if (!result) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到表單模板'
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result
    })
  } catch (error) {
    if (error.name === 'CastError') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '表單模板 ID 格式錯誤'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '未知錯誤'
      })
    }
  }
}

// 添加搜尋方法
export const search = async (req, res) => {
  try {
    const query = {}

    if (req.query.type) {
      query.type = req.query.type
    }

    const result = await FormTemplate.find(query)
      .sort({ name: 1 })

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result
    })
  } catch (error) {
    console.error('搜尋失敗，錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '搜尋失敗'
    })
  }
}

// 新增表單模板搜尋建議
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
      name: searchRegex
    }

    const templates = await FormTemplate.find(query)
      .select('_id name')
      .limit(10)
      .lean()

    res.status(StatusCodes.OK).json({
      success: true,
      result: templates
    })
  } catch (error) {
    console.error('取得表單模板建議失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '取得表單模板建議失敗'
    })
  }
}

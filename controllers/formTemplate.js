import FormTemplate from '../models/formTemplate.js'
import Form from '../models/form.js'
import { StatusCodes } from 'http-status-codes'
import AuditLog from '../models/auditLog.js'
import Company from '../models/company.js'

// 創建表單模板
export const create = async (req, res) => {
  try {
    // 先印出收到的資料
    console.log('收到的資料:', req.body)

    // 檢查必填欄位
    if (!req.body.name || !req.body.company || !req.body.type || !req.body.componentName) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少必填欄位',
        missingFields: {
          name: !req.body.name,
          company: !req.body.company,
          type: !req.body.type,
          componentName: !req.body.componentName
        }
      })
    }

    const result = await FormTemplate.create({
      name: req.body.name,
      company: req.body.company,
      type: req.body.type,
      componentName: req.body.componentName
    })

    // 獲取公司資訊
    const companyData = await Company.findById(req.body.company)
    if (!companyData) {
      throw new Error('找不到公司資料')
    }

    // 記錄審計日誌
    await AuditLog.create({
      operatorId: req.user._id,
      operatorInfo: {
        name: req.user.name,
        userId: req.user.userId
      },
      action: '創建',
      targetId: result._id,
      targetInfo: {
        name: result.name
      },
      targetModel: 'formTemplates',
      changes: {
        表單名稱: {
          from: null,
          to: result.name
        },
        所屬公司: {
          from: null,
          to: companyData.name
        },
        表單類型: {
          from: null,
          to: result.type
        },
        組件名稱: {
          from: null,
          to: result.componentName
        }
      }
    })

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

    // 使用 aggregate 來處理分頁
    const [result] = await FormTemplate.aggregate([
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: '$company' },
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

// 依公司取得表單模板
export const getByCompany = async (req, res) => {
  try {
    const result = await FormTemplate.find({ company: req.params.companyId })
      .populate('company', 'name')
      .sort({ name: 1 })

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result
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
        company: req.body.company,
        type: req.body.type,
        componentName: req.body.componentName
      },
      { new: true, runValidators: true }
    )

    // 獲取新舊公司資訊
    const [originalCompany, newCompany] = await Promise.all([
      Company.findById(original.company),
      Company.findById(req.body.company)
    ])

    // 記錄審計日誌
    await AuditLog.create({
      operatorId: req.user._id,
      operatorInfo: {
        name: req.user.name,
        userId: req.user.userId
      },
      action: '修改',
      targetId: result._id,
      targetInfo: {
        name: result.name
      },
      targetModel: 'formTemplates',
      changes: {
        表單名稱: {
          from: original.name,
          to: result.name
        },
        所屬公司: {
          from: originalCompany?.name || '未知公司',
          to: newCompany?.name || '未知公司'
        },
        表單類型: {
          from: original.type,
          to: result.type
        },
        組件名稱: {
          from: original.componentName,
          to: result.componentName
        }
      }
    })

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

    // 檢查是否有關聯的表單
    const hasForm = await Form.exists({ formTemplate: req.params.id })
    if (hasForm) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '此表單模板已有相關表單，無法刪除'
      })
    }

    await result.deleteOne()

    // 記錄審計日誌
    await AuditLog.create({
      operatorId: req.user._id,
      operatorInfo: {
        name: req.user.name,
        userId: req.user.userId
      },
      action: '刪除',
      targetId: result._id,
      targetInfo: {
        name: result.name
      },
      targetModel: 'formTemplates',
      changes: {
        表單名稱: {
          from: result.name,
          to: null
        }
      }
    })

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
      .populate('company', 'name')

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
    console.log('收到搜尋請求')
    console.log('查詢參數:', req.query)

    const query = {}

    if (req.query.company) {
      query.company = req.query.company
      console.log('添加公司條件:', query.company)
    }

    if (req.query.type) {
      query.type = req.query.type
      console.log('添加類型條件:', query.type)
    }

    console.log('最終查詢條件:', query)

    const result = await FormTemplate.find(query)
      .populate('company', 'name')
      .sort({ name: 1 })

    console.log('查詢結果:', result)

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

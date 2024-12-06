import { StatusCodes } from 'http-status-codes'
import AuditLog from '../models/auditLog.js'
import mongoose from 'mongoose'

// 取得所有異動紀錄（包含分頁與排序）
export const getAll = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1

    const {
      operatorId,
      targetId,
      action,
      targetModel,
      startDate,
      endDate
    } = req.query

    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'operatorId',
          foreignField: '_id',
          as: 'operator'
        }
      },
      {
        $addFields: {
          operator: { $arrayElemAt: ['$operator', 0] }
        }
      },
      // 根據 targetModel 動態查詢對應的集合
      {
        $lookup: {
          from: 'users',
          localField: 'targetId',
          foreignField: '_id',
          as: 'userTarget'
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'targetId',
          foreignField: '_id',
          as: 'departmentTarget'
        }
      },
      {
        $lookup: {
          from: 'tempusers', // 新增 tempUsers 的 lookup
          localField: 'targetId',
          foreignField: '_id',
          as: 'tempUserTarget'
        }
      },
      // 根據 targetModel 選擇正確的 target 資料
      {
        $addFields: {
          targetData: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$targetModel', 'users'] },
                  then: { $arrayElemAt: ['$userTarget', 0] }
                },
                {
                  case: { $eq: ['$targetModel', 'departments'] },
                  then: { $arrayElemAt: ['$departmentTarget', 0] }
                },
                {
                  case: { $eq: ['$targetModel', 'tempUsers'] },
                  then: { $arrayElemAt: ['$tempUserTarget', 0] }
                }
              ],
              default: null
            }
          }
        }
      },
      // 清理中間結果
      {
        $project: {
          userTarget: 0,
          departmentTarget: 0,
          tempUserTarget: 0
        }
      }
    ]

    // 構建匹配條件
    const matchConditions = []

    // 優先使用 ID 查詢操作者
    if (operatorId) {
      if (mongoose.Types.ObjectId.isValid(operatorId)) {
        matchConditions.push({
          operatorId: new mongoose.Types.ObjectId(operatorId)
        })
      } else {
        matchConditions.push({
          $or: [
            { 'operator.userId': operatorId },
            { 'operatorInfo.userId': operatorId }
          ]
        })
      }
    }

    // 優先使用 ID 查詢目標對象
    if (targetId) {
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        matchConditions.push({
          targetId: new mongoose.Types.ObjectId(targetId)
        })
      } else {
        const searchConditions = []

        if (!targetModel || targetModel === 'users') {
          searchConditions.push(
            { 'targetData.userId': targetId },
            { 'targetInfo.userId': targetId }
          )
        }
        if (!targetModel || targetModel === 'departments') {
          searchConditions.push(
            { 'targetData.departmentId': targetId },
            { 'targetInfo.departmentId': targetId }
          )
        }
        if (!targetModel || targetModel === 'tempUsers') { // 新增 tempUsers 的搜尋條件
          searchConditions.push(
            { 'targetData.name': new RegExp(targetId, 'i') },
            { 'targetInfo.name': new RegExp(targetId, 'i') }
          )
        }

        matchConditions.push({ $or: searchConditions })
      }
    }

    if (action) {
      matchConditions.push({ action })
    }

    if (targetModel) {
      matchConditions.push({ targetModel })
    }

    // 日期範圍篩選
    if (startDate || endDate) {
      const dateCondition = {}
      if (startDate) {
        dateCondition.$gte = new Date(startDate)
      }
      if (endDate) {
        dateCondition.$lte = new Date(endDate)
      }
      matchConditions.push({ createdAt: dateCondition })
    }

    if (matchConditions.length > 0) {
      pipeline.push({
        $match: { $and: matchConditions }
      })
    }

    // 排序處理
    const sortBy = req.query.sortBy || 'createdAt'
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1
    pipeline.push({ $sort: { [sortBy]: sortOrder } })

    // 計算總數
    const countPipeline = [...pipeline]
    const [{ total } = { total: 0 }] = await AuditLog.aggregate([
      ...countPipeline,
      { $count: 'total' }
    ])

    // 分頁處理
    pipeline.push(
      { $skip: (page - 1) * itemsPerPage },
      { $limit: itemsPerPage }
    )

    const data = await AuditLog.aggregate(pipeline)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data,
        totalItems: total || 0,
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '獲取異動紀錄時發生錯誤',
      error: error.message
    })
  }
}

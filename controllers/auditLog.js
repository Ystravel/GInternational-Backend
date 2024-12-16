import { StatusCodes } from 'http-status-codes'
import AuditLog from '../models/auditLog.js'
import mongoose from 'mongoose'

// 搜尋異動紀錄
export const search = async (req, res) => {
  try {
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10
    const page = parseInt(req.query.page) || 1
    const query = {}

    // 處理日期範圍查詢
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate)
      const endDate = new Date(req.query.endDate)
      query.createdAt = {
        $gte: startDate,
        $lte: endDate
      }
    }

    // 處理操作類型篩選
    if (req.query.action) {
      query.action = req.query.action
    }

    // 處理目標模型篩選
    if (req.query.targetModel) {
      query.targetModel = req.query.targetModel
    }

    // 處理操作者篩選
    if (req.query.operatorId) {
      try {
        query.operatorId = new mongoose.Types.ObjectId(req.query.operatorId)
      } catch (error) {
        console.error('Invalid operatorId:', error)
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效的操作人員 ID'
        })
      }
    }

    // 處理操作對象篩選
    if (req.query.targetId) {
      try {
        // 將字串轉換為 ObjectId
        query.targetId = new mongoose.Types.ObjectId(req.query.targetId)
        console.log('處理後的 targetId query:', query.targetId)
      } catch (error) {
        console.error('轉換 targetId 失敗:', error)
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效的目標 ID'
        })
      }
    }

    console.log('最終查詢條件:', query)

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'operatorId',
          foreignField: '_id',
          as: 'operator'
        }
      },
      { $unwind: { path: '$operator', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          action: 1,
          targetModel: 1,
          operatorInfo: 1,
          targetInfo: 1,
          changes: 1,
          createdAt: 1,
          operator: {
            _id: 1,
            name: 1,
            userId: 1,
            adminId: 1
          }
        }
      },
      {
        $sort: req.query.sortBy
          ? { [req.query.sortBy]: parseInt(req.query.sortOrder) || -1 }
          : { createdAt: -1 }
      },
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

    const [result] = await AuditLog.aggregate(pipeline)
    console.log('查詢結果:', result)

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
    console.error('搜尋異動紀錄失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '搜尋失敗'
    })
  }
}

// 取得單一異動紀錄詳情
export const getById = async (req, res) => {
  try {
    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      {
        $lookup: {
          from: 'users',
          localField: 'operatorId',
          foreignField: '_id',
          as: 'operator'
        }
      },
      { $unwind: { path: '$operator', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          action: 1,
          targetModel: 1,
          operatorInfo: 1,
          targetInfo: 1,
          changes: 1,
          createdAt: 1,
          operator: {
            _id: 1,
            name: 1,
            userId: 1,
            adminId: 1
          }
        }
      }
    ]

    const [result] = await AuditLog.aggregate(pipeline)

    if (!result) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到異動紀錄'
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result
    })
  } catch (error) {
    console.error('取得異動紀錄詳情失敗:', error)
    if (error.name === 'CastError') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '異動紀錄 ID 格式錯誤'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '取得失敗'
      })
    }
  }
} 
// models/auditLog.js
import { Schema, model, ObjectId } from 'mongoose'

const auditLogSchema = new Schema({
  operatorId: {
    type: ObjectId,
    ref: 'users',
    default: null
  },
  action: {
    type: String,
    enum: ['創建', '修改', '刪除'],
    required: true
  },
  targetId: {
    type: ObjectId,
    refPath: 'targetModel',
    required: true
  },
  targetModel: {
    type: String,
    enum: ['users', 'formTemplates', 'forms', 'marketingCategories', 'marketingBudgets', 'marketingExpenses'],
    required: true
  },
  operatorInfo: {
    name: String,
    userId: String
  },
  targetInfo: {
    name: String,
    userId: String,
    formNumber: String
  },
  changes: {
    type: {
      before: Object,
      after: Object
    },
    default: {
      before: {},
      after: {}
    }
  }
}, {
  timestamps: true,
  versionKey: false
})

// 建立索引
auditLogSchema.index({ operatorId: 1 });
auditLogSchema.index({ targetId: 1 });
auditLogSchema.index({ 'operatorInfo.userId': 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ targetModel: 1 });

// 複合索引：常用的查詢組合
auditLogSchema.index({ targetModel: 1, createdAt: -1 });
auditLogSchema.index({ operatorId: 1, createdAt: -1 });

export default model('AuditLog', auditLogSchema)

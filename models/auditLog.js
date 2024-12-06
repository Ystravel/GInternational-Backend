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
    enum: ['創建', '修改', '刪除', '轉為正式'],
    required: true
  },
  targetId: {
    type: ObjectId,
    ref: 'users',
    required: true
  },
  targetModel: {
    type: String,
    enum: ['users', 'departments', 'assets', 'companies', 'tempUsers', 'announcements', 'formTemplates', 'forms'],
    required: true
  },
  operatorInfo: {
    name: String,
    userId: String
  },
  targetInfo: {
    name: String,
    userId: String,
    departmentId: String,
    companyId: String,
    formNumber: String
  },
  changes: {
    type: Object, // 改為 Object 類型而不是 Map
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default model('AuditLog', auditLogSchema)

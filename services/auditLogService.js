import AuditLog from '../models/auditLog.js'

export const createAuditLog = async ({
  operatorId,
  action,
  targetId,
  targetModel,
  operatorInfo,
  targetInfo,
  changes
}) => {
  try {
    return await AuditLog.create({
      operatorId,
      action,
      targetId,
      targetModel,
      operatorInfo,
      targetInfo,
      changes
    })
  } catch (error) {
    console.error('審計日誌創建失敗:', error)
    throw error
  }
}

// 用於記錄創建操作
export const logCreate = async (operator, target, targetModel) => {
  // 處理 operator 可能為 null 的情況
  const operatorInfo = operator ? {
    name: operator.name,
    userId: operator.userId || operator.adminId
  } : {
    name: 'System',
    userId: 'SYSTEM'
  }

  // 根據不同的 targetModel 處理 targetInfo
  const targetInfo = {}
  if (target) {
    switch (targetModel) {
      case 'users':
        targetInfo.name = target.name
        targetInfo.userId = target.userId || target.adminId
        break
      case 'forms':
        targetInfo.formNumber = target.formNumber
        targetInfo.clientName = target.clientName
        break
      case 'formTemplates':
        targetInfo.name = target.name
        targetInfo.type = target.type
        break
    }
  }

  // 過濾掉敏感資料
  const filteredTarget = { ...target }
  delete filteredTarget.password
  delete filteredTarget.confirmPassword
  delete filteredTarget.tokens
  delete filteredTarget.__v

  return createAuditLog({
    operatorId: operator?._id || null,
    action: '創建',
    targetId: target._id,
    targetModel,
    operatorInfo,
    targetInfo,
    changes: {
      before: {},
      after: filteredTarget
    }
  })
}

// 用於記錄修改操作
export const logUpdate = async (operator, target, targetModel, originalData, newData) => {
  // 處理 operator 可能為 null 的情況
  const operatorInfo = operator ? {
    name: operator.name,
    userId: operator.userId || operator.adminId
  } : {
    name: 'System',
    userId: 'SYSTEM'
  }

  // 根據不同的 targetModel 處理 targetInfo
  const targetInfo = {}
  if (target) {
    switch (targetModel) {
      case 'users':
        targetInfo.name = target.name
        targetInfo.userId = target.userId || target.adminId
        break
      case 'forms':
        targetInfo.formNumber = target.formNumber
        targetInfo.clientName = target.clientName
        break
      case 'formTemplates':
        targetInfo.name = target.name
        targetInfo.type = target.type
        break
    }
  }

  // 過濾掉敏感資料
  const filteredOriginalData = { ...originalData }
  const filteredNewData = { ...newData }
  
  const sensitiveFields = ['password', 'confirmPassword', 'tokens', '__v']
  sensitiveFields.forEach(field => {
    delete filteredOriginalData[field]
    delete filteredNewData[field]
  })

  // 計算變更的欄位
  const changes = {
    before: filteredOriginalData,
    after: filteredNewData,
    changedFields: Object.keys(filteredNewData).filter(key => 
      JSON.stringify(filteredOriginalData[key]) !== JSON.stringify(filteredNewData[key])
    )
  }

  return createAuditLog({
    operatorId: operator?._id || null,
    action: '修改',
    targetId: target._id,
    targetModel,
    operatorInfo,
    targetInfo,
    changes
  })
}

// 用於記錄刪除操作
export const logDelete = async (operator, target, targetModel) => {
  // 處理 operator 可能為 null 的情況
  const operatorInfo = operator ? {
    name: operator.name,
    userId: operator.userId || operator.adminId
  } : {
    name: 'System',
    userId: 'SYSTEM'
  }

  // 根據不同的 targetModel 處理 targetInfo
  const targetInfo = {}
  if (target) {
    switch (targetModel) {
      case 'users':
        targetInfo.name = target.name
        targetInfo.userId = target.userId || target.adminId
        break
      case 'forms':
        targetInfo.formNumber = target.formNumber
        targetInfo.clientName = target.clientName
        break
      case 'formTemplates':
        targetInfo.name = target.name
        targetInfo.type = target.type
        break
    }
  }

  return createAuditLog({
    operatorId: operator?._id || null,
    action: '刪除',
    targetId: target._id,
    targetModel,
    operatorInfo,
    targetInfo,
    changes: {
      before: target,
      after: {}
    }
  })
} 
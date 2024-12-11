/* eslint-disable camelcase */
import User from '../models/user.js'
import Form from '../models/form.js'
import UserRole from '../enums/UserRole.js'

/**
 * 獲取下一個可用的員工編號
 * @returns {Promise<string>} 格式化的員工編號 (例如: 'G0001')
 */
export const getNextUserNumber = async () => {
  // 查找所有用戶的 userId
  const users = await User.find({}, { userId: 1 }).sort({ userId: -1 })

  if (users.length === 0) {
    // 第一位員工
    return 'G0001'
  }

  // 提取現有員工編號的序號部分並找出最大值
  const maxUserId = users[0].userId
  const currentNumber = parseInt(maxUserId.substring(1))
  
  // 返回下一個序號
  return `G${String(currentNumber + 1).padStart(4, '0')}`
}

/**
 * 獲取下一個表單編號
 * @param {string} formType - 表單類型 (QT: 報價單, AP: 申請單, EX: 出差申請)
 * @returns {Promise<string>} 格式化的表單編號 (例如: 202411290001)
 */
export const getNextFormNumber = async (formType) => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const monthPrefix = `${year}${month}` // 年月前綴

  // 查找當月的所有特定類型表單
  const forms = await Form.find({
    formNumber: new RegExp(`^${monthPrefix}`),
    formType // 加入表單類型件
  }, { formNumber: 1 }).sort({ formNumber: -1 }) // 按編號降序排序

  // 如果當月沒有表單，從 1 開始
  if (forms.length === 0) {
    return `${year}${month}${day}0001`
  }

  // 取得當月最大序號
  const lastForm = forms[0]
  const currentNumber = parseInt(lastForm.formNumber.slice(-4))
  const nextNumber = String(currentNumber + 1).padStart(4, '0')

  // 返回新編號 (使用當天日期 + 序號)
  return `${year}${month}${day}${nextNumber}`
}

/**
 * 獲取下一個可用的管理者編號
 * @returns {Promise<string>} 格式化的管理者編號 (例如: 'A001')
 */
export const getNextAdminNumber = async () => {
  // 查找所有管理者的 adminId
  const admins = await User.find({ role: UserRole.ADMIN })
    .select('adminId')
    .sort({ adminId: -1 })
    .lean()

  // 過濾出有 adminId 的記錄
  const adminsWithId = admins.filter(admin => admin.adminId)

  if (adminsWithId.length === 0) {
    // 第一位管理者
    return 'A001'
  }

  // 提取現有管理者編號的序號部分並找出最大值
  const maxAdminId = adminsWithId[0].adminId
  const currentNumber = parseInt(maxAdminId.substring(1))
  
  // 返回下一個序號
  return `A${String(currentNumber + 1).padStart(3, '0')}`
}

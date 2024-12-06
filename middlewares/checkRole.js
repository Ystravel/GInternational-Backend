import { StatusCodes } from 'http-status-codes'

// 檢查使用者是否具有所需角色
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // 確保 req.user 已被 auth.jwt 中間件設置
    if (!req.user || !req.user.role) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: '未經授權的訪問'
      })
    }

    const userRole = req.user.role

    // 檢查使用者角色是否在允許的角色列表中
    if (!allowedRoles.includes(userRole)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '權限不足'
      })
    }

    next()
  }
}

export default checkRole

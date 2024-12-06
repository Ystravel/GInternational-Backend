import { Router } from 'express'
import * as auditLog from '../controllers/auditLog.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'

const router = Router()

// 取得所有異動紀錄（僅限 HR, ADMIN, SUPER_ADMIN）
router.get('/all',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  auditLog.getAll
)

export default router

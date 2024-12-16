import { Router } from 'express'
import { search, getById } from '../controllers/auditLog.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'


const router = Router()

// 查詢異動紀錄 (需要管理員權限)
router.get('/', auth.jwt, checkRole([UserRole.ADMIN]), search)

// 取得單一異動紀錄詳情 (需要管理員權限)
router.get('/:id', auth.jwt, checkRole([UserRole.ADMIN]), getById)

export default router
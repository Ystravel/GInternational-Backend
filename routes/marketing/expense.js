import { Router } from 'express'
import {
  create,
  getAll,
  getById,
  edit,
  remove,
  getMonthlyStats,
  getYearsByTheme,
  getLineExpenses,
  getLineOptions
} from '../../controllers/marketing/expense.js'
import * as auth from '../../middlewares/auth.js'
import checkRole from '../../middlewares/checkRole.js'
import UserRole from '../../enums/UserRole.js'

const router = Router()

// 需要管理者權限的路由
router.post('/', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), create)
router.patch('/:id', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), edit)
router.delete('/:id', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), remove)

// 一般用戶也可以使用的路由
router.get('/all', auth.jwt, getAll)
router.get('/monthly-stats', auth.jwt, getMonthlyStats)
router.get('/years/:theme', auth.jwt, getYearsByTheme)
router.get('/:id', auth.jwt, getById)

// 新增行銷各線實際支出表的路由
router.get('/line-expenses', auth.jwt, getLineExpenses)

// 新增行銷線別選項的路由
router.get('/lines/options', auth.jwt, getLineOptions)

export default router 
import { Router } from 'express'
import {
  create,
  getAll,
  getById,
  edit,
  remove,
  getYearOptions,
  getByYearAndTheme,
  getYearsByTheme
} from '../../controllers/marketing/budget.js'
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
router.get('/years', auth.jwt, getYearOptions)
router.get('/years/:theme', auth.jwt, getYearsByTheme)
router.get('/:year/:theme', auth.jwt, getByYearAndTheme)
router.get('/:id', auth.jwt, getById)

export default router 
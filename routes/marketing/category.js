import { Router } from 'express'
import {
  create,
  getAll,
  edit,
  remove,
  getOptions
} from '../../controllers/marketing/category.js'
import * as auth from '../../middlewares/auth.js'
import checkRole from '../../middlewares/checkRole.js'
import UserRole from '../../enums/UserRole.js'

const router = Router()

// 需要管理者權限的路由
router.post('/', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), create)
router.get('/all', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), getAll)
router.patch('/:id', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), edit)
router.delete('/:id', auth.jwt, checkRole([UserRole.ADMIN, UserRole.MANAGER]), remove)

// 一般用戶也可以使用的路由
router.get('/options', auth.jwt, getOptions)

export default router 
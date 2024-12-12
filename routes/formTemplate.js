import { Router } from 'express'
import {
  create,
  getAll,
  edit,
  remove,
  getById,
  search
} from '../controllers/formTemplate.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'

const router = Router()

// 取得所有表單模板
router.get('/all',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  getAll
)

// 搜尋表單模板
router.get('/search',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  search
)

// 創建表單模板
router.post('/',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  create
)

// 編輯表單模板
router.patch('/:id',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  edit
)

// 刪除表單模板
router.delete('/:id',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  remove
)

// 取得單個表單模板
router.get('/:id',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  getById
)

export default router

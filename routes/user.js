import { Router } from 'express'
import {
  create,
  getAll,
  edit,
  login,
  logout,
  profile,
  googleLogin,
  changePassword,
  forgotPassword,
  resetPassword,
  remove,
  getSuggestions,
  search,
  searchAdmins
} from '../controllers/user.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'

const router = Router()

// 登入相關路由
router.post('/login', auth.login, login)
router.post('/google-login', googleLogin)
router.delete('/logout', auth.jwt, logout)

// 密碼相關路由
router.patch('/change-password', auth.jwt, changePassword)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

// 用戶資料相關路由
router.post('/', auth.jwt, checkRole([UserRole.ADMIN]), create)
router.get('/all', auth.jwt, checkRole([UserRole.ADMIN]), getAll)
router.get('/profile', auth.jwt, profile)
router.get('/suggestions', auth.jwt, getSuggestions)
router.get('/search/admins', auth.jwt, checkRole([UserRole.ADMIN]), searchAdmins)
router.get('/search', auth.jwt, checkRole([UserRole.ADMIN]), search)

// 用戶管理路由
router.patch('/:id', auth.jwt, checkRole([UserRole.ADMIN]), edit)
router.delete('/:id', auth.jwt, checkRole([UserRole.ADMIN]), remove)

export default router

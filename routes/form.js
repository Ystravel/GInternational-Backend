import { Router } from 'express'
import { create, search, remove, uploadPDF, getSuggestions, getRayHuangQuotationNextNumber, getYstravelQuotationNextNumber } from '../controllers/form.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'
import uploadForm from '../middlewares/uploadForm.js'

const router = Router()

router.post('/',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  create
)

router.get('/',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  search
)

router.delete('/:id',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  remove
)

router.post('/upload/pdf',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  uploadForm,
  uploadPDF
)

router.get('/ray-huang-quotation/next-number',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  getRayHuangQuotationNextNumber
)

router.get('/ystravel-quotation/next-number',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  getYstravelQuotationNextNumber
)

router.get('/suggestions',
  auth.jwt,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  getSuggestions
)

export default router

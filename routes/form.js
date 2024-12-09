import { Router } from 'express'
import { create, search, remove, uploadPDF, getNextNumber } from '../controllers/form.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'
import uploadForm from '../middlewares/uploadForm.js'

const router = Router()

router.post('/',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  create
)

router.get('/',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  search
)

router.delete('/:id',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  remove
)

router.post('/upload/pdf',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  uploadForm,
  uploadPDF
)

router.get('/next-number',
  auth.jwt,
  checkRole([UserRole.ADMIN]),
  getNextNumber
)

export default router

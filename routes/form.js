import { Router } from 'express'
import { create, search, remove, uploadPDF, getSuggestions, getRayHuangQuotationNextNumber, getYstravelQuotationNextNumber } from '../controllers/form.js'
import * as auth from '../middlewares/auth.js'
import checkRole from '../middlewares/checkRole.js'
import UserRole from '../enums/UserRole.js'
import uploadForm from '../middlewares/uploadForm.js'

const router = Router()

router.post('/',
  auth.jwt,
  create
)

router.get('/',
  auth.jwt,
  search
)

router.delete('/:id',
  auth.jwt,
  remove
)

router.post('/upload/pdf',
  auth.jwt,
  uploadForm,
  uploadPDF
)

router.get('/ray-huang-quotation/next-number',
  auth.jwt,
  getRayHuangQuotationNextNumber
)

router.get('/ystravel-quotation/next-number',
  auth.jwt,
  getYstravelQuotationNextNumber
)

router.get('/suggestions',
  auth.jwt,
  getSuggestions
)

export default router

import User from '../models/user.js'
import { StatusCodes } from 'http-status-codes'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import validator from 'validator'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { fileURLToPath } from 'url'
import path, { dirname } from 'path'
import { getNextUserNumber, getNextAdminNumber } from '../utils/sequence.js'
import UserRole from '../enums/UserRole.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export const create = async (req, res) => {
  try {
    const { isAdmin } = req.body
    let idNumber

    if (isAdmin) {
      idNumber = await getNextAdminNumber()
      req.body.adminId = idNumber
      req.body.role = UserRole.ADMIN
      delete req.body.userId
    } else {
      idNumber = await getNextUserNumber()
      req.body.userId = idNumber
      delete req.body.adminId
    }

    if (!req.body.employmentStatus) {
      req.body.employmentStatus = '在職'
    }

    const result = await User.create({
      ...req.body
    })

    res.status(StatusCodes.OK).json({
      success: true,
      message: isAdmin ? '管理者創建成功' : '用戶創建成功',
      result: {
        ...result.toObject(),
        password: undefined
      }
    })
  } catch (error) {
    console.error('Create user error:', error)
    handleError(res, error)
  }
}

export const login = async (req, res) => {
  try {
    console.log('Login attempt for user:', req.user.email)
    
    const token = jwt.sign({ _id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '10h' })
    console.log('Generated token:', token)
    
    req.user.tokens.push(token)
    await req.user.save()

    const response = {
      success: true,
      message: '',
      result: {
        token,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        userId: req.user.userId,
        avatar: req.user.avatar,
        note: req.user.note
      }
    }
    
    console.log('Sending response:', response)
    res.status(StatusCodes.OK).json(response)
  } catch (error) {
    console.error('Login error:', error)
    handleError(res, error)
  }
}

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage'
)

export const googleLogin = async (req, res) => {
  try {
    const { code } = req.body
    
    const { tokens } = await oauth2Client.getToken(code)
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    const email = payload.email

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '此Email尚未註冊'
      })
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '10h'
    })

    user.tokens.push(token)
    await user.save()

    res.status(200).json({
      success: true,
      message: '登入成功',
      result: {
        token,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        avatar: user.avatar,
        adminId: user.adminId,
        note: user.note
      }
    })
  } catch (error) {
    console.error('Google驗證錯誤:', error)
    res.status(401).json({
      success: false,
      message: 'Google登入驗證失敗'
    })
  }
}

export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        name: user.name,
        email: user.email,
        userId: user.userId,
        role: user.role,
        note: user.note,
        avatar: user.avatar,
        adminId: user.adminId
      }
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const getAll = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1
    const query = {}

    // 處理查詢條件
    if (req.query.role !== undefined) {
      query.role = Number(req.query.role)
    }

    const result = await User.find(query)
      .sort({ [req.query.sortBy || 'userId']: req.query.sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)

    const total = await User.countDocuments(query)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data: result,
        totalItems: total,
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const getSuggestions = async (req, res) => {
  try {
    const search = req.query.search || ''
    const searchRegex = new RegExp(search, 'i')
    const query = {
      $or: [
        { name: searchRegex },
        { userId: searchRegex },
        { email: searchRegex }
      ]
    }

    const users = await User.find(query)
      .select('name userId email')
      .limit(10)

    res.status(StatusCodes.OK).json({
      success: true,
      result: users
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const logout = async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(token => token !== req.token)
    await req.user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '登出成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const remove = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const user = await User.findById(req.params.id)
    if (!user) {
      throw new Error('NOT FOUND')
    }

    await user.deleteOne()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '用戶刪除成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.user._id)

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '當前密碼輸入錯誤'
      })
    }

    if (newPassword.length < 8) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '新密碼長度至少需要8個字元'
      })
    }

    user.password = newPassword
    await user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '密碼更新成功'
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const edit = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) throw new Error('ID')

    const updateData = { ...req.body }
    delete updateData.password

    if (updateData.employmentStatus && 
        !['在職', '離職', '退休', '留職停薪'].includes(updateData.employmentStatus)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的任職狀態'
      })
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!updatedUser) {
      throw new Error('NOT FOUND')
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '用戶資料更新成功',
      result: updatedUser
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '此電子郵件未註冊'
      })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = resetToken
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000) // 30分鐘後過期
    await user.save()

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '鋭皇數位行銷設計 EIP - 密碼重置請求',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #333;">密碼重置請求</h2>
          </div>
          
          <div style="background: #f7f7f7; padding: 28px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin-top: 0; font-size: 14px; font-weight: 600">${user.name} 您好，</p>
            <p style="font-size: 14px; font-weight: 500">我們收到了您的密碼重置請求。請點擊下方連結重置您的密碼：</p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetUrl}" 
                  style="background: #AB47BC; color: white; padding: 12px 24px; 
                        text-decoration: none; letter-spacing:2px; font-size:14px; border-radius: 5px; display: inline-block;">
                重置密碼
              </a>
            </div>
            <p style="color: #666; font-size: 13px;">
              此連結將在30分鐘後失效。<br>
              如果您沒有請求重置密碼，請忽略此郵件。
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; margin-bottom: 20px;">GInternational EIP System</p>
            <img src="cid:logo" alt="GInternational Logo" style="max-width: 150px; height: auto;">
          </div>

          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>此為系統自動發送的郵件，請勿直接回覆</p>
          </div>
        </div>
      `,
      attachments: [{
        filename: 'logo.png',
        path: path.join(__dirname, '../public/images/GInternational_Logo.png'),
        cid: 'logo'
      }]
    }

    await transporter.sendMail(mailOptions)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '重置密碼郵件已發送，請檢查您的信箱'
    })
  } catch (error) {
    handleError(res, error)
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { resetPasswordToken: token, password: newPassword } = req.body

    // 先找到用戶
    const user = await User.findOne({ resetPasswordToken: token })

    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '重置連結無效或已過期'
      })
    }

    if (newPassword.length < 8) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '新密碼長度至少需要8個字元'
      })
    }

    user.password = newPassword
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '密碼重置成功，請使用新密碼登入'
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 搜尋管理者
export const searchAdmins = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1
    let query = { role: UserRole.ADMIN }  // 固定只搜尋管理者

    if (req.query.quickSearch) {
      const searchQuery = [
        { name: new RegExp(req.query.quickSearch, 'i') },
        { adminId: new RegExp(req.query.quickSearch, 'i') },
        { email: new RegExp(req.query.quickSearch, 'i') },
        { note: new RegExp(req.query.quickSearch, 'i') }
      ]
      
      query = {
        $and: [
          { role: UserRole.ADMIN },
          { $or: searchQuery }
        ]
      }
    }

    const result = await User.find(query)
      .sort({ [req.query.sortBy || 'adminId']: req.query.sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)

    const total = await User.countDocuments(query)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data: result,
        totalItems: total,
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 修改原本的 search 函數，專門用於搜尋一般使用者
export const search = async (req, res) => {
  try {
    const itemsPerPage = req.query.itemsPerPage * 1 || 10
    const page = parseInt(req.query.page) || 1
    
    // 使用 $or 來查詢一般用戶和經理
    let query = { 
      $or: [
        { role: UserRole.USER },
        { role: UserRole.MANAGER }
      ]
    }

    if (req.query.quickSearch) {
      const searchQuery = [
        { name: new RegExp(req.query.quickSearch, 'i') },
        { userId: new RegExp(req.query.quickSearch, 'i') },
        { email: new RegExp(req.query.quickSearch, 'i') },
        { note: new RegExp(req.query.quickSearch, 'i') }
      ]
      
      // 組合搜尋條件
      query = {
        $and: [
          { 
            $or: [
              { role: UserRole.USER },
              { role: UserRole.MANAGER }
            ]
          },
          { $or: searchQuery }
        ]
      }
    }

    // 先獲取總數
    const total = await User.countDocuments(query)

    // 然後獲取分頁數據
    const result = await User.find(query)
      .sort({ [req.query.sortBy || 'userId']: req.query.sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: {
        data: result,
        totalItems: total,
        itemsPerPage,
        currentPage: page
      }
    })
  } catch (error) {
    handleError(res, error)
  }
}

// 統一錯誤處理
const handleError = (res, error) => {
  console.error('Error details:', error)
  
  if (error.name === 'ValidationError') {
    const key = Object.keys(error.errors)[0]
    const message = error.errors[key].message
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message
    })
  }

  if (error.code === 11000) {
    // 處理重複鍵錯誤
    const field = Object.keys(error.keyPattern)[0]
    let message
    switch (field) {
      case 'email':
        message = 'Email 已註冊'
        break
      case 'userId':
        message = '使用者編號已註冊'
        break
      case 'adminId':
        message = '管理者編號已註冊'
        break
      default:
        message = '資料重複'
    }
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '未知錯誤'
  })
} 
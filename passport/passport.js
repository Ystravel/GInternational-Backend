import passport from 'passport'
import passportLocal from 'passport-local'
import passportJWT from 'passport-jwt'
import bcrypt from 'bcrypt'
import User from '../models/user.js'

passport.use('login', new passportLocal.Strategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ email })
    if (!user) {
      throw new Error('EMAIL_NOT_FOUND')
    }


    if (!bcrypt.compareSync(password, user.password)) {
      throw new Error('PASSWORD_INCORRECT')
    }

    return done(null, user, null)
  } catch (error) {
    console.log('Login error:', error)
    if (error.message === 'EMAIL_NOT_FOUND') {
      return done(null, null, { message: '此電子郵件尚未申請' })
    } else if (error.message === 'PASSWORD_INCORRECT') {
      return done(null, null, { message: '密碼錯誤' })
    } else {
      return done(null, null, { message: '未知錯誤' })
    }
  }
}))

passport.use('jwt', new passportJWT.Strategy({
  jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  passReqToCallback: true,
  ignoreExpiration: true
}, async (req, payload, done) => {
  try {
    const expired = payload.exp * 1000 < new Date().getTime()

    const url = req.baseUrl + req.path
    if (expired && url !== '/user/extend' && url !== '/user/logout') {
      throw new Error('TOKEN_EXPIRED')
    }

    const token = passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken()(req)
    const user = await User.findOne({ _id: payload._id, tokens: token })

    if (!user) {
      throw new Error('JWT')
    }

    return done(null, { user, token }, null)
  } catch (error) {
    if (error.message === 'TOKEN_EXPIRED') {
      return done(null, null, { message: '登入過期' })
    } else if (error.message === 'JWT') {
      return done(null, null, { message: '登入無效' })
    // } else if (error.message === 'ACCOUNT_DISABLED') {
    //   return done(null, null, { message: '此帳號已停用，如有疑問請聯絡人資部門' })
    } else {
      return done(null, null, { message: '未知錯誤' })
    }
  }
}))

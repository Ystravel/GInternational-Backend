import passport from 'passport'
import { StatusCodes } from 'http-status-codes'

export const login = (req, res, next) => {
  passport.authenticate('login', { session: false }, (error, user, info) => {
    if (!user || error) {
      if (info) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: info.message
        })
        return
      }
      res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: '未知錯誤'
      })
      return
    }
    req.user = user
    next()
  })(req, res, next)
}

export const jwt = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (error, data, info) => {
    if (!data || error) {
      if (info) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: info.message
        })
        return
      }
      res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: '未知錯誤'
      })
      return
    }
    req.user = data.user
    req.token = data.token
    next()
  })(req, res, next)
}
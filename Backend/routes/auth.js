const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const GoogleAuthController = require('../controllers/googleAuthController');
const { authenticate, authRateLimit } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
  verifyEmailValidation,
  refreshTokenValidation
} = require('../middleware/validation');

router.post('/register', authRateLimit, registerValidation, AuthController.register);
router.post('/login', authRateLimit, loginValidation, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.post('/refresh-token', AuthController.refreshToken);

router.post('/verify-email', verifyEmailValidation, AuthController.verifyEmail);
router.post('/resend-verification', authenticate, AuthController.resendVerificationEmail);

router.post('/forgot-password', authRateLimit, forgotPasswordValidation, AuthController.forgotPassword);
router.post('/reset-password', authRateLimit, AuthController.resetPassword);
router.post('/change-password', authenticate, AuthController.changePassword);

router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, updateProfileValidation, AuthController.updateProfile);

router.get('/google', GoogleAuthController.googleAuth);
router.get('/google/callback', GoogleAuthController.googleCallback);

router.post('/google/register-login', authRateLimit, GoogleAuthController.googleRegisterLogin);

router.post('/google/link', authenticate, GoogleAuthController.linkGoogle);
router.delete('/google/unlink', authenticate, GoogleAuthController.unlinkGoogle);
router.get('/google/status', authenticate, GoogleAuthController.getGoogleAuthStatus);

module.exports = router;
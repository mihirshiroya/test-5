const passport = require('passport');
const AuthUtils = require('../utils/auth');
const prisma = require('../config/database');

class GoogleAuthController {
  static googleAuth = passport.authenticate('google', {
    scope: ['profile', 'email']
  });

  static async googleCallback(req, res) {
    passport.authenticate('google', { session: false }, async (err, user, info) => {
      try {
        if (err) {
          console.error('Google OAuth error:', err);
          return res.redirect(`${process.env.CLIENT_URL}/auth/error?message=Authentication failed`);
        }

        if (!user) {
          return res.redirect(`${process.env.CLIENT_URL}/auth/error?message=Authentication failed`);
        }

        const tokenPayload = AuthUtils.createTokenPayload(user);
        const { accessToken, refreshToken } = AuthUtils.generateTokens(tokenPayload);

        await AuthUtils.saveRefreshToken(user.id, refreshToken);

        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: false,
          maxAge: 15 * 60 * 1000,
          sameSite: 'lax'
        });

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: false,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          sameSite: 'lax'
        });

        const redirectUrl = `${process.env.CLIENT_URL}/auth/success`;
        
        res.redirect(redirectUrl);


      } catch (error) {
        console.error('Google callback error:', error);
        res.redirect(`${process.env.CLIENT_URL}/auth/error?message=Authentication failed`);
      }
    })(req, res);
  }

  static async googleRegisterLogin(req, res) {
    try {
      const { googleToken, googleId, email, firstName, lastName, avatar } = req.body;

      
      console.log("oopsss called")
      if (!googleToken || !googleId || !email) {
        return res.status(400).json({
          success: false,
          message: 'Google authentication data is required'
        });
      }

      let user = await prisma.user.findUnique({
        where: { googleId }
      });

      if (!user) {
        user = await prisma.user.findUnique({
          where: { email }
        });
      }

      let isNewUser = false;

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            googleId,
            provider: 'GOOGLE',
            isActive: true,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
            avatar: avatar || null,
            lastLoginAt: new Date()
          }
        });
        isNewUser = true;
      } else if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            isEmailVerified: true,
            emailVerifiedAt: user.emailVerifiedAt || new Date(),
            emailVerificationToken: null,
            lastLoginAt: new Date(),
            avatar: avatar || user.avatar
          }
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            avatar: avatar || user.avatar
          }
        });
      }

      if (!user.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      const tokenPayload = AuthUtils.createTokenPayload(user);
      const { accessToken, refreshToken } = AuthUtils.generateTokens(tokenPayload);

      await AuthUtils.saveRefreshToken(user.id, refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.status(isNewUser ? 201 : 200).json({
        success: true,
        message: isNewUser 
          ? 'User registered successfully with Google' 
          : 'Login successful',
        data: {
          user: AuthUtils.sanitizeUser(user),
          tokens: {
            accessToken,
            refreshToken
          },
          isNewUser
        }
      });

    } catch (error) {
      console.error('Google register/login error:', error);
      res.status(500).json({
        success: false,
        message: 'Google authentication failed'
      });
    }
  }

  static async linkGoogle(req, res) {
    try {
      const userId = req.user.id;
      const { googleId, googleEmail } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { googleId }
      });

      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          message: 'This Google account is already linked to another account'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          googleId,
          ...(req.user.email === googleEmail && !req.user.isEmailVerified && {
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationToken: null
          })
        }
      });

      res.json({
        success: true,
        message: 'Google account linked successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Link Google error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to link Google account'
      });
    }
  }

  static async unlinkGoogle(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user.password && user.provider === 'GOOGLE') {
        return res.status(400).json({
          success: false,
          message: 'Cannot unlink Google account. Please set a password first to maintain account access.'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          googleId: null,
          ...(user.provider === 'GOOGLE' && { provider: 'LOCAL' })
        }
      });

      res.json({
        success: true,
        message: 'Google account unlinked successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Unlink Google error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unlink Google account'
      });
    }
  }

  static async getGoogleAuthStatus(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          googleId: true,
          provider: true,
          password: true
        }
      });

      res.json({
        success: true,
        data: {
          isLinked: !!user.googleId,
          provider: user.provider,
          hasPassword: !!user.password,
          canUnlink: !!(user.password || user.provider !== 'GOOGLE')
        }
      });
    } catch (error) {
      console.error('Get Google auth status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Google auth status'
      });
    }
  }
}

module.exports = GoogleAuthController;
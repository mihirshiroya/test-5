const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const prisma = require('./database');
const AuthUtils = require('../utils/auth');

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        provider: true,
        isEmailVerified: true,
        isActive: true
      }
    });

    if (user && user.isActive) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (error) {
    return done(error, false);
  }
}));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await prisma.user.findUnique({
      where: { googleId: profile.id }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          lastLoginAt: new Date(),
          avatar: profile.photos?.[0]?.value || user.avatar
        }
      });
      return done(null, user);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: profile.emails[0].value }
    });

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          googleId: profile.id,
          provider: 'GOOGLE',
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          avatar: profile.photos?.[0]?.value || existingUser.avatar
        }
      });
      return done(null, user);
    }

    user = await prisma.user.create({
      data: {
        email: profile.emails[0].value,
        googleId: profile.id,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        provider: 'GOOGLE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        avatar: profile.photos?.[0]?.value
      }
    });

    return done(null, user);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        provider: true,
        isEmailVerified: true,
        isActive: true,
        avatar: true
      }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
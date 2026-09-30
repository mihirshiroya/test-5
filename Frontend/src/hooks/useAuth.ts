
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAppDispatch, useAppSelector } from './redux';
import { clearAuth, updateUser } from '../store/slices/authSlice';
import type {
  ChangePasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '../types';
import { toast } from 'react-toastify';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  const logout = useMutation({
    mutationFn: (logoutAll: boolean = false) => authApi.logout(),
    onSuccess: () => {
      dispatch(clearAuth());
      queryClient.clear();
      toast.success('Logged out successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Logout failed');
    }
  });

  const changePassword = useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  });

  const updateProfile = useMutation({
    mutationFn: (data: UpdateProfileRequest) => authApi.updateProfile(data),
    onSuccess: (response:any) => {
      dispatch(updateUser(response.data.user));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(response.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  });

  const verifyEmail = useMutation({
    mutationFn: (data: VerifyEmailRequest) => authApi.verifyEmail(data),
    onSuccess: (response) => {
      dispatch(updateUser(response.data!.user));
      toast.success('Email verified successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Email verification failed');
    }
  });

  const resendVerification = useMutation({
    mutationFn: () => authApi.resendVerificationEmail(),
    onSuccess: () => {
      toast.success('Verification email sent');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send verification email');
    }
  });

  const forgotPassword = useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authApi.forgotPassword(data),
    onSuccess: () => {
      toast.success('Password reset link sent to your email');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send password reset email');
    }
  });

  const resetPassword = useMutation({
    mutationFn: (data: ResetPasswordRequest) => authApi.resetPassword(data),
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    }
  });

  // Get Google auth status
  const googleAuthStatus = useQuery({
    queryKey: ['googleAuthStatus'],
    queryFn: () => authApi.getGoogleAuthStatus(),
    enabled: !!isAuthenticated,
  });

  const linkGoogle = useMutation({
    mutationFn: (data: { googleId: string; googleEmail: string }) => authApi.linkGoogle(data),
    onSuccess: (response:any) => {
      dispatch(updateUser(response.data.user));
      queryClient.invalidateQueries({ queryKey: ['googleAuthStatus'] });
      toast.success('Google account linked successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to link Google account');
    }
  });

  const unlinkGoogle = useMutation({
    mutationFn: () => authApi.unlinkGoogle(),
    onSuccess: (response:any) => {
      dispatch(updateUser(response.data.user));
      queryClient.invalidateQueries({ queryKey: ['googleAuthStatus'] });
      toast.success('Google account unlinked successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to unlink Google account');
    }
  });

  const activeSessions = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => authApi.getActiveSessions(),
    enabled: !!isAuthenticated,
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      toast.success('Session revoked successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to revoke session');
    }
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    changePassword,
    updateProfile,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    googleAuthStatus,
    linkGoogle,
    unlinkGoogle,
    activeSessions,
    revokeSession,
  };
};
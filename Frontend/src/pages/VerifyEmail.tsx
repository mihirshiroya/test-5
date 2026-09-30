
import React, { useEffect, useState } from "react";
import { useSearchParams, Link, data } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "../components/Ui/Button";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api"; 

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const dispatch = useDispatch();

  const user = useSelector((state: any) => state.auth.user);

  const [verifyState, setVerifyState] = useState<{
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
  }>({
    isPending: false,
    isError: false,
    isSuccess: false,
  });

  const [resendState, setResendState] = useState<{ isPending: boolean }>({
    isPending: false,
  });

  useEffect(() => {
    const verify = async () => {
      if (!token) return;
      try {
        setVerifyState({ isPending: true, isError: false, isSuccess: false });

        const res = await axios.post(
          `${API_BASE_URL}/auth/verify-email`,
          { token },
          { withCredentials: true }
        );

        dispatch(setCredentials(res.data.data));
        console.log("credentials",res.data.data)
        setVerifyState({ isPending: false, isError: false, isSuccess: true });
        toast.success("Email verified successfully!");
      } catch (err: any) {
        console.error(err);
        setVerifyState({ isPending: false, isError: true, isSuccess: false });
        toast.error(
          err.response?.data?.message ||
            "Verification failed. Please try again."
        );
      }
    };
    verify();
  }, [token, dispatch]);

  const handleResendVerification = async () => {
    try {
      setResendState({ isPending: true });

      const res = await axios.post(
        `${API_BASE_URL}/auth/resend-verification`,
        {},
        { withCredentials: true }
      );

      toast.success(res.data.message || "Verification email sent!");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          "Failed to resend verification email. Try again."
      );
    } finally {
      setResendState({ isPending: false });
    }
  };

  if (token && verifyState.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Verifying your email...
          </h2>
          <p className="mt-2 text-gray-600">
            Please wait while we verify your email address.
          </p>
        </div>
      </div>
    );
  }

  if (token && verifyState.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Verification Failed
            </h2>
            <p className="mt-2 text-gray-600">
              The verification link is invalid or has expired.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Link
              to="/dashboard"
              className="text-black px-4 py-2 rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (token && verifyState.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Email Verified!
            </h2>
            <p className="mt-2 text-gray-600">
              Your email address has been successfully verified.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-6">
              You now have access to all features of your account.
            </p>
            <Link to="/dashboard">
              <Button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Check Your Email
          </h2>
          <p className="mt-2 text-gray-600">
            We've sent a verification link to <strong>{user?.email}</strong>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <p className="text-gray-600 mb-6">
              Click the link in your email to verify your account. If you don't
              see the email, check your spam folder.
            </p>

            <div className="space-y-4">
              <Button
                onClick={handleResendVerification}
                loading={resendState.isPending}
                variant="outline"
                className="w-full"
              >
                Resend Verification Email
              </Button>

              <div className="text-sm text-gray-500">
                Didn't receive the email? Make sure you entered the correct
                email address or try resending.
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            to="/dashboard"
            className="text-primary-600 hover:text-primary-500 transition-colors"
          >
            Skip for now (limited access)
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

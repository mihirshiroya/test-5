
import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { Button } from '../components/Ui/Button';
import { Input } from '../components/Ui/Input';
import { useAuth } from '../hooks/useAuth';

const resetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset token');
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    if (!token) return;
    
    resetPassword.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success('Password reset successfully! You can now sign in with your new password.');
          navigate('/login');
        }
      }
    );
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <Formik
            initialValues={{ password: '', confirmPassword: '' }}
            validationSchema={resetPasswordSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched, isSubmitting }) => (
              <Form className="space-y-6">
                <Field name="password">
                  {({ field }: any) => (
                    <Input
                      {...field}
                      type="password"
                      label="New Password"
                      placeholder="Enter your new password"
                      error={touched.password && errors.password ? errors.password : undefined}
                      helperText="Must contain uppercase, lowercase, number and special character"
                    />
                  )}
                </Field>

                <Field name="confirmPassword">
                  {({ field }: any) => (
                    <Input
                      {...field}
                      type="password"
                      label="Confirm New Password"
                      placeholder="Confirm your new password"
                      error={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : undefined}
                    />
                  )}
                </Field>

                <Button
                  type="submit"
                  loading={isSubmitting || resetPassword.isPending}
                  className="w-full"
                >
                  Reset Password
                </Button>
              </Form>
            )}
          </Formik>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
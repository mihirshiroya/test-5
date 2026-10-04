import { useId, type ComponentProps } from 'react';
import { LoaderCircle } from 'lucide-react';

interface InputProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, id, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const describedBy = [props['aria-describedby'], error || helperText ? messageId : undefined]
    .filter(Boolean).join(' ') || undefined;

  return (
    <div className="auth-field" data-invalid={error ? true : undefined}>
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        className={`auth-input ${className}`}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
      />
      {(error || helperText) && (
        <p id={messageId} className={`auth-field-message ${error ? 'auth-field-error' : ''}`} role={error ? 'alert' : undefined}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}

interface ButtonProps extends ComponentProps<'button'> {
  loading?: boolean;
  variant?: 'outline' | 'primary';
}

export function Button({ loading, disabled, children, variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`auth-button auth-button--${variant} ${className}`}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

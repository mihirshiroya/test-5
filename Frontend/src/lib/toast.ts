/**
 * Global toast utility — wraps Sonner's `toast` with app-wide defaults.
 *
 * Import this instead of importing directly from "sonner" so that all toasts
 * across the app share the same look, duration, and behaviour automatically.
 *
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Saved!', { description: 'Your changes are live.' });
 *   toast.error('Sign in failed', { description: 'Incorrect email or password.' });
 *   toast.apiError(error, 'Could not save changes');
 *
 * Toasts are de-duplicated: identical type + title + description collapse
 * into a single toast, so a global interceptor and a page-level handler
 * reporting the same failure never stack two copies.
 */

import { toast as sonnerToast, type ExternalToast } from 'sonner';

const BASE: ExternalToast = {
  duration: 4000,
  closeButton: true,
};

const makeId = (type: string, message: string, options?: ExternalToast) => {
  const description = typeof options?.description === 'string' ? options.description : '';
  return `${type}:${message}:${description}`;
};

/** Turns any thrown value (axios error, Error, string) into a user-friendly message. */
export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const err = error as any;
  const serverMessage = err?.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;

  if (err?.response) {
    switch (err.response.status) {
      case 400:
      case 422:
        return 'Some of the information provided is invalid. Please review it and try again.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return "You don't have permission to do that.";
      case 404:
        return "We couldn't find what you were looking for.";
      case 409:
        return 'This conflicts with existing data. Please check and try again.';
      case 429:
        return 'Too many attempts. Please wait a moment and try again.';
      default:
        if (err.response.status >= 500) {
          return 'Something went wrong on our side. Please try again shortly.';
        }
    }
  }

  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request || err?.code === 'ERR_NETWORK') {
    return "Can't reach the server. Check your internet connection and try again.";
  }

  return (typeof err?.message === 'string' && err.message) || fallback;
};

export const toast = {
  success: (message: string, options?: ExternalToast) =>
    sonnerToast.success(message, { ...BASE, id: makeId('success', message, options), ...options }),

  error: (message: string, options?: ExternalToast) =>
    sonnerToast.error(message, { ...BASE, duration: 6000, id: makeId('error', message, options), ...options }),

  info: (message: string, options?: ExternalToast) =>
    sonnerToast.info(message, { ...BASE, id: makeId('info', message, options), ...options }),

  warning: (message: string, options?: ExternalToast) =>
    sonnerToast.warning(message, { ...BASE, duration: 5000, id: makeId('warning', message, options), ...options }),

  loading: (message: string, options?: ExternalToast) =>
    sonnerToast.loading(message, { ...BASE, duration: Infinity, ...options }),

  /** Shows an error toast: `title` as heading, the extracted error as the explanation. */
  apiError: (error: unknown, title = 'Something went wrong', options?: ExternalToast) =>
    toast.error(title, { description: getErrorMessage(error), ...options }),

  promise: <T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
    options?: ExternalToast,
  ) => sonnerToast.promise(promise, { ...msgs, ...BASE, ...options }),

  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

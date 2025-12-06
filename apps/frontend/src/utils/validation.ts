/**
 * Validation utilities for form inputs
 */

/**
 * Validates email format
 */
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
};

/**
 * Validates phone number format (international format)
 * Accepts formats like: +1234567890, +61412345678, etc.
 */
export const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
  if (!phone || !phone.trim()) {
    return { isValid: true }; // Phone is optional in most cases
  }

  // Remove spaces, dashes, and parentheses for validation
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // International format: starts with + followed by 7-15 digits
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  
  if (!phoneRegex.test(cleanPhone)) {
    return { isValid: false, error: 'Invalid phone format. Use international format (e.g., +61412345678)' };
  }

  return { isValid: true };
};

/**
 * Validates positive number
 */
export const validatePositiveNumber = (value: string | number, fieldName: string = 'Value'): { isValid: boolean; error?: string } => {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }

  if (num <= 0) {
    return { isValid: false, error: `${fieldName} must be greater than 0` };
  }

  return { isValid: true };
};

/**
 * Validates positive integer
 */
export const validatePositiveInteger = (value: string | number, fieldName: string = 'Value'): { isValid: boolean; error?: string } => {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || !Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be a valid integer` };
  }

  if (num <= 0) {
    return { isValid: false, error: `${fieldName} must be greater than 0` };
  }

  return { isValid: true };
};

/**
 * Validates required field
 */
export const validateRequired = (value: string | null | undefined, fieldName: string = 'Field'): { isValid: boolean; error?: string } => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
};

/**
 * Validates zip/postal code
 */
export const validateZipCode = (zipCode: string): { isValid: boolean; error?: string } => {
  if (!zipCode || !zipCode.trim()) {
    return { isValid: true }; // Optional field
  }

  // Accepts various formats: 12345, 12345-6789, A1B 2C3, etc.
  const zipRegex = /^[A-Z0-9]{3,10}([-\s]?[A-Z0-9]{0,4})?$/i;
  
  if (!zipRegex.test(zipCode)) {
    return { isValid: false, error: 'Invalid zip/postal code format' };
  }

  return { isValid: true };
};

/**
 * Validates URL format
 */
export const validateUrl = (url: string): { isValid: boolean; error?: string } => {
  if (!url || !url.trim()) {
    return { isValid: true }; // Optional field
  }

  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
};

/**
 * Debounce function for search inputs
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

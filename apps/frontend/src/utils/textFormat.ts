/**
 * Capitalizes the first letter of each word in a string
 * Handles names with special characters and multiple words
 * @param text - The text to capitalize
 * @returns The capitalized text
 */
export function capitalize(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .replace(/\b(\p{L})/gu, (match) => match.toUpperCase());
}

/**
 * Formats a full name (first + last) with proper capitalization
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Formatted full name with proper spacing
 */
export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const first = capitalize(firstName);
  const last = capitalize(lastName);
  return `${first} ${last}`.trim();
}

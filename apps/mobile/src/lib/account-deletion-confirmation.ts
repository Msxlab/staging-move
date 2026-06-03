export function isDeleteConfirmationValid(input: string, phrases: string[]): boolean {
  const normalizedInput = input.trim().toUpperCase();
  if (!normalizedInput) return false;

  return phrases.some((phrase) => phrase.trim().toUpperCase() === normalizedInput);
}

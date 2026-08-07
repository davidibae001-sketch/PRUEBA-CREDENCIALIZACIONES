export function isConacemExpired(expiryDate?: string | null): boolean {
  if (!expiryDate || typeof expiryDate !== 'string') return false;
  const trimmed = expiryDate.trim();
  if (
    trimmed === '' ||
    trimmed.toUpperCase() === 'N/A' ||
    trimmed.toLowerCase().includes('indefinid') ||
    trimmed.toLowerCase().includes('vigente') ||
    trimmed.toLowerCase() === 'null' ||
    trimmed === 'undefined'
  ) {
    return false; // Not expired
  }

  try {
    const exp = new Date(trimmed);
    if (isNaN(exp.getTime())) return false; // Invalid date string treated as valid
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return exp < today; // Strictly true only if expiration date is in the past
  } catch (e) {
    return false;
  }
}

export function formatConacemDate(expiryDate?: string | null): string {
  if (!expiryDate || typeof expiryDate !== 'string') return 'No registrado';
  const trimmed = expiryDate.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'N/A') return 'No registrado';
  return trimmed;
}

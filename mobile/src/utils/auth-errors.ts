const INVALID_CREDENTIAL_CODES = new Set(['AUTH_REQUIRED', 'AUTH_INVALID']);

export const shouldClearSessionForCode = (code: string) => INVALID_CREDENTIAL_CODES.has(code);

export const ErrorCode = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  FEDERATION_UNTRUSTED: 'FEDERATION_UNTRUSTED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export class ProtocolError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export const isErrorCode = (value: string): value is ErrorCode => {
  return Object.values(ErrorCode).includes(value as ErrorCode);
};

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_MESSAGE]: 'Invalid message format',
  [ErrorCode.CHANNEL_NOT_FOUND]: 'Channel does not exist',
  [ErrorCode.UNAUTHORIZED]: 'You are not authorized to perform this action',
  [ErrorCode.RATE_LIMITED]: 'Too many requests, please try again later',
  [ErrorCode.SERVER_ERROR]: 'An internal server error occurred',
  [ErrorCode.FEDERATION_UNTRUSTED]: 'Server is not in trust list',
  [ErrorCode.INVALID_SIGNATURE]: 'Message signature verification failed',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Message exceeds maximum allowed size',
};

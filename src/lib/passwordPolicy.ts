const PASSWORD_MIN = 8
const PASSWORD_MAX = 12

export const PASSWORD_POLICY_HINT =
  '密码需 8-12 位，且包含大写字母、小写字母，以及数字或符号'

export const PASSWORD_INVALID_MESSAGE = '密码不合规范，请重新设置密码'

export function isValidPassword(password: string): boolean {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) return false
  return true
}

export function getPasswordValidationError(password: string): string | null {
  if (!password) return '请输入密码'
  if (!isValidPassword(password)) return PASSWORD_INVALID_MESSAGE
  return null
}

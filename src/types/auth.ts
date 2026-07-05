export interface AuthUser {
  id: string
  email: string
  username: string
}

export interface AuthSession {
  user: AuthUser
  token: string
}

export interface RememberedLogin {
  username: string
  password: string
}

interface DocumentPictureInPictureWindowOptions {
  width?: number
  height?: number
  preferInitialWindowPlacement?: boolean
}

interface DocumentPictureInPicture {
  readonly window: Window | null
  requestWindow(options?: DocumentPictureInPictureWindowOptions): Promise<Window>
}

interface Window {
  documentPictureInPicture?: DocumentPictureInPicture
}

declare module 'netlify-identity-widget' {
  interface NetlifyIdentity {
    init(): void
    open(tab?: string): void
    close(): void
    logout(): void
    refresh(): Promise<string>
    on(event: string, callback: (user?: unknown) => void): void
    off(event: string, callback?: (user?: unknown) => void): void
    currentUser(): unknown
  }
  const netlifyIdentity: NetlifyIdentity
  export default netlifyIdentity
}

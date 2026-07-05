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

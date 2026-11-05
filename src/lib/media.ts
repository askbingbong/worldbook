import { putFile } from '../store/files'

export const MB = 1024 * 1024
export const LIMITS = { image: 3 * MB, gif: 4 * MB, audio: 30 * MB, video: 30 * MB }

export class UploadError extends Error {}

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}
export const isVideoUrl = (u: string) => /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(u)
export const isAudioUrl = (u: string) => /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)(\?|#|$)/i.test(u)

async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const max = 1600
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const keepAlpha = file.type === 'image/png'
  const blob: Blob | null = await new Promise((r) =>
    c.toBlob(r, keepAlpha ? 'image/png' : 'image/jpeg', 0.82),
  )
  if (!blob) throw new UploadError('Could not read that image.')
  return blob.size < file.size ? blob : file
}

export type Kind = 'image' | 'audio' | 'video'

/**
 * Store an uploaded file, compressing images and enforcing size caps with a clear message.
 * Returns the "file:<id>" ref and the MIME type.
 */
export async function ingestFile(
  file: File,
  kind: Kind | 'media',
): Promise<{ ref: string; mime: string }> {
  const t = file.type
  const isImg = t.startsWith('image/')
  const isAud = t.startsWith('audio/')
  const isVid = t.startsWith('video/')
  if (kind === 'image' && !isImg) throw new UploadError('Please choose an image file.')
  if (kind === 'audio' && !(isAud || isVid))
    throw new UploadError('Please choose an audio or video file.')
  if (kind === 'video' && !isVid) throw new UploadError('Please choose a video file.')
  if (kind === 'media' && !(isImg || isVid))
    throw new UploadError('Please choose an image, GIF or video.')
  const tooBig = (cap: number, what: string) =>
    new UploadError(
      `That ${what} is ${(file.size / MB).toFixed(1)} MB. The limit is ${cap / MB} MB, so try a smaller one or paste a link.`,
    )
  let blob: Blob = file
  if (isImg && t === 'image/gif') {
    if (file.size > LIMITS.gif) throw tooBig(LIMITS.gif, 'GIF')
  } else if (isImg) {
    blob = await compressImage(file)
    if (blob.size > LIMITS.image) throw tooBig(LIMITS.image, 'image (even after compressing)')
  } else if (isVid) {
    if (file.size > LIMITS.video) throw tooBig(LIMITS.video, 'video')
  } else if (file.size > LIMITS.audio) throw tooBig(LIMITS.audio, 'audio file')
  const ref = await putFile(blob, file.name)
  return { ref, mime: blob.type || t }
}

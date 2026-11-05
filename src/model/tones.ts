/** Tiny generated melodies so the sample world plays sound offline. */
function note(f: number): number {
  return 440 * Math.pow(2, (f - 69) / 12)
}
export function makeTone(midi: number[], noteSec = 0.35): Blob {
  const rate = 8000
  const n = Math.floor(rate * noteSec)
  const samples = new Int16Array(midi.length * n)
  midi.forEach((m, i) => {
    const f = note(m)
    for (let j = 0; j < n; j++) {
      const env = Math.min(1, j / 200) * Math.exp(-3 * (j / n))
      samples[i * n + j] = Math.round(Math.sin((2 * Math.PI * f * j) / rate) * 9000 * env)
    }
  })
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  w(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true))
  return new Blob([buf], { type: 'audio/wav' })
}
export const SUNNY = [72, 76, 79, 84, 79, 76, 72, 67, 72, 76, 79, 76, 72, 71, 72, 72]
export const GROOVE = [60, 64, 67, 64, 60, 62, 65, 69, 62, 65, 69, 65, 60, 64, 67, 72]

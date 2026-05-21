/**
 * Audio math helpers shared by meters, peaks, and gain controls.
 */

/** Convert linear amplitude (0..1+) to decibels. Returns -Infinity for 0. */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}

/** Format dB as a 1-decimal string clipped to "-∞" below -60 dB. */
export function formatDb(db: number): string {
  if (!isFinite(db) || db < -60) return '-∞'
  return db.toFixed(1)
}

/** Format seconds as mm:ss.cs (centiseconds). */
export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.floor((sec * 100) % 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(
    2,
    '0',
  )}`
}

/**
 * Build a downsampled RMS peaks array for waveform display.
 *
 * `samplesPerSecond` is the rate at which peaks are produced (default 100,
 * giving ~10 ms resolution — fine for our zoom range and tiny in memory).
 *
 * Mono-sums multi-channel input so the visual is a single waveform per asset.
 */
export function buildPeaks(
  channels: Float32Array[],
  sampleRate: number,
  samplesPerSecond = 100,
): Float32Array {
  const numFrames = channels[0]?.length ?? 0
  const framesPerPeak = Math.max(1, Math.floor(sampleRate / samplesPerSecond))
  const numPeaks = Math.ceil(numFrames / framesPerPeak)
  const peaks = new Float32Array(numPeaks)
  const inv = 1 / channels.length

  for (let p = 0; p < numPeaks; p++) {
    const start = p * framesPerPeak
    const end = Math.min(numFrames, start + framesPerPeak)
    let sumSq = 0
    let count = 0
    for (let i = start; i < end; i++) {
      let mono = 0
      for (const ch of channels) mono += ch[i] ?? 0
      mono *= inv
      sumSq += mono * mono
      count++
    }
    peaks[p] = count > 0 ? Math.sqrt(sumSq / count) : 0
  }
  return peaks
}

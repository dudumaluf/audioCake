/**
 * Web MIDI engine: port discovery, clock master, basic send/receive.
 *
 * Phase 5 uses this for:
 *   - Listing in/out ports for the device picker.
 *   - Sending MIDI clock (24 PPQN) + Start/Stop/Continue to external gear
 *     so the Roland Aira Compacts (etc.) follow our project BPM.
 *   - Sending recorded MIDI notes back out during playback.
 *   - Receiving notes from a chosen input port for live recording.
 *
 * Web MIDI is unavailable in Firefox; we feature-detect at the call sites
 * and surface a friendly banner from BROWSER_SUPPORT docs.
 */

// MIDI status byte constants we use.
const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CLOCK = 0xf8
const START = 0xfa
const CONTINUE = 0xfb
const STOP = 0xfc

const CLOCK_TICKS_PER_BEAT = 24

let midiAccess: MIDIAccess | null = null
let accessPromise: Promise<MIDIAccess | null> | null = null
let clockTimer: number | null = null
let lastClockBpm = 120
const onPortsChangeListeners = new Set<() => void>()

export function isWebMidiAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

export async function ensureMidiAccess(): Promise<MIDIAccess | null> {
  if (!isWebMidiAvailable()) return null
  if (midiAccess) return midiAccess
  if (!accessPromise) {
    accessPromise = navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccess = access
        access.onstatechange = () => {
          for (const l of onPortsChangeListeners) l()
        }
        return access
      })
      .catch(() => null)
  }
  return accessPromise
}

export interface MidiPortInfo {
  id: string
  name: string
}

export function listInputs(): MidiPortInfo[] {
  if (!midiAccess) return []
  return Array.from(midiAccess.inputs.values()).map((p) => ({
    id: p.id,
    name: p.name ?? p.id,
  }))
}

export function listOutputs(): MidiPortInfo[] {
  if (!midiAccess) return []
  return Array.from(midiAccess.outputs.values()).map((p) => ({
    id: p.id,
    name: p.name ?? p.id,
  }))
}

export function onMidiPortsChange(listener: () => void): () => void {
  onPortsChangeListeners.add(listener)
  return () => {
    onPortsChangeListeners.delete(listener)
  }
}

export function sendNoteOn(
  portId: string,
  channel: number,
  pitch: number,
  velocity: number,
  whenMs?: number,
): void {
  const out = midiAccess?.outputs.get(portId)
  if (!out) return
  out.send([NOTE_ON | (channel & 0x0f), pitch & 0x7f, velocity & 0x7f], whenMs)
}

export function sendNoteOff(portId: string, channel: number, pitch: number, whenMs?: number): void {
  const out = midiAccess?.outputs.get(portId)
  if (!out) return
  out.send([NOTE_OFF | (channel & 0x0f), pitch & 0x7f, 0], whenMs)
}

/**
 * Send realtime clock + transport messages to a single output port so an
 * external sequencer follows our BPM. The timer cadence is derived from
 * the current BPM (24 ticks per beat).
 */
export function startMidiClock(portId: string, bpm: number): void {
  stopMidiClock()
  const out = midiAccess?.outputs.get(portId)
  if (!out) return
  lastClockBpm = bpm
  out.send([START])
  const intervalMs = (60 * 1000) / (bpm * CLOCK_TICKS_PER_BEAT)
  clockTimer = window.setInterval(() => {
    out.send([CLOCK])
  }, intervalMs)
}

export function continueMidiClock(portId: string, bpm: number): void {
  stopMidiClock()
  const out = midiAccess?.outputs.get(portId)
  if (!out) return
  lastClockBpm = bpm
  out.send([CONTINUE])
  const intervalMs = (60 * 1000) / (bpm * CLOCK_TICKS_PER_BEAT)
  clockTimer = window.setInterval(() => {
    out.send([CLOCK])
  }, intervalMs)
}

export function stopMidiClock(): void {
  if (clockTimer != null) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
  if (!midiAccess) return
  for (const out of midiAccess.outputs.values()) {
    out.send([STOP])
  }
}

export function updateMidiClockBpm(portId: string, bpm: number): void {
  if (clockTimer == null) return
  if (Math.abs(bpm - lastClockBpm) < 0.01) return
  // Restart the timer at the new rate; we don't send START, just continue ticking.
  window.clearInterval(clockTimer)
  lastClockBpm = bpm
  const out = midiAccess?.outputs.get(portId)
  if (!out) return
  const intervalMs = (60 * 1000) / (bpm * CLOCK_TICKS_PER_BEAT)
  clockTimer = window.setInterval(() => {
    out.send([CLOCK])
  }, intervalMs)
}

/**
 * Subscribe to incoming messages on a specific input. The handler receives
 * the parsed status / data bytes plus the high-resolution timestamp from
 * the underlying `MIDIMessageEvent`.
 */
export interface IncomingMessage {
  status: number
  channel: number
  data1: number
  data2: number
  /** `event.timeStamp` from the MIDIMessageEvent (DOMHighResTimeStamp ms). */
  timeMs: number
}

export function subscribeInput(
  portId: string,
  handler: (msg: IncomingMessage) => void,
): () => void {
  const input = midiAccess?.inputs.get(portId)
  if (!input) return () => {}
  const onMsg = (e: MIDIMessageEvent) => {
    const data = e.data
    if (!data || data.length === 0) return
    const status = data[0]! & 0xf0
    const channel = data[0]! & 0x0f
    handler({
      status,
      channel,
      data1: data[1] ?? 0,
      data2: data[2] ?? 0,
      timeMs: e.timeStamp,
    })
  }
  input.addEventListener('midimessage', onMsg as EventListener)
  return () => input.removeEventListener('midimessage', onMsg as EventListener)
}

export { NOTE_OFF, NOTE_ON }

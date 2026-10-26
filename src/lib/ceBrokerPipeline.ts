import { normalizeStateCode } from '@/lib/auth'

export type PipelineStateCode = 'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO' | 'AL' | 'IL'

const SUPPORTED_PIPELINE_STATES: PipelineStateCode[] = ['SC', 'HI', 'NC', 'NV', 'MI', 'MO', 'AL', 'IL']

const PIPELINE_TAB_STATE_MAP: Record<PipelineStateCode, PipelineStateCode> = {
  SC: 'SC',
  NC: 'NC',
  NV: 'NV',
  MI: 'MI',
  MO: 'MO',
  HI: 'HI',
  AL: 'AL',
  IL: 'IL',
}

const FALLBACK_STATE: PipelineStateCode = 'SC'

export function toPipelineStateCode(state: string | undefined | null): PipelineStateCode {
  const normalized = normalizeStateCode(state)
  if (SUPPORTED_PIPELINE_STATES.includes(normalized as PipelineStateCode)) {
    return normalized as PipelineStateCode
  }
  return FALLBACK_STATE
}

export function getHiddenPipelineTabLabel(state: string | undefined | null): string {
  const code = toPipelineStateCode(state)
  const mappedCode = PIPELINE_TAB_STATE_MAP[code] || FALLBACK_STATE
  return `Pipeline ${mappedCode}`
}

export function getPipelineScopeKey(state: string | undefined | null): string {
  return toPipelineStateCode(state)
}

// States where Submissions and Roster Post are merged into the Completed tab (one row per
// completion with its CE Broker reporting status and post actions).
const COMBINED_COMPLETED_TAB_STATES = new Set(['SC'])

export function usesCombinedCompletedTab(state: string | undefined | null): boolean {
  return COMBINED_COMPLETED_TAB_STATES.has(normalizeStateCode(state))
}

// Portal flows that only stage entries until a final step (AL Commit, IL Submit Checked). A switch
// sits between the staging step and the final step; it is off by default, so a run only stages the
// entries until it is switched on. The value is sent to the backend as `commit`.
export interface PortalSubmitGate {
  afterStepKey: string
  storageKey: string
  label: string
  onTitle: string
  offTitle: string
  onHelp: string
  offHelp: string
  dryRunHelp: string
  liveNote: string
}

export const PORTAL_SUBMIT_GATES: Partial<Record<PipelineStateCode, PortalSubmitGate>> = {
  AL: {
    afterStepKey: 'add-credits',
    storageKey: 'exceedce-al-commit',
    label: 'Commit',
    onTitle: 'On: flow clicks Commit so the entered course credit is submitted to AREC',
    offTitle: 'Off: flow stops after Add Course Credit; licenses stay entered but are not submitted',
    onHelp: 'Commit is ON: after Add Course Credit the run clicks Commit, submitting the course credit to AREC, and checks Course Credit History.',
    offHelp: 'Commit is OFF: the run stops after Add Course Credit. License numbers are entered in Manage Course Credit but NOT submitted; turn Commit on and run again to submit them.',
    dryRunHelp: 'Dry Run is on: nothing is entered or committed in the Alabama portal. Turn Dry Run off to add course credit.',
    liveNote: ' The Alabama portal is reached through the US VPN/proxy; course credit is committed only when the Commit switch is on.',
  },
  IL: {
    afterStepKey: 'finalize-entries',
    storageKey: 'exceedce-il-submit',
    label: 'Submit',
    onTitle: 'On: after Finalize Entries the flow ticks the added entries and clicks Submit Checked',
    offTitle: 'Off: flow stops after Finalize Entries; the entries stay on the review page and are not submitted',
    onHelp: 'Submit is ON: after Finalize Entries the run ticks only the entries it added and clicks Submit Checked (sent to IDFPR).',
    offHelp: 'Submit is OFF: the run stops after Finalize Entries. The entries stay listed on the Finalize Entries page but are NOT submitted; turn Submit on and run again to click Submit Checked.',
    dryRunHelp: 'Dry Run is on: nothing is added or submitted in the Illinois portal. Turn Dry Run off to add entries.',
    liveNote: ' Illinois entries are submitted to IDFPR only when the Submit switch is on.',
  },
}

export function getPortalSubmitGate(state: string | undefined | null): PortalSubmitGate | null {
  return PORTAL_SUBMIT_GATES[normalizeStateCode(state) as PipelineStateCode] || null
}

export function readPortalSubmitSwitch(state: string | undefined | null): boolean {
  const gate = getPortalSubmitGate(state)
  if (!gate) return false
  try {
    return localStorage.getItem(gate.storageKey) === 'on'
  } catch {
    return false
  }
}

export function savePortalSubmitSwitch(state: string | undefined | null, enabled: boolean): void {
  const gate = getPortalSubmitGate(state)
  if (!gate) return
  try {
    localStorage.setItem(gate.storageKey, enabled ? 'on' : 'off')
  } catch {
    // storage unavailable; caller keeps the in-memory value
  }
}

// Extra roster request options for states whose flow has a dashboard switch outside the pipeline page.
export function getRosterSwitchOptions(state: string | undefined | null): { commit?: boolean } {
  return getPortalSubmitGate(state) ? { commit: readPortalSubmitSwitch(state) } : {}
}

// The pipeline switch each state's roster flow has, as sent to the backend (and saved for the scheduler).
const ROSTER_GATE_BY_STATE: Partial<Record<PipelineStateCode, { key: 'sendEmails' | 'upload' | 'commit'; label: string }>> = {
  NV: { key: 'sendEmails', label: 'Email Division' },
  MI: { key: 'upload', label: 'Upload' },
  AL: { key: 'commit', label: 'Commit' },
  IL: { key: 'commit', label: 'Submit' },
}

export function getRosterGate(state: string | undefined | null) {
  return ROSTER_GATE_BY_STATE[normalizeStateCode(state) as PipelineStateCode] || null
}

/** "0 18 * * 1-5" -> "6:00 PM on weekdays"; other cron shapes are returned as-is. */
export function describeSchedule(schedule: string | undefined | null): string {
  const parts = String(schedule || '').trim().split(/\s+/)
  if (parts.length !== 5 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || parts[2] !== '*' || parts[3] !== '*') {
    return String(schedule || '')
  }
  const minute = Number(parts[0])
  const hour = Number(parts[1])
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const time = `${hour12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
  const days = parts[4] === '*' ? 'every day' : parts[4] === '1-5' ? 'on weekdays' : `on days ${parts[4]}`
  return `${time} ${days}`
}

/** Short zone name such as "EDT" for an IANA zone, falling back to the zone id. */
export function shortTimeZoneName(timeZone: string | undefined | null, at: Date = new Date()): string {
  if (!timeZone) return ''
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')
    return part?.value || timeZone
  } catch {
    return timeZone
  }
}

/** ISO time shown in the scheduler time zone, e.g. "Oct 26, 2026, 6:00 PM EDT". */
export function formatInTimeZone(iso: string | null | undefined, timeZone: string | undefined | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  try {
    const text = date.toLocaleString('en-US', { timeZone: timeZone || undefined, dateStyle: 'medium', timeStyle: 'short' })
    return timeZone ? `${text} ${shortTimeZoneName(timeZone, date)}` : text
  } catch {
    return date.toLocaleString()
  }
}

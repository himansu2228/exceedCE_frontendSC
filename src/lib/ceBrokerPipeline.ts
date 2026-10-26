import { normalizeStateCode } from '@/lib/auth'

export type PipelineStateCode = 'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO' | 'AL'

const SUPPORTED_PIPELINE_STATES: PipelineStateCode[] = ['SC', 'HI', 'NC', 'NV', 'MI', 'MO', 'AL']

const PIPELINE_TAB_STATE_MAP: Record<PipelineStateCode, PipelineStateCode> = {
  SC: 'SC',
  NC: 'NC',
  NV: 'NV',
  MI: 'MI',
  MO: 'MO',
  HI: 'HI',
  AL: 'AL',
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

// Alabama: the "Commit" switch sits between Add Course Credit and Commit Credit. Off by default,
// so a run only enters the licenses in Manage Course Credit until it is switched on.
export const AL_COMMIT_STORAGE_KEY = 'exceedce-al-commit'

export function readAlabamaCommitSwitch(): boolean {
  try {
    return localStorage.getItem(AL_COMMIT_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function saveAlabamaCommitSwitch(enabled: boolean): void {
  try {
    localStorage.setItem(AL_COMMIT_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // storage unavailable; caller keeps the in-memory value
  }
}

// Extra roster request options for states whose flow has a dashboard switch outside the pipeline page.
export function getRosterSwitchOptions(state: string | undefined | null): { commit?: boolean } {
  return normalizeStateCode(state) === 'AL' ? { commit: readAlabamaCommitSwitch() } : {}
}

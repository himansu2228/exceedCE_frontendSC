import { normalizeStateCode } from '@/lib/auth'

export type PipelineStateCode = 'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO'

const SUPPORTED_PIPELINE_STATES: PipelineStateCode[] = ['SC', 'HI', 'NC', 'NV', 'MI', 'MO']

const PIPELINE_TAB_STATE_MAP: Record<PipelineStateCode, PipelineStateCode> = {
  SC: 'SC',
  NC: 'NC',
  NV: 'NV',
  MI: 'MI',
  MO: 'MO',
  HI: 'HI',
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
  return `CE Broker Pipeline ${mappedCode}`
}

export function getPipelineScopeKey(state: string | undefined | null): string {
  return toPipelineStateCode(state)
}

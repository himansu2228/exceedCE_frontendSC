import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/courseEvaluations.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
runInNewContext(compiled, { exports, require: createRequire(import.meta.url) })
const { courseKey, courseState, evaluationSummary, summarizeCourses } = exports

test('combined average weights individual valid ratings, not course averages', () => {
  const records = [
    { courseId: 1, courseName: 'SC Safety', rating: 5 },
    { courseId: 1, courseName: 'SC Safety', rating: 5 },
    { courseId: 1, courseName: 'SC Safety', rating: 5 },
    { courseId: 2, courseName: 'NC Safety', rating: 1, reviews: 'Needs improvement' },
    { courseId: 3, courseName: 'MO Safety', rating: 1 },
  ]
  const selected = new Set(['id:1', 'id:2'])
  const summary = evaluationSummary(records.filter((record) => selected.has(courseKey(record))))
  assert.equal(summary.average, 4)
  assert.equal(summary.rated, 4)
  assert.equal(summary.comments, 1)
})

test('different course IDs remain separate even when their titles match', () => {
  const groups = summarizeCourses([{ courseId: 1, courseName: 'SC Safety', rating: 5 }, { courseId: 2, courseName: 'SC Safety', rating: 1 }])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].average, 5)
  assert.equal(groups[1].average, 1)
})

test('missing or invalid ratings do not lower an average and missing states stay unknown', () => {
  const summary = evaluationSummary([{ rating: null }, { rating: '' }, { rating: 0 }, { rating: 6 }, { rating: '4', reviews: '   ' }])
  assert.equal(summary.average, 4)
  assert.equal(summary.count, 5)
  assert.equal(summary.rated, 1)
  assert.equal(summary.comments, 0)
  assert.equal(courseState({ courseName: 'Safety' }), null)
  assert.equal(courseState({ courseName: 'HI Safety' }), 'HI')
  assert.equal(evaluationSummary([]).average, null)
})
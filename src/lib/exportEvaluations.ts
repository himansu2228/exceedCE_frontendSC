import * as XLSX from 'xlsx-js-style'
import type { CourseEvaluationRecord } from './api'
import { courseName, courseState, evaluationSummary, reviewText, score, summarizeCourses } from './courseEvaluations'
import { formatDataWorksheet } from './excelFormatting'

export function buildEvaluationWorkbook(records: CourseEvaluationRecord[], title: string) {
  const workbook = XLSX.utils.book_new()
  const summary = evaluationSummary(records)
  const courseRows = summarizeCourses(records)
  const metadata = XLSX.utils.aoa_to_sheet([
    [title], ['Report field', 'Value'], ['Exported at (UTC)', new Date().toISOString()],
    ['Evaluations in this export', summary.count], ['Valid rated responses', summary.rated],
    ['Average rating (1-5)', summary.average ?? 'Not available'], ['Written comments', summary.comments],
    ['Average calculation', 'Sum of valid individual ratings divided by rated response count'],
    ['Course state', 'Two-letter prefix in the course title, not learner state'],
  ])
  const courses = XLSX.utils.aoa_to_sheet([
    ['COURSE SUMMARIES'],
    ['Course ID', 'Course', 'Course state', 'Evaluations', 'Rated responses', 'Average rating', 'Comments'],
    ...courseRows.map((row) => [row.courseId ?? '', row.course, row.state ?? '', row.count, row.rated, row.average ?? '', row.comments]),
    ['', 'Combined', '', summary.count, summary.rated, summary.average ?? '', summary.comments],
  ])
  const evaluations = XLSX.utils.aoa_to_sheet([
    ['EVALUATION RECORDS'],
    ['Evaluation ID', 'Course ID', 'Course', 'Course state', 'Rating', 'Written comment', 'Submitted by', 'Submitted date'],
    ...records.map((record) => [record.id ?? '', record.courseId ?? '', courseName(record), courseState(record) ?? '', score(record) ?? '', reviewText(record), record.userdisplayName ?? '', record.submissionDate ?? record.created_at ?? '']),
  ])
  formatDataWorksheet(metadata, { titleRow: 0, headerRow: 1, dataEndRow: 8, columnWidths: [30, 80] })
  formatDataWorksheet(courses, { titleRow: 0, headerRow: 1, dataEndRow: courseRows.length + 1, totalRow: courseRows.length + 2, columnWidths: [12, 65, 14, 14, 16, 16, 12] })
  formatDataWorksheet(evaluations, { titleRow: 0, headerRow: 1, dataEndRow: records.length + 1, columnWidths: [16, 12, 65, 14, 10, 80, 24, 28] })
  for (const sheet of [metadata, courses, evaluations]) {
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith('!')) continue
      if (XLSX.utils.decode_cell(address).r <= 1) {
        cell.s = { ...cell.s, alignment: { ...cell.s?.alignment, horizontal: 'center' } }
      }
    }
  }
  metadata.B6.z = '0.00'
  for (let row = 2; row <= courseRows.length + 2; row += 1) {
    const cell = courses[XLSX.utils.encode_cell({ r: row, c: 5 })]
    if (cell?.t === 'n') cell.z = '0.00'
  }
  XLSX.utils.book_append_sheet(workbook, metadata, 'Report')
  XLSX.utils.book_append_sheet(workbook, courses, 'Course summaries')
  XLSX.utils.book_append_sheet(workbook, evaluations, 'Evaluations')
  return workbook
}

export function exportEvaluationWorkbook(records: CourseEvaluationRecord[], title: string) {
  const workbook = buildEvaluationWorkbook(records, title)
  XLSX.writeFile(workbook, `Course-Evaluations-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
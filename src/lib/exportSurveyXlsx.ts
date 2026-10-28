import * as XLSX from 'xlsx-js-style'
import type { SurveyReportResponse } from './api'
import { formatDataWorksheet } from './excelFormatting'
import { RATING_LEVELS, type CommentCategory, type CommentItem, type RatingRow } from './surveyReport'

interface WorkbookInput {
  report: SurveyReportResponse
  rows: RatingRow[]
  lowShare: number | null
  comments: Array<CommentItem & { category: CommentCategory }>
}

function fileSafe(text: string): string {
  return text.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'course'
}

export function exportSurveyWorkbook({ report, rows, lowShare, comments }: WorkbookInput) {
  const workbook = XLSX.utils.book_new()

  const summaryHeader = ['Question', 'Short label', ...RATING_LEVELS.map((level) => `${level.value} = ${level.label}`), 'N/A', 'Rated', 'Average', 'Low (1-2)']
  const summaryRows = rows.map((row) => [
    row.question, row.label, ...row.counts, row.na, row.total,
    row.total ? row.counts.reduce((sum, count, index) => sum + count * (index + 1), 0) / row.total : '',
    row.total ? (row.counts[0] + row.counts[1]) / row.total : '',
  ])
  const summary = XLSX.utils.aoa_to_sheet([
    [`${report.courseName} (${report.total} students)`],
    summaryHeader,
    ...summaryRows,
    ['All questions combined', '', '', '', '', '', '', '', '', '', lowShare ?? ''],
  ])
  formatDataWorksheet(summary, { titleRow: 0, headerRow: 1, dataEndRow: summaryRows.length + 1, totalRow: summaryRows.length + 2, columnWidths: [50, 26, 16, 16, 16, 16, 16, 8, 8, 10, 12] })

  const responseRows = report.responses.flatMap((response) => report.questions
    .filter((question) => response.answers[question] !== undefined)
    .map((question) => [response.name, response.email, report.courseName, question, response.answers[question]]))
  const responses = XLSX.utils.aoa_to_sheet([
    ['SURVEY RESPONSES'],
    ['Student Name', 'Email', 'Course Name', 'Question', 'Response'],
    ...responseRows,
  ])
  formatDataWorksheet(responses, { titleRow: 0, headerRow: 1, dataEndRow: responseRows.length + 1, columnWidths: [26, 34, 45, 60, 60] })

  const commentSheet = XLSX.utils.aoa_to_sheet([
    ['STUDENT COMMENTS'],
    ['Category', 'Student', 'Question', 'Comment'],
    ...comments.map((comment) => [comment.category, comment.name, comment.questionLabel, comment.text]),
  ])
  formatDataWorksheet(commentSheet, { titleRow: 0, headerRow: 1, dataEndRow: comments.length + 1, columnWidths: [14, 26, 40, 90] })

  for (let row = 2; row <= summaryRows.length + 2; row += 1) {
    const average = summary[XLSX.utils.encode_cell({ r: row, c: 9 })]
    if (average?.t === 'n') average.z = '0.00'
    const low = summary[XLSX.utils.encode_cell({ r: row, c: 10 })]
    if (low?.t === 'n') low.z = '0.0%'
  }

  XLSX.utils.book_append_sheet(workbook, summary, 'Chart data')
  XLSX.utils.book_append_sheet(workbook, responses, 'Responses')
  XLSX.utils.book_append_sheet(workbook, commentSheet, 'Comments')
  XLSX.writeFile(workbook, `${fileSafe(report.courseName)}_evaluation.xlsx`)
}

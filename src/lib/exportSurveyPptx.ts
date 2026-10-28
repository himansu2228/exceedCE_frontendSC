import { COMMENT_CATEGORIES, RATING_LEVELS, type CommentCategory, type CommentItem, type RatingRow } from './surveyReport'

interface DeckInput {
  courseName: string
  studentCount: number
  rows: RatingRow[]
  lowShare: number | null
  comments: Array<CommentItem & { category: CommentCategory }>
}

const PLOT = { x: 0.3, y: 0.03, w: 0.67, h: 0.8 }
const CHART = { x: 0.5, y: 1.35, w: 12.3, h: 5.5 }
const COMMENTS_PER_SLIDE = 8

function fileSafe(text: string): string {
  return text.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'course'
}

export async function exportSurveyDeck({ courseName, studentCount, rows, lowShare, comments }: DeckInput) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  const chartSlide = pptx.addSlide()
  chartSlide.addText(courseName, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 26, bold: true, color: '1D4ED8' })
  chartSlide.addText(`${studentCount} student${studentCount === 1 ? '' : 's'} responded`, { x: 0.5, y: 0.9, w: 12.3, h: 0.35, fontSize: 14, color: '475569' })

  // The first category is drawn at the bottom of a horizontal bar chart, so reverse for A-Z top to bottom.
  const ordered = [...rows].reverse()
  chartSlide.addChart(
    pptx.ChartType.bar,
    RATING_LEVELS.map((level, index) => ({ name: level.label, labels: ordered.map((row) => row.label), values: ordered.map((row) => row.counts[index]) })),
    {
      ...CHART,
      barDir: 'bar',
      barGrouping: 'percentStacked',
      barGapWidthPct: 40,
      chartColors: RATING_LEVELS.map((level) => level.color.slice(1)),
      showLegend: true,
      legendPos: 'b',
      legendFontSize: 13,
      catAxisLabelFontSize: 12,
      valAxisLabelFontSize: 11,
      valAxisLabelFormatCode: '0%',
      layout: PLOT,
    }
  )

  if (lowShare !== null) {
    const lineX = CHART.x + CHART.w * (PLOT.x + PLOT.w * lowShare)
    chartSlide.addShape(pptx.ShapeType.line, { x: lineX, y: CHART.y + CHART.h * PLOT.y, w: 0, h: CHART.h * PLOT.h, line: { color: 'DC2626', width: 2, dashType: 'dash' } })
    chartSlide.addText(`Unsatisfactory + Needs Improvement: ${(lowShare * 100).toFixed(1)}%`, { x: 8.3, y: 0.9, w: 4.5, h: 0.35, fontSize: 12, bold: true, color: 'DC2626', align: 'right' })
  }

  const groups = COMMENT_CATEGORIES.map((category) => ({ category, items: comments.filter((comment) => comment.category === category) })).filter((group) => group.items.length)
  const flat = groups.flatMap((group) => group.items.map((item) => ({ category: group.category, item })))
  for (let start = 0; start < flat.length; start += COMMENTS_PER_SLIDE) {
    const slide = pptx.addSlide()
    slide.addText(`${courseName}: Student comments`, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 22, bold: true, color: '1D4ED8' })
    const runs = flat.slice(start, start + COMMENTS_PER_SLIDE).flatMap(({ category, item }) => [
      { text: `${category}: `, options: { bold: true, color: '0F766E', breakLine: false } },
      { text: item.text, options: { color: '1E293B', breakLine: true } },
    ])
    slide.addText(runs, { x: 0.5, y: 1.1, w: 12.3, h: 5.9, fontSize: 14, valign: 'top', paraSpaceAfter: 10 })
  }

  await pptx.writeFile({ fileName: `${fileSafe(courseName)}_evaluation.pptx` })
}

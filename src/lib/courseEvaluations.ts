import type { CourseEvaluationRecord } from './api'

export function courseName(record: CourseEvaluationRecord): string {
  if (record.courseName) return record.courseName
  const course = record.course
  if (typeof course === 'string' && course.trim()) return course.trim()
  if (course && typeof course === 'object') return course.name || course.title || `Course ${course.id ?? 'unknown'}`
  return record.course_name || record.course_title || 'Unknown course'
}

export function courseKey(record: CourseEvaluationRecord): string {
  const id = record.courseId ?? (typeof record.course === 'object' ? record.course?.id : undefined)
  return id === undefined || id === null ? `name:${courseName(record)}` : `id:${id}`
}

export function courseState(record: CourseEvaluationRecord): string | null {
  return courseName(record).match(/^([A-Z]{2})\s/)?.[1] || null
}

export function score(record: CourseEvaluationRecord): number | null {
  const value = Number(record.rating)
  return record.rating !== null && record.rating !== undefined && record.rating !== '' && Number.isFinite(value) && value >= 1 && value <= 5 ? value : null
}

export function reviewText(record: CourseEvaluationRecord): string {
  const text = record.reviews ?? record.review
  return typeof text === 'string' ? text.trim() : ''
}

export function evaluationSummary(records: CourseEvaluationRecord[]) {
  const ratings = records.map(score).filter((rating): rating is number => rating !== null)
  return {
    count: records.length,
    rated: ratings.length,
    average: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    comments: records.filter((record) => reviewText(record)).length,
  }
}

export function summarizeCourses(records: CourseEvaluationRecord[]) {
  const groups = new Map<string, CourseEvaluationRecord[]>()
  for (const record of records) {
    const key = courseKey(record)
    const group = groups.get(key) || []
    group.push(record)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([key, group]) => ({
    key, course: courseName(group[0]), state: courseState(group[0]),
    courseId: group[0].courseId ?? (typeof group[0].course === 'object' ? group[0].course?.id : undefined),
    ...evaluationSummary(group),
  })).sort((left, right) => left.course.localeCompare(right.course) || left.key.localeCompare(right.key))
}
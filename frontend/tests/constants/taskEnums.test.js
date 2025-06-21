import { describe, it, expect } from 'vitest'
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS
} from '../../src/constants/taskEnums.js'

describe('Task Enum Constants', () => {
  describe('TASK_STATUSES', () => {
    it('should contain all valid status values', () => {
      expect(TASK_STATUSES).toEqual(['pending', 'in-progress', 'completed'])
    })

    it('should have exactly 3 status values', () => {
      expect(TASK_STATUSES).toHaveLength(3)
    })

    it('should contain expected status values', () => {
      expect(TASK_STATUSES).toContain('pending')
      expect(TASK_STATUSES).toContain('in-progress')
      expect(TASK_STATUSES).toContain('completed')
    })

    it('should not contain invalid status values', () => {
      expect(TASK_STATUSES).not.toContain('draft')
      expect(TASK_STATUSES).not.toContain('cancelled')
      expect(TASK_STATUSES).not.toContain('archived')
    })
  })

  describe('TASK_PRIORITIES', () => {
    it('should contain all valid priority values', () => {
      expect(TASK_PRIORITIES).toEqual(['low', 'medium', 'high'])
    })

    it('should have exactly 3 priority values', () => {
      expect(TASK_PRIORITIES).toHaveLength(3)
    })

    it('should contain expected priority values', () => {
      expect(TASK_PRIORITIES).toContain('low')
      expect(TASK_PRIORITIES).toContain('medium')
      expect(TASK_PRIORITIES).toContain('high')
    })

    it('should not contain invalid priority values', () => {
      expect(TASK_PRIORITIES).not.toContain('urgent')
      expect(TASK_PRIORITIES).not.toContain('critical')
      expect(TASK_PRIORITIES).not.toContain('normal')
    })
  })

  describe('STATUS_OPTIONS', () => {
    it('should contain correct status options for UI components', () => {
      const expected = [
        { title: 'Pending', value: 'pending' },
        { title: 'In Progress', value: 'in-progress' },
        { title: 'Completed', value: 'completed' }
      ]
      expect(STATUS_OPTIONS).toEqual(expected)
    })

    it('should have title and value for each option', () => {
      STATUS_OPTIONS.forEach((option) => {
        expect(option).toHaveProperty('title')
        expect(option).toHaveProperty('value')
        expect(typeof option.title).toBe('string')
        expect(typeof option.value).toBe('string')
      })
    })

    it('should have values that match TASK_STATUSES', () => {
      const values = STATUS_OPTIONS.map((option) => option.value)
      expect(values).toEqual(TASK_STATUSES)
    })

    it('should have properly formatted titles', () => {
      expect(STATUS_OPTIONS[0].title).toBe('Pending')
      expect(STATUS_OPTIONS[1].title).toBe('In Progress')
      expect(STATUS_OPTIONS[2].title).toBe('Completed')
    })
  })

  describe('PRIORITY_OPTIONS', () => {
    it('should contain correct priority options for UI components', () => {
      const expected = [
        { title: 'Low', value: 'low' },
        { title: 'Medium', value: 'medium' },
        { title: 'High', value: 'high' }
      ]
      expect(PRIORITY_OPTIONS).toEqual(expected)
    })

    it('should have title and value for each option', () => {
      PRIORITY_OPTIONS.forEach((option) => {
        expect(option).toHaveProperty('title')
        expect(option).toHaveProperty('value')
        expect(typeof option.title).toBe('string')
        expect(typeof option.value).toBe('string')
      })
    })

    it('should have values that match TASK_PRIORITIES', () => {
      const values = PRIORITY_OPTIONS.map((option) => option.value)
      expect(values).toEqual(TASK_PRIORITIES)
    })

    it('should have properly formatted titles', () => {
      expect(PRIORITY_OPTIONS[0].title).toBe('Low')
      expect(PRIORITY_OPTIONS[1].title).toBe('Medium')
      expect(PRIORITY_OPTIONS[2].title).toBe('High')
    })
  })

  describe('Constants Consistency', () => {
    it('should maintain consistency between raw values and UI options for status', () => {
      TASK_STATUSES.forEach((status) => {
        const option = STATUS_OPTIONS.find((opt) => opt.value === status)
        expect(option).toBeDefined()
        expect(option.value).toBe(status)
      })
    })

    it('should maintain consistency between raw values and UI options for priority', () => {
      TASK_PRIORITIES.forEach((priority) => {
        const option = PRIORITY_OPTIONS.find((opt) => opt.value === priority)
        expect(option).toBeDefined()
        expect(option.value).toBe(priority)
      })
    })

    it('should not have duplicate values in TASK_STATUSES', () => {
      const uniqueStatuses = [...new Set(TASK_STATUSES)]
      expect(uniqueStatuses).toHaveLength(TASK_STATUSES.length)
    })

    it('should not have duplicate values in TASK_PRIORITIES', () => {
      const uniquePriorities = [...new Set(TASK_PRIORITIES)]
      expect(uniquePriorities).toHaveLength(TASK_PRIORITIES.length)
    })

    it('should not have duplicate values in STATUS_OPTIONS', () => {
      const values = STATUS_OPTIONS.map((opt) => opt.value)
      const uniqueValues = [...new Set(values)]
      expect(uniqueValues).toHaveLength(values.length)
    })

    it('should not have duplicate values in PRIORITY_OPTIONS', () => {
      const values = PRIORITY_OPTIONS.map((opt) => opt.value)
      const uniqueValues = [...new Set(values)]
      expect(uniqueValues).toHaveLength(values.length)
    })
  })

  describe('Multi-Select Usage Compatibility', () => {
    it('should work with array methods for status filtering', () => {
      const selectedStatuses = ['pending', 'completed']
      const validStatuses = selectedStatuses.every((status) =>
        TASK_STATUSES.includes(status)
      )
      expect(validStatuses).toBe(true)
    })

    it('should work with array methods for priority filtering', () => {
      const selectedPriorities = ['high', 'medium']
      const validPriorities = selectedPriorities.every((priority) =>
        TASK_PRIORITIES.includes(priority)
      )
      expect(validPriorities).toBe(true)
    })

    it('should filter STATUS_OPTIONS based on selected values', () => {
      const selectedValues = ['pending', 'completed']
      const filteredOptions = STATUS_OPTIONS.filter((option) =>
        selectedValues.includes(option.value)
      )

      expect(filteredOptions).toHaveLength(2)
      expect(filteredOptions[0].value).toBe('pending')
      expect(filteredOptions[1].value).toBe('completed')
    })

    it('should filter PRIORITY_OPTIONS based on selected values', () => {
      const selectedValues = ['high', 'low']
      const filteredOptions = PRIORITY_OPTIONS.filter((option) =>
        selectedValues.includes(option.value)
      )

      expect(filteredOptions).toHaveLength(2)
      expect(filteredOptions[0].value).toBe('low')
      expect(filteredOptions[1].value).toBe('high')
    })
  })
})

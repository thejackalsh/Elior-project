import { majorityVote } from '../RupiahClassifierService'

describe('majorityVote', () => {
  it('returns the value shared by two votes', () => {
    expect(majorityVote(1, 1, 2)).toBe(1)
    expect(majorityVote(1, 2, 1)).toBe(1)
    expect(majorityVote(2, 1, 1)).toBe(1)
  })

  it('returns null when all three votes disagree', () => {
    expect(majorityVote(1, 2, 3)).toBeNull()
  })

  it('returns the value when all three votes agree', () => {
    expect(majorityVote(5, 5, 5)).toBe(5)
  })
})

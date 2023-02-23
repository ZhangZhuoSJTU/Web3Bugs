/* eslint-disable @typescript-eslint/no-explicit-any */
import { configure } from 'mobx'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global

describe('UnstakeStore tests', () => {
  it('should have confirm state as false', () => {
    expect(rootStore.unstakeStore.confirm).toBe(false)
  })

  it('should update confirm state', () => {
    const event = { target: { checked: true } } as any
    rootStore.unstakeStore.setConfirm(event)
    expect(rootStore.unstakeStore.confirm).toBe(true)
  })

  it('should update current unstaking value', () => {
    const value = '1000'
    rootStore.unstakeStore.setCurrentUnstakingValue(value)
    expect(rootStore.unstakeStore.currentUnstakingValue).toBe(value)
  })

  it('should set isCurrentUnstakingValueValid to false when currentUntakingValue is 0', () => {
    const value = '0'
    rootStore.unstakeStore.setCurrentUnstakingValue(value)
    expect(rootStore.unstakeStore.isCurrentUnstakingValueValid).toBe(false)
  })
})

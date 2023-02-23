import { useEffect, useState } from 'react'

export enum FeatureFlag {
  enableCoreDapp = 'enableCoreDapp',
  enableStakingLocally = 'enableStakingLocally',
  enableI18nLocally = 'enableI18nLocally',
}

type UseFeatureFlag = {
  enabled: boolean | undefined
  loading: boolean
  error: boolean
}

const LOCALHOST = 'http://localhost'

const fetchFunction = async (featureName: FeatureFlag, userAddress?: string): Promise<boolean> => {
  const body = {
    featureName,
    userAddress,
  }
  if (featureName === FeatureFlag.enableStakingLocally) {
    if (!window) {
      return false
    }
    return window.origin.startsWith(LOCALHOST)
  }

  if (featureName === FeatureFlag.enableI18nLocally) {
    if (!window) {
      return false
    }
    return window.origin.startsWith(LOCALHOST)
  }

  const result = await fetch('/api/application', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return result.json()
}

const useFeatureFlag = (
  featureFlagName: FeatureFlag,
  userAddress?: string | undefined
): UseFeatureFlag => {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    setError(false)
    setLoading(true)
    let isActive = true

    fetchFunction(featureFlagName, userAddress)
      .then((result) => {
        if (isActive) setEnabled(result)
      })
      .catch(() => {
        if (isActive) setError(true)
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })
    return (): void => {
      isActive = false
    }
  }, [featureFlagName, userAddress])

  return { enabled, loading, error }
}

export default useFeatureFlag

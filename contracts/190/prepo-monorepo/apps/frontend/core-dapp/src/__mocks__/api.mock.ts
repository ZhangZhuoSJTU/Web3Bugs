export const mockApiCall = ({ error }: { error: boolean }): Promise<boolean> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (error) {
        reject(new Error('Your transaction failed due to insufficient balance'))
      }
      resolve(true)
    }, 1200)
  })

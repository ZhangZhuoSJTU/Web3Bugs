// eslint-disable-next-line require-await
export const sleep = async (time: number): Promise<boolean> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, time)
  })

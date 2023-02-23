export const makeQueryString = (props: { [key: string]: string | undefined }): string => {
  const paramsString: string[] = []
  Object.entries(props).forEach(([key, value]) => {
    if (value) paramsString.push(`${key}=${value}`)
  })
  return `?${paramsString.join('&')}`
}

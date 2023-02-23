declare module 'react-jazzicon' {
  export default React.Component
  export function jsNumberForAddress(account: string): number
}
declare namespace ethereum {
  const isMetaMask: boolean | undefined
  const request: (data: { method: string; params: unknown }) => Promise<null>
}

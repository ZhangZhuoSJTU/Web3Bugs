type CallbackType = (id: string) => void
declare namespace ethereum {
  const isMetaMask: boolean | undefined
  const request: (data: { method: string; params: unknown }) => Promise<null>
  const on: (event: string, callback: CallbackType) => void
}

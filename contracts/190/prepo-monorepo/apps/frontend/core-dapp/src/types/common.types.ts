export type Callback<TProps = unknown> = (props?: TProps) => void

export type KeyStringMap = {
  // this won't be false
  // it's either true or we delete it from the map
  [key: string]: true
}

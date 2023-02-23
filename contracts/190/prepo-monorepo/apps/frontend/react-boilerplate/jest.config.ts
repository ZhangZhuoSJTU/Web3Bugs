import type { Config } from '@jest/types'
// Disabling typescript here since it's a javascript config file that is being imported
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import base from 'config/jest-frontend'
import path from 'path'

const fromRoot = (directory: string): string => path.join(__dirname, directory)

const config: Config.InitialOptions = {
  ...base,
  roots: [fromRoot('.')],
  name: 'prepo-react-boilerplate',
  displayName: 'prePO React Boilerplate Tests',
}

export default config

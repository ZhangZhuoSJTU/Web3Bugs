import type { Config } from '@jest/types'
import base from 'config/jest-server'
import path from 'path'

const fromRoot = (d): string => path.join(__dirname, d)

const config: Config.InitialOptions = {
  ...base,
  roots: [fromRoot('.')],
  name: 'prepo-sdk',
  displayName: 'prepo-sdk tests',
}

export default config

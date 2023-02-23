import util from 'util'
import { exec } from 'child_process'
import fs from 'fs'

const execCommand = util.promisify(exec)

type FrontendApp = {
  name: string
  projectId: string
}

const FILE_NAME = 'changed_apps.json'

const FRONTEND_APPS: FrontendApp[] = [
  {
    name: 'core-dapp',
    projectId: 'prj_JWVJ3WoV71UcOmB52qrcezjyBL3V',
  },
  {
    name: 'docs',
    projectId: 'prj_P9R3CtLzShfhpRDRTnvFqguGIvtB',
  },
  {
    name: 'react-boilerplate',
    projectId: 'prj_3Lydru5gdN5RuqWFQBT8AZrbiROq',
  },
  {
    name: 'simulator',
    projectId: 'prj_JqVcxQPRfkDbLp3ytm7FLLIvOPXc',
  },
  {
    name: 'website',
    projectId: 'prj_OtZFmASyChHVcxNEAY2NfOQoYQ56',
  },
]

const getChangedApps = async (): Promise<FrontendApp[]> => {
  const filterBranch = process.env.FILTER_BRANCH
  // const commandToRun = `yarn build:dry --filter="...[origin/${filterBranch}]"`
  const commandToRun = `yarn build:dry --since=origin/main`
  console.log({ commandToRun })
  const { stdout } = await execCommand(commandToRun)

  // https://stackoverflow.com/a/63660736
  const TWO_LEVEL_JSON = /\{(?:[^{}]|(\{(?:[^{}]|())*\}))*\}/g

  const outputObject = stdout.match(TWO_LEVEL_JSON)
  const outputAsJson =
    outputObject && outputObject.length > 0 ? JSON.parse(outputObject[0]) : undefined
  const appsChanged: string[] = outputAsJson ? outputAsJson.packages : []
  const frontendAppsChanged = FRONTEND_APPS.filter((app) => appsChanged.includes(app.name))

  return frontendAppsChanged
}

const writeChangedAppsFile = (changedAppsArray: string) => {
  try {
    console.log({ input: JSON.stringify(changedAppsArray) })
    fs.writeFileSync(FILE_NAME, JSON.stringify(changedAppsArray))
    //file written successfully
  } catch (err) {
    console.error(err)
  }
}

const init = async (): Promise<void> => {
  const changedApps = await getChangedApps()
  writeChangedAppsFile(JSON.stringify(changedApps))
}

init()

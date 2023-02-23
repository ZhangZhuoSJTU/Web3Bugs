import deepEqual from 'fast-deep-equal'
import cloneDeep from 'clone-deep'
import { autorun, makeAutoObservable, runInAction, toJS } from 'mobx'
import { Multicall, ContractCallContext, ContractCallReturnContext } from 'ethereum-multicall'
import { CallContext } from 'ethereum-multicall/dist/esm/models'
import { RootStore } from './RootStore'
import { isImportantError } from './utils/error-capturer-util'

function sameMethodAndParams(call0: CallContext, call1: CallContext): boolean {
  return (
    call0.methodName === call1.methodName &&
    JSON.stringify(call0.methodParameters) === JSON.stringify(call1.methodParameters)
  )
}

function generateUniqueCallId(context: ContractCallContext): string {
  return `${context.reference}${context.calls[0].methodName}${JSON.stringify(
    context.calls[0].methodParameters
  )}`
}

export class MulticallStore {
  root: RootStore<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contractCallContexts: ContractCallContext<{ cb: (res: any) => void }>[] = []
  activeCalls: Set<string> = new Set()
  multicall?: Multicall

  constructor(root: RootStore<unknown>) {
    this.root = root
    makeAutoObservable(this, { contractCallContexts: false })
    this.init()
  }

  init(): void {
    autorun(() => {
      this.multicall = new Multicall({
        ethersProvider: this.root.web3Store.coreProvider,
        tryAggregate: true,
      })
    })
  }

  call(): void {
    runInAction(() => {
      try {
        if (!this.multicall) throw Error('multicall must be initialized')
        this.multicall
          .call(cloneDeep(this.contractCallContexts))
          .then((results) => {
            Object.values(results).forEach((res) => {
              Object.values<ContractCallReturnContext>(res).forEach((val) => {
                const { context } = val.originalContractCallContext
                const { contractStore } = context ?? {}
                runInAction(() => {
                  if (contractStore !== undefined && typeof contractStore.storage === 'object') {
                    val.callsReturnContext.forEach((call) => {
                      const { methodName, returnValues } = call
                      const paramStr = JSON.stringify(call.methodParameters)
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore
                      const curReturnValues = toJS(contractStore.storage[methodName][paramStr])
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore
                      if (deepEqual(curReturnValues, returnValues)) return
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore
                      contractStore.storage[methodName][paramStr] = returnValues
                    })
                  }
                })
              })
            })
          })
          // errors in here won't get caught by try catch
          .catch((error) => {
            if (isImportantError(error)) throw this.root.captureError(error)
          })
      } catch (error) {
        if (isImportantError(error)) throw this.root.captureError(error)
      }
    })
  }

  addCall(context: ContractCallContext): void {
    // Check if call is already watched
    const uniqueCallId = generateUniqueCallId(context)
    if (this.activeCalls.has(uniqueCallId)) return

    // Get contract reference space to add call to
    const contractIndex = this.contractCallContexts.findIndex(
      (_context) => _context.reference === context.reference
    )

    // If no contract reference space exists, push whole thing
    if (contractIndex === -1) {
      this.contractCallContexts.push(context)
    } else {
      // Otherwise just push call to existing reference space
      this.contractCallContexts[contractIndex].calls.push(context.calls[0])
    }

    // Watch call
    this.activeCalls.add(uniqueCallId)
  }

  removeCall(contextToRemove: ContractCallContext): void {
    const uniqueCallIdToRemove = generateUniqueCallId(contextToRemove)
    this.activeCalls.delete(uniqueCallIdToRemove)

    // Get call to remove, and the contract reference it's stored at
    const callToRemove = contextToRemove.calls[0]
    const contractIndex = this.contractCallContexts.findIndex(
      (_context) => _context.reference === contextToRemove.reference
    )

    // Remove the call
    this.contractCallContexts[contractIndex].calls = this.contractCallContexts[
      contractIndex
    ].calls.filter((_call) => !sameMethodAndParams(_call, callToRemove))
  }
}

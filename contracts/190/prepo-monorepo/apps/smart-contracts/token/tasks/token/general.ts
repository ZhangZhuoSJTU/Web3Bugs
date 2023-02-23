/* eslint-disable no-console */
import { task, types } from 'hardhat/config'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { getNetworkByChainId } from 'prepo-utils'
import { commify, formatUnits, getAddress, parseEther } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { utils } from 'prepo-hardhat'
import { AccountList, ERC20, Vesting } from '../../types'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const { getDefenderAdminClient } = utils

function sleep(time): Promise<void> {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, time))
}

function readAddressesFromFile(filePath: string): Set<string> {
  const addressSet = new Set<string>()
  const listInputPath = readFileSync(path.resolve(__dirname, filePath), 'utf8')
  const listEntries = listInputPath.split('\n')
  listEntries.forEach((entry) => {
    const splitEntry = entry.split(' ')
    if (splitEntry[0]) {
      const account = getAddress(splitEntry[0])
      addressSet.add(account)
    }
  })
  return addressSet
}

function readAddressesAndAmountsFromFile(filePath: string): Map<string, BigNumber> {
  const allocations = new Map<string, BigNumber>()
  const listInputPath = readFileSync(path.resolve(__dirname, filePath), 'utf8')
  const listEntries = listInputPath.split('\n')
  listEntries.forEach((entry) => {
    const splitEntry = entry.split(' ')
    if (splitEntry[0]) {
      const account = getAddress(splitEntry[0])
      if (splitEntry[1]) {
        const amount = parseEther(splitEntry[1])
        allocations.set(account, amount)
      }
    }
  })
  return allocations
}

function removeStringsFromSet(toRemove: string[], set: Set<string>): Set<string> {
  toRemove.forEach((account) => {
    if (account) {
      set.delete(account)
    }
  })
  return set
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getERC20ApprovalEventsBetweenBlocks(
  erc20: ERC20,
  owner: string | null,
  spender: string | null,
  start: number | null
): Promise<any> {
  const filter = erc20.filters.Approval(owner, spender)
  const results = await erc20.queryFilter(filter, start)
  return results
}

task('check-if-included', 'ensure a list of addresses is already included')
  .addParam('name', 'deployment name of AccountList', '', types.string)
  .addParam(
    'list',
    'filepath to list of addresses that should already be included',
    '',
    types.string
  )
  .setAction(async (args, { ethers, getChainId }) => {
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const governanceAddress = getPrePOAddressForNetwork(
      'GOVERNANCE',
      currentNetwork.name,
      process.env.GOVERNANCE
    )
    console.log('Governance for the current network is at:', governanceAddress)
    const fetchedAccountList = (await ethers.getContract(args.name)) as AccountList
    console.log('Fetched', args.name, 'at', fetchedAccountList.address)
    const accountsFromList = readAddressesFromFile(args.list)
    const inclusionArray = Array.from(accountsFromList.keys())
    console.log('Verifying', inclusionArray.length, 'addresses')
    /* eslint-disable no-await-in-loop */
    /**
     * Because polling all requests in parallel will result in flooding the
     * provider with too many requests, we must perform requests sequentially
     * in a loop, which is against conventional eslint. However, we can chunk
     * in groups of 50 to speed things up.
     */
    let chunkSize = 50
    for (let i = 0; i < inclusionArray.length; i += chunkSize) {
      console.log('Fetching', i, 'to', i + chunkSize)
      if (i + chunkSize >= inclusionArray.length) {
        chunkSize = inclusionArray.length - i
      }
      const arrayChunk = inclusionArray.slice(i, i + chunkSize)
      for (let j = 1; j <= 3; j++) {
        if (j !== 1) {
          console.log('Attempt', j, 'fetch for', i, 'to', i + chunkSize)
        }
        try {
          await Promise.all(
            arrayChunk.map(async (account) => {
              const isIncluded = await fetchedAccountList.isIncluded(account)
              if (!isIncluded) {
                console.log(account, 'is not included')
              }
              return account
            })
          )
          break
        } catch (err) {
          console.log('Attempt failed, trying again...')
          // Sleep for 2 seconds to ensure provider is not flooded
          await sleep(2000)
        }
      }
    }
  })

task('modify-account-list', 'modify AccountList')
  .addParam('name', 'deployment name of AccountList', '', types.string)
  .addOptionalParam('add', 'filepath to list of addresses to include', '', types.string)
  .addOptionalParam('remove', 'filepath to list of addresses to remove', '', types.string)
  .addOptionalParam('groupSize', 'size of grouping of addresses', '', types.string)
  .setAction(async (args, { ethers, getChainId }) => {
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const governanceAddress = getPrePOAddressForNetwork(
      'GOVERNANCE',
      currentNetwork.name,
      process.env.GOVERNANCE
    )
    console.log('Governance for the current network is at:', governanceAddress)
    const fetchedAccountList = (await ethers.getContract(args.name)) as AccountList
    console.log('Fetched', args.name, 'at', fetchedAccountList.address)
    const defenderClient = getDefenderAdminClient(currentChain)
    const groupSize = parseInt(args.groupSize, 10)
    /**
     * For safety, add addresses after we remove them, in case we have an
     * unintentional duplicate in both.
     */
    if (args.remove !== '') {
      console.log('Removing addresses from', args.remove)
      const setOfAccountsToRemove = readAddressesFromFile(args.remove)
      let accountsToRemove = Array.from(setOfAccountsToRemove.keys())
      const addressesAlreadyRemoved = await Promise.all(
        accountsToRemove.map(async (account) => {
          if (!(await fetchedAccountList.isIncluded(account))) {
            return account
          }
          return ''
        })
      )
      accountsToRemove = Array.from(
        removeStringsFromSet(addressesAlreadyRemoved, setOfAccountsToRemove).keys()
      )
      if (accountsToRemove.length >= 1) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        console.log('splitting addresses into groups of ', args.groupSize)
        for (let i = 0; i < accountsToRemove.length; i += groupSize) {
          const accountsToRemoveSubset = accountsToRemove.slice(i, i + groupSize)
          await defenderClient.createProposal({
            contract: {
              address: fetchedAccountList.address,
              network: currentNetwork.defenderName as any,
            },
            title: `(${i} - ${i + accountsToRemoveSubset.length}) Remove addresses from ${
              args.name
            }`,
            description: `Removing ${groupSize} addresses from AccountList at ${fetchedAccountList.address}`,
            type: 'custom',
            functionInterface: {
              name: 'set',
              inputs: [
                { type: 'address[]', name: '_accounts' },
                { type: 'bool[]', name: '_included' },
              ],
            },
            functionInputs: [
              accountsToRemoveSubset,
              new Array(accountsToRemoveSubset.length).fill(false),
            ],
            via: governanceAddress,
            viaType: 'Gnosis Safe',
          })
        }
      }
      console.log('Removed', accountsToRemove.length, 'Accounts')
    }
    if (args.add !== '') {
      console.log('Including addresses from', args.add)
      const setOfAccountsToInclude = readAddressesFromFile(args.add)
      let accountsToInclude = Array.from(setOfAccountsToInclude.keys())
      // Filter out already included addresses to cut down on tx cost
      const addressesAlreadyIncluded = await Promise.all(
        accountsToInclude.map(async (account) => {
          if (await fetchedAccountList.isIncluded(account)) {
            return account
          }
          return ''
        })
      )
      accountsToInclude = Array.from(
        removeStringsFromSet(addressesAlreadyIncluded, setOfAccountsToInclude).keys()
      )
      if (accountsToInclude.length >= 1) {
        console.log('splitting addresses into groups of ', args.groupSize)
        for (let i = 0; i < accountsToInclude.length; i += groupSize) {
          const accountsToIncludeSubset = accountsToInclude.slice(i, i + groupSize)
          await defenderClient.createProposal({
            contract: {
              address: fetchedAccountList.address,
              network: currentNetwork.defenderName as any,
            },
            title: `(${i} - ${i + accountsToIncludeSubset.length}) Include addresses for ${
              args.name
            }`,
            description: `Including ${accountsToIncludeSubset.length} addresses for AccountList at ${fetchedAccountList.address}`,
            type: 'custom',
            functionInterface: {
              name: 'set',
              inputs: [
                { type: 'address[]', name: '_accounts' },
                { type: 'bool[]', name: '_included' },
              ],
            },
            functionInputs: [
              accountsToIncludeSubset,
              new Array(accountsToIncludeSubset.length).fill(true),
            ],
            via: governanceAddress,
            viaType: 'Gnosis Safe',
          })
        }
      }
      console.log('Included', accountsToInclude.length, 'Accounts')
    }
  })

task('modify-vesting-allocation', 'modify Vesting allocations')
  .addParam('allocation', 'filepath to list of addresses and allocation amounts', '', types.string)
  .setAction(async (args, { ethers, getChainId }) => {
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const governanceAddress = getPrePOAddressForNetwork(
      'GOVERNANCE',
      currentNetwork.name,
      process.env.GOVERNANCE
    )
    console.log('Governance for the current network is at:', governanceAddress)
    const vesting = (await ethers.getContract(DEPLOYMENT_NAMES.vesting.name)) as Vesting
    console.log('Using Vesting at', vesting.address)
    console.log('Setting allocations from', args.allocation)
    const allocations = readAddressesAndAmountsFromFile(args.allocation)
    console.log('Allocations:', allocations)
    const accountsArray: string[] = []
    const amountsArray: BigNumber[] = []
    allocations.forEach((amount, account) => {
      accountsArray.push(account)
      amountsArray.push(amount)
    })
    const defenderClient = getDefenderAdminClient(currentChain)
    if (accountsArray.length !== amountsArray.length)
      throw new Error("Accounts and Amounts arrays don't match")
    /**
     * OZ's `createProposal` function only allows string/boolean
     * representations of values, can't directly pass in BN values.
     */
    const amountsArrayAsString = amountsArray.map((amount) => amount.toString())
    await defenderClient.createProposal({
      contract: {
        address: vesting.address,
        network: currentNetwork.defenderName as any,
      },
      title: `Modifying vesting allocations`,
      description: `Modifying vesting allocations for ${accountsArray.length} addresses for Vesting at ${vesting.address}`,
      type: 'custom',
      functionInterface: {
        name: 'setAllocations',
        inputs: [
          { type: 'address[]', name: '_recipients' },
          { type: 'uint256[]', name: '_amounts' },
        ],
      },
      functionInputs: [accountsArray, amountsArrayAsString],
      via: governanceAddress,
      viaType: 'Gnosis Safe',
    })
    console.log('Set vesting allocations for', accountsArray.length, 'accounts')
  })

task(
  'get-usdc-approvals',
  'retrieves USDC approvals made to a MiniSales contract and dumps it to a CSV'
)
  .addParam('name', 'name of MiniSales contract to poll approvals for')
  .addParam('output', '')
  .addParam('from', 'start of block range to parse', 0, types.int)
  .setAction(async (args, { ethers, getChainId }) => {
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const usdcAddress = getPrePOAddressForNetwork('USDC', currentNetwork.name, process.env.USDC)
    const erc20ContractFactory = await ethers.getContractFactory('ERC20')
    const usdc = (await erc20ContractFactory.attach(usdcAddress)) as ERC20
    const miniSales = await ethers.getContract(args.name)
    const usdcApprovalEvents = await getERC20ApprovalEventsBetweenBlocks(
      usdc,
      null,
      miniSales.address,
      args.from
    )
    const addressSet = new Set<string>()
    usdcApprovalEvents.forEach((approvalEvent) => {
      addressSet.add(getAddress(approvalEvent.args.owner))
    })
    console.log(addressSet.size, 'accounts have already made their USDC approvals')
    const usersThatApproved = Array.from(addressSet.keys())
    const outputArray = []
    usersThatApproved.forEach((account) => {
      outputArray.push(account)
      outputArray.push('\n')
    })
    writeFileSync(path.resolve(__dirname, args.output), outputArray.join(''))
  })

task('monitor-minisales-balance', 'monitor PPO and USDC balance for a MiniSales contract')
  .addParam('name', 'name of MiniSales contract to poll approvals for')
  .setAction(async (args, { ethers, getChainId }) => {
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const usdcAddress = getPrePOAddressForNetwork('USDC', currentNetwork.name, process.env.USDC)
    const erc20ContractFactory = await ethers.getContractFactory('ERC20')
    const usdc = (await erc20ContractFactory.attach(usdcAddress)) as ERC20
    const ppo = await ethers.getContract(DEPLOYMENT_NAMES.ppo.name)
    const miniSales = await ethers.getContract(args.name)
    console.log('Fetched', args.name, 'at', miniSales.address)
    const ppoSupply = parseEther('100000000')
    while (true) {
      console.log(
        'MiniSales PPO Sold:',
        commify(formatUnits(ppoSupply.sub(await ppo.balanceOf(miniSales.address)), 18))
      )
      console.log(
        'MiniSales USDC Balance:',
        commify(formatUnits(await usdc.balanceOf(miniSales.address), 6))
      )
      console.log('\n')
      await sleep(1000)
    }
  })

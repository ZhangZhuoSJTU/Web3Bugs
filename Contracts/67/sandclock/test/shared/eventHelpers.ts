import { ethers } from "hardhat";
import type {
  ContractReceipt,
  Event,
  providers,
  Contract,
  ContractTransaction,
  utils,
} from "ethers";

export async function findEvents(
  tx: ContractTransaction,
  contract: Contract,
  name: string
): Promise<utils.LogDescription[]> {
  const receipt = await tx.wait(); //await contract.provider.waitForTransaction(tx.hash);
  const eventFragment = contract.interface.getEvent(name);
  const topic = contract.interface.getEventTopic(eventFragment);

  return receipt.logs
    .filter(
      (log) =>
        log.topics.includes(topic) &&
        log.address &&
        log.address.toLowerCase() === contract.address
    )
    .map((log) => contract.interface.parseLog(log));
}

export async function findEvent(
  tx: ContractTransaction,
  contract: Contract,
  name: string,
  i: number
): Promise<Event | undefined> {
  return findEvents(tx, contract, name)[i || 0];
}

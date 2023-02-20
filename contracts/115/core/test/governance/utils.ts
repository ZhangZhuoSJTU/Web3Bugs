const { BN } = require("@openzeppelin/test-helpers");

export type Proposal = {
  targets: string[];
  values: string[];
  signatures: string[];
  calldatas: string[];
  description: string;
};

export function buildTestProposal(escrowAddress: string, proposerAddress: string, actionCount = 1): Proposal {
  const targets = [];
  const values = [];
  const signatures = [];
  const calldatas = [];
  const description = "do nothing";

  for (let i = 0; i < actionCount; i++) {
    targets.push(escrowAddress);
    values.push("0");
    signatures.push("balanceOf(address)");
    calldatas.push(encodeParameters(["address"], [proposerAddress]));
  }

  return {
    targets,
    values,
    signatures,
    calldatas,
    description,
  };
}

// Build proposal to transfer X ERC20 tokens split across multiple recipients
export function buildMultiProposal(tokenAddress: string, amount: BN, recipients: string[]): Proposal {
  const targets = [];
  const values = [];
  const signatures = [];
  const calldatas = [];
  const splitAmount: string = amount.div(new BN(recipients.length)).toString();
  for (const recipient of recipients) {
    targets.push(tokenAddress);
    values.push("0");
    signatures.push("transfer(address,uint256)");
    calldatas.push(encodeParameters(["address", "uint256"], [recipient, splitAmount]));
  }

  const description = "Transfer tokens to multiple recipients";
  return {
    targets,
    values,
    signatures,
    calldatas,
    description,
  };
}

export function encodeParameters(types: string[], values: string[]) {
  return web3.eth.abi.encodeParameters(types, values);
}

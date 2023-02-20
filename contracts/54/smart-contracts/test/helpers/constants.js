const HARDHAT_VM_ERROR = 'VM Exception while processing transaction:'

module.exports = {
  errorMessages: {
    HARDHAT_VM_ERROR,
    VM_ERROR_INVALID_OPCODE: `${HARDHAT_VM_ERROR} invalid opcode`,
    VM_ERROR_REVERT_WITH_REASON: `${HARDHAT_VM_ERROR} reverted with reason string`,
    VM_ERROR_REVERT_UNKNOWN:
      "Transaction reverted and Hardhat couldn't infer the reason. Please report this to help us improve Hardhat.",
  },
}

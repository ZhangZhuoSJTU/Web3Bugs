/**
 * A copy paste of relevent information from the unlock-app wallet service.
 * At the moment it's not possible to depend on that file directly in smart contract tests.
 * The values here should manually be kept in sync with unlock-app/src/services/walletService.js
 * until we can create a shared dependancy.
 */
class WalletService {
  static gasAmountConstants() {
    return {
      createLock: 4500000,
      updateKeyPrice: 1000000,
      purchaseKey: 1000000,
      expireAndRefundFor: 1000000,
      cancelAndRefund: 1000000,
      withdrawFromLock: 1000000,
    }
  }
}

module.exports = WalletService

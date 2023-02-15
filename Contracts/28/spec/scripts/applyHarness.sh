# change import "../Utils/SafeTransfer.sol" to harness code in spec/harness/SafeTransfer.sol
perl -0777 -i -pe 's/\.\.\/Utils\/SafeTransfer\.sol/\.\.\/\.\.\/spec\/harness\/SafeTransfer.sol/g' contracts/Auctions/DutchAuction.sol

# change import "../Access/MISOAccessControls.sol" to harness code in spec/harness/MISOAccessControls.sol
perl -0777 -i -pe 's/\.\.\/Access\/MISOAccessControls\.sol/\.\.\/\.\.\/spec\/harness\/MISOAccessControls.sol/g' contracts/Auctions/DutchAuction.sol

# change import ""../Utils/Documents.sol"  to harnness code in spec/harness/Document.sol
perl -0777 -i -pe 's/\.\.\/Utils\/Documents\.sol/\.\.\/\.\.\/spec\/harness\/Documents.sol/g' contracts/Auctions/DutchAuction.sol

# virtualize private function
perl -0777 -i -pe 's/\) private view /\) internal virtual view /g' contracts/Auctions/DutchAuction.sol

# change eth transfer
perl -0777 -i -pe 's/_beneficiary.transfer\(/_safeTokenPayment\(paymentCurrency,_beneficiary,/g' contracts/Auctions/DutchAuction.sol
# virtualize public function
perl -0777 -i -pe 's/public view returns/public virtual view returns/g' contracts/Auctions/DutchAuction.sol

# virtualize batch
perl -0777 -i -pe 's/function batch\(bytes\[\] calldata calls, bool revertOnFail\) external/function batch\(bytes\[\] calldata calls, bool revertOnFail\) external virtual/g' contracts/Utils/BoringBatchable.sol
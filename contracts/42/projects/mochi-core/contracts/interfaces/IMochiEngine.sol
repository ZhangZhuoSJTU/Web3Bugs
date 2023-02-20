// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@mochifi/vmochi/contracts/interfaces/IVMochi.sol";
import "@mochifi/cssr/contracts/interfaces/ICSSRRouter.sol";
import "./IMochiProfile.sol";
import "./IDiscountProfile.sol";
import "./IMochiVault.sol";
import "./IFeePool.sol";
import "./IReferralFeePool.sol";
import "./ILiquidator.sol";
import "./IUSDM.sol";
import "./IMochi.sol";
import "./IMinter.sol";
import "./IMochiNFT.sol";
import "./IMochiVaultFactory.sol";

interface IMochiEngine {
    function mochi() external view returns (IMochi);

    function vMochi() external view returns (IVMochi);

    function usdm() external view returns (IUSDM);

    function cssr() external view returns (ICSSRRouter);

    function governance() external view returns (address);

    function treasury() external view returns (address);

    function operationWallet() external view returns (address);

    function mochiProfile() external view returns (IMochiProfile);

    function discountProfile() external view returns (IDiscountProfile);

    function feePool() external view returns (IFeePool);

    function referralFeePool() external view returns (IReferralFeePool);

    function liquidator() external view returns (ILiquidator);

    function minter() external view returns (IMinter);

    function nft() external view returns (IMochiNFT);

    function vaultFactory() external view returns (IMochiVaultFactory);
}

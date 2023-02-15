// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "./vault/MochiVaultFactory.sol";
import "./assets/usdm.sol";
import "./interfaces/IMochiEngine.sol";

contract MochiEngine is IMochiEngine {
    // immutable values
    IMochiVaultFactory public immutable override vaultFactory;
    // mutable values
    IMochi public override mochi;
    IVMochi public override vMochi;
    address public override governance;
    address public override treasury;
    address public override operationWallet;
    IUSDM public override usdm;
    IMinter public override minter;
    ICSSRRouter public override cssr;
    IMochiProfile public override mochiProfile;
    IDiscountProfile public override discountProfile;
    ILiquidator public override liquidator;
    IFeePool public override feePool;
    IReferralFeePool public override referralFeePool;
    IMochiNFT public override nft;

    constructor(address _governance) {
        governance = _governance;
        vaultFactory = IMochiVaultFactory(new MochiVaultFactory(address(this)));
        operationWallet = msg.sender;
    }

    modifier onlyGov() {
        require(msg.sender == governance, "!gov");
        _;
    }

    function changeMochi(address _mochi) external onlyGov {
        mochi = IMochi(_mochi);
    }

    function changeVMochi(address _vmochi) external onlyGov {
        vMochi = IVMochi(_vmochi);
    }

    function changeUSDM(address _usdm) external onlyGov {
        usdm = IUSDM(_usdm);
    }

    function changeMinter(address _minter) external onlyGov {
        minter = IMinter(_minter);
    }

    function changeGovernance(address _governance) external onlyGov {
        governance = _governance;
    }

    function changeTreasury(address _treasury) external onlyGov {
        treasury = _treasury;
    }

    function changeOperationWallet(address _operation) external onlyGov {
        operationWallet = _operation;
    }

    function changeCSSR(address _cssr) external onlyGov {
        cssr = ICSSRRouter(_cssr);
    }

    function changeProfile(address _profile) external onlyGov {
        mochiProfile = IMochiProfile(_profile);
    }

    function changeDiscountProfile(address _profile) external onlyGov {
        discountProfile = IDiscountProfile(_profile);
    }

    function changeLiquidator(address _liquidator) external onlyGov {
        liquidator = ILiquidator(_liquidator);
    }

    function changeFeePool(address _feePool) external onlyGov {
        feePool = IFeePool(_feePool);
    }

    function changeReferralFeePool(address _referralFeePool) external onlyGov {
        referralFeePool = IReferralFeePool(_referralFeePool);
    }

    function changeNFT(address _nft) external onlyGov {
        nft = IMochiNFT(_nft);
    }
}

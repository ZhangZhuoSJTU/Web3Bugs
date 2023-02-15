// SPDX-License-Identifier: (c) Mochi.Fi, 2021

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@mochifi/library/contracts/CheapERC20.sol";
import "../interfaces/IERC3156FlashLender.sol";
import "../interfaces/IMochiVault.sol";
import "../interfaces/IMochiEngine.sol";
import "../interfaces/IUSDM.sol";

contract MochiVault is Initializable, IMochiVault, IERC3156FlashLender {
    using Float for uint256;
    using CheapERC20 for IERC20;

    bytes32 public constant CALLBACK_SUCCESS =
        keccak256("ERC3156FlashBorrower.onFlashLoan");

    /// immutable variables
    IMochiEngine public immutable engine;
    IERC20 public override asset;

    /// for accruing debt
    uint256 public debtIndex;
    uint256 public lastAccrued;

    /// storage variables
    uint256 public override deposits;
    uint256 public override debts;
    int256 public override claimable;

    ///Mochi waits until the stability fees hit 1% and then starts calculating debt after that.
    ///E.g. If the stability fees are 10% for a year
    ///Mochi will wait 36.5 days (the time period required for the pre-minted 1%)

    /// result
    uint256 public liquidated;

    mapping(uint256 => Detail) public override details;
    mapping(uint256 => uint256) public lastDeposit;

    modifier updateDebt(uint256 _id) {
        accrueDebt(_id);
        _;
    }

    modifier wait(uint256 _id) {
        require(
            lastDeposit[_id] + engine.mochiProfile().delay() <= block.timestamp,
            "!wait"
        );
        accrueDebt(_id);
        _;
    }

    constructor(address _engine) {
        engine = IMochiEngine(_engine);
    }

    function initialize(address _asset) external override initializer {
        asset = IERC20(_asset);
        debtIndex = 1e18;
        lastAccrued = block.timestamp;
    }

    function liveDebtIndex() public view override returns (uint256 index) {
        return
            engine.mochiProfile().calculateFeeIndex(
                address(asset),
                debtIndex,
                lastAccrued
            );
    }

    function status(uint256 _id) public view override returns (Status) {
        return details[_id].status;
    }

    function currentDebt(uint256 _id) public view override returns (uint256) {
        require(details[_id].status != Status.Invalid, "invalid");
        uint256 newIndex = liveDebtIndex();
        return (details[_id].debt * newIndex) / details[_id].debtIndex;
    }

    function accrueDebt(uint256 _id) public {
        // global debt for vault
        // first, increase gloabal debt;
        uint256 currentIndex = liveDebtIndex();
        uint256 increased = (debts * currentIndex) / debtIndex - debts;
        debts += increased;
        claimable += int256(increased);
        // update global debtIndex
        debtIndex = currentIndex;
        lastAccrued = block.timestamp;
        // individual debt
        if (_id != type(uint256).max && details[_id].debtIndex < debtIndex) {
            require(details[_id].status != Status.Invalid, "invalid");
            if (details[_id].debt != 0) {
                uint256 increasedDebt = (details[_id].debt * debtIndex) /
                    details[_id].debtIndex -
                    details[_id].debt;
                uint256 discountedDebt = increasedDebt.multiply(
                    engine.discountProfile().discount(engine.nft().ownerOf(_id))
                );
                debts -= discountedDebt;
                claimable -= int256(discountedDebt);
                details[_id].debt += (increasedDebt - discountedDebt);
            }
            details[_id].debtIndex = debtIndex;
        }
    }

    function increase(
        uint256 _id,
        uint256 _deposits,
        uint256 _borrows,
        address _referrer,
        bytes memory _data
    ) external {
        if (_id == type(uint256).max) {
            // mint if _id is -1
            _id = mint(msg.sender, _referrer);
        }
        if (_deposits > 0) {
            deposit(_id, _deposits);
        }
        if (_borrows > 0) {
            borrow(_id, _borrows, _data);
        }
    }

    function decrease(
        uint256 _id,
        uint256 _withdraws,
        uint256 _repays,
        bytes memory _data
    ) external {
        if (_repays > 0) {
            repay(_id, _repays);
        }
        if (_withdraws > 0) {
            withdraw(_id, _withdraws, _data);
        }
    }

    function mint(address _recipient, address _referrer)
        public
        returns (uint256 id)
    {
        id = engine.nft().mint(address(asset), _recipient);
        details[id].debtIndex = liveDebtIndex();
        details[id].status = Status.Idle;
        details[id].referrer = _referrer;
    }

    /// anyone can deposit collateral to given id
    /// it will even allow depositing to liquidated vault so becareful when depositing
    function deposit(uint256 _id, uint256 _amount)
        public
        override
        updateDebt(_id)
    {
        // should it be able to deposit if invalid?
        require(engine.nft().asset(_id) == address(asset), "!asset");
        require(
            details[_id].status == Status.Idle ||
                details[_id].status == Status.Collaterized ||
                details[_id].status == Status.Active,
            "!depositable"
        );
        lastDeposit[_id] = block.timestamp;
        deposits += _amount;
        details[_id].collateral += _amount;
        if (details[_id].status == Status.Idle) {
            details[_id].status = Status.Collaterized;
        }
        asset.cheapTransferFrom(msg.sender, address(this), _amount);
    }

    /// should only be able to withdraw if status is not liquidatable
    function withdraw(
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public override wait(_id) {
        require(engine.nft().ownerOf(_id) == msg.sender, "!approved");
        require(engine.nft().asset(_id) == address(asset), "!asset");
        // update prior to interaction
        float memory price = engine.cssr().update(address(asset), _data);
        require(
            !_liquidatable(
                details[_id].collateral - _amount,
                price,
                details[_id].debt
            ),
            "!healthy"
        );
        float memory cf = engine.mochiProfile().maxCollateralFactor(
            address(asset)
        );
        uint256 maxMinted = (details[_id].collateral - _amount)
            .multiply(cf)
            .multiply(price);
        require(details[_id].debt <= maxMinted, ">cf");
        deposits -= _amount;
        details[_id].collateral -= _amount;
        if (details[_id].collateral == 0) {
            details[_id].status = Status.Idle;
        }
        asset.cheapTransfer(engine.nft().ownerOf(_id), _amount);
    }

    function borrow(
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public override updateDebt(_id) {
        // update prior to interaction
        float memory price = engine.cssr().update(address(asset), _data);
        float memory cf = engine.mochiProfile().maxCollateralFactor(
            address(asset)
        );
        uint256 maxMinted = details[_id].collateral.multiply(cf).multiply(
            price
        );
        require(engine.nft().ownerOf(_id) == msg.sender, "!approved");
        require(engine.nft().asset(_id) == address(asset), "!asset");
        if(details[_id].debt + _amount > maxMinted) {
            _amount = maxMinted - details[_id].debt;
        }
        if(engine.mochiProfile().creditCap(address(asset)) < debts + _amount) {
            _amount = engine.mochiProfile().creditCap(address(asset)) - debts;
        }
        uint256 increasingDebt = (_amount * 1005) / 1000;
        uint256 totalDebt = details[_id].debt + increasingDebt;
        require(details[_id].debt + _amount >= engine.mochiProfile().minimumDebt(), "<minimum");
        require(
            !_liquidatable(details[_id].collateral, price, totalDebt),
            "!healthy"
        );
        mintFeeToPool(increasingDebt - _amount, details[_id].referrer);
        // this will ensure debtIndex will not increase on further `updateDebt` triggers
        details[_id].debtIndex =
            (details[_id].debtIndex * (totalDebt)) /
            (details[_id].debt + _amount);
        details[_id].debt = totalDebt;
        details[_id].status = Status.Active;
        debts += _amount;
        engine.minter().mint(msg.sender, _amount);
    }

    /// someone sends usdm to this address and repays the debt
    /// will payback the leftover usdm
    function repay(uint256 _id, uint256 _amount)
        public
        override
        updateDebt(_id)
    {
        if (_amount > details[_id].debt) {
            _amount = details[_id].debt;
        }
        require(_amount > 0, "zero");
        if (debts < _amount) {
            // safe gaurd to some underflows
            debts = 0;
        } else {
            debts -= _amount;
        }
        details[_id].debt -= _amount;
        if (details[_id].debt == 0) {
            details[_id].status = Status.Collaterized;
        }
        engine.usdm().transferFrom(msg.sender, address(this), _amount);
        engine.usdm().burn(_amount);
    }

    function liquidate(
        uint256 _id,
        uint256 _collateral,
        uint256 _usdm
    ) external override updateDebt(_id) {
        require(msg.sender == address(engine.liquidator()), "!liquidator");
        require(engine.nft().asset(_id) == address(asset), "!asset");
        float memory price = engine.cssr().getPrice(address(asset));
        require(
            _liquidatable(details[_id].collateral, price, currentDebt(_id)),
            "healthy"
        );

        debts -= _usdm;

        details[_id].collateral -= _collateral;
        details[_id].debt -= _usdm;

        asset.cheapTransfer(msg.sender, _collateral);
    }

    /// @dev returns if status is liquidatable with given `_collateral` amount and `_debt` amount
    /// @notice should return false if _collateral * liquidationLimit < _debt
    function _liquidatable(
        uint256 _collateral,
        float memory _price,
        uint256 _debt
    ) internal view returns (bool) {
        float memory lf = engine.mochiProfile().liquidationFactor(
            address(asset)
        );
        // when debt is lower than liquidation value, it can be liquidated
        return _collateral.multiply(lf) < _debt.divide(_price);
    }

    function liquidatable(uint256 _id) external view returns (bool) {
        float memory price = engine.cssr().getPrice(address(asset));
        return _liquidatable(details[_id].collateral, price, currentDebt(_id));
    }

    function claim() external updateDebt(type(uint256).max) {
        require(claimable > 0, "!claimable");
        // reserving 25% to prevent potential risks
        uint256 toClaim = (uint256(claimable) * 75) / 100;
        mintFeeToPool(toClaim, address(0));
    }

    function mintFeeToPool(uint256 _amount, address _referrer) internal {
        claimable -= int256(_amount);
        if (address(0) != _referrer) {
            engine.minter().mint(address(engine.referralFeePool()), _amount);
            engine.referralFeePool().addReward(_referrer);
        } else {
            engine.minter().mint(address(engine.treasury()), _amount);
        }
    }

    // Flash Loan
    function maxFlashLoan(address _token)
        external
        view
        override
        returns (uint256)
    {
        require(_token == address(asset), "!supported");
        return asset.balanceOf(address(this));
    }

    function flashFee(address _token, uint256 _amount)
        public
        view
        override
        returns (uint256)
    {
        //should return 0.1337% * _amount;
        require(_token == address(asset), "!supported");
        return (_amount * 1337) / 1000000;
    }

    function flashLoan(
        IERC3156FlashBorrower _receiver,
        address _token,
        uint256 _amount,
        bytes calldata _data
    ) external override returns (bool) {
        require(_token == address(asset), "!supported");
        uint256 fee = flashFee(_token, _amount);
        asset.cheapTransfer(address(_receiver), _amount);
        require(
            _receiver.onFlashLoan(msg.sender, _token, _amount, fee, _data) ==
                CALLBACK_SUCCESS,
            "!callback"
        );
        asset.cheapTransferFrom(address(_receiver), address(this), _amount);
        asset.cheapTransferFrom(address(_receiver), engine.treasury(), fee);
        return true;
    }
}

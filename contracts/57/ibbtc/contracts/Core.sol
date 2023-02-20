// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20, SafeMath} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/math/Math.sol";

import {IPeak} from "./interfaces/IPeak.sol";
import {IbBTC} from "./interfaces/IbBTC.sol";
import {ICore} from "./interfaces/ICore.sol";
import {GovernableProxy} from "./common/proxy/GovernableProxy.sol";

contract Core is GovernableProxy, ICore {
    using SafeERC20 for IERC20;
    using SafeMath for uint;
    using Math for uint;

    uint constant PRECISION = 1e4;

    IbBTC public immutable bBTC;

    BadgerGuestListAPI public guestList;

    enum PeakState { Extinct, Active, Dormant }
    mapping(address => PeakState) public peaks;

    address[] public peakAddresses;
    address public feeSink;
    uint public mintFee;
    uint public redeemFee;
    uint public accumulatedFee;

    uint256[50] private __gap;

    // END OF STORAGE VARIABLES

    event PeakWhitelisted(address indexed peak);
    event FeeCollected(uint amount);

    /**
    * @param _bBTC bBTC token address
    */
    constructor(address _bBTC) public {
        require(_bBTC != address(0), "NULL_ADDRESS");
        bBTC = IbBTC(_bBTC);
    }

    /**
    * @notice Mint bBTC
    * @dev Only whitelisted peaks can call this function
    * @param btc BTC amount supplied, scaled by 1e18
    * @return bBtc Badger BTC that was minted
    */
    function mint(uint btc, address account, bytes32[] calldata merkleProof)
        override
        external
        returns(uint)
    {
        require(peaks[msg.sender] == PeakState.Active, "PEAK_INACTIVE");
        if (address(guestList) != address(0)) {
            require(
                guestList.authorized(account, btc, merkleProof),
                "guest-list-authorization"
            );
        }
        (uint bBtc, uint fee) = btcToBbtc(btc);
        require(bBtc > 0, "MINTING_0_bBTC");
        accumulatedFee = accumulatedFee.add(fee);
        bBTC.mint(account, bBtc);
        return bBtc;
    }

    /**
    * @param btc BTC amount supplied
    */
    function btcToBbtc(uint btc) override public view returns (uint bBtc, uint fee) {
        uint _totalSupply = IERC20(address(bBTC)).totalSupply().add(accumulatedFee);
        if (_totalSupply > 0) {
            bBtc = btc.mul(_totalSupply).div(totalSystemAssets());
        } else {
            bBtc = btc;
        }
        fee = bBtc.mul(mintFee).div(PRECISION);
        bBtc = bBtc.sub(fee);
    }

    /**
    * @notice Redeem bBTC
    * @dev Only whitelisted peaks can call this function
    * @param bBtc bBTC amount to redeem
    * @return btc amount redeemed, scaled by 1e36
    */
    function redeem(uint bBtc, address account) override external returns (uint) {
        require(bBtc > 0, "REDEEMING_0_bBTC");
        require(peaks[msg.sender] != PeakState.Extinct, "PEAK_EXTINCT");
        (uint btc, uint fee) = bBtcToBtc(bBtc);
        accumulatedFee = accumulatedFee.add(fee);
        bBTC.burn(account, bBtc);
        return btc;
    }

    /**
    * @return btc amount redeemed, scaled by 1e36
    */
    function bBtcToBtc(uint bBtc) override public view returns (uint btc, uint fee) {
        fee = bBtc.mul(redeemFee).div(PRECISION);
        btc = bBtc.sub(fee).mul(pricePerShare());
    }

    function pricePerShare() override public view returns (uint) {
        uint _totalSupply = IERC20(address(bBTC)).totalSupply().add(accumulatedFee);
        if (_totalSupply > 0) {
            return totalSystemAssets().mul(1e18).div(_totalSupply);
        }
        return 1e18;
    }

    /**
    * @notice Collect all the accumulated fee (denominated in bBTC)
    */
    function collectFee() external {
        require(feeSink != address(0), "NULL_ADDRESS");
        uint _fee = accumulatedFee;
        require(_fee > 0, "NO_FEE");
        accumulatedFee = 0;
        bBTC.mint(feeSink, _fee);
        emit FeeCollected(_fee);
    }

    function totalSystemAssets() public view returns (uint totalAssets) {
        address[] memory _peakAddresses = peakAddresses;
        uint numPeaks = _peakAddresses.length;
        for (uint i = 0; i < numPeaks; i++) {
            if (peaks[_peakAddresses[i]] == PeakState.Extinct) {
                continue;
            }
            totalAssets = totalAssets.add(
                IPeak(_peakAddresses[i]).portfolioValue()
            );
        }
    }

    /* ##### Governance ##### */

    /**
    * @notice Whitelist a new peak
    * @param peak Address of the contract that interfaces with the 3rd-party protocol
    */
    function whitelistPeak(address peak)
        external
        onlyGovernance
    {
        require(
            peaks[peak] == PeakState.Extinct,
            "DUPLICATE_PEAK"
        );

        address[] memory _peakAddresses = peakAddresses;
        uint numPeaks = _peakAddresses.length;
        for (uint i = 0; i < numPeaks; i++) {
            require(_peakAddresses[i] != peak, "USE_setPeakStatus");
        }

        IPeak(peak).portfolioValue(); // sanity check
        peakAddresses.push(peak);
        peaks[peak] = PeakState.Active;
        emit PeakWhitelisted(peak);
    }

    /**
    * @notice Change a peaks status
    */
    function setPeakStatus(address peak, PeakState state)
        external
        onlyGovernance
    {
        require(
            peaks[peak] != PeakState.Extinct,
            "Peak is extinct"
        );
        if (state == PeakState.Extinct) {
            require(IPeak(peak).portfolioValue() <= 1e15, "NON_TRIVIAL_FUNDS_IN_PEAK");
        }
        peaks[peak] = state;
    }

    /**
    * @notice Set config
    * @param _mintFee Mint Fee
    * @param _redeemFee Redeem Fee
    * @param _feeSink Address of the EOA/contract where accumulated fee will be transferred
    */
    function setConfig(
        uint _mintFee,
        uint _redeemFee,
        address _feeSink
    )
        external
        onlyGovernance
    {
        require(
            _mintFee <= PRECISION
            && _redeemFee <= PRECISION,
            "INVALID_PARAMETERS"
        );
        require(_feeSink != address(0), "NULL_ADDRESS");

        mintFee = _mintFee;
        redeemFee = _redeemFee;
        feeSink = _feeSink;
    }

    function setGuestList(address _guestList) external onlyGovernance {
        guestList = BadgerGuestListAPI(_guestList);
    }
}

interface BadgerGuestListAPI {
    function authorized(address guest, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool);
}

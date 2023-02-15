// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Interfaces/IYETIToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/LiquityMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/SafeERC20.sol";


contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;
    using SafeERC20 for IYETIToken;

    // --- Data ---

    bytes32 constant public NAME = "CommunityIssuance";

    uint constant public SECONDS_IN_ONE_MINUTE = 60;

   /* The issuance factor F determines the curvature of the issuance curve.
    *
    * Minutes in one year: 60*24*365 = 525600
    *
    * For 50% of remaining tokens issued each year, with minutes as time units, we have:
    * 
    * F ** 525600 = 0.5
    * 
    * Re-arranging:
    * 
    * 525600 * ln(F) = ln(0.5)
    * F = 0.5 ** (1/525600)
    * F = 0.999998681227695000 
    */
    uint constant public ISSUANCE_FACTOR = 999998681227695000;

    /* 
    * The community YETI supply cap is the starting balance of the Community Issuance contract.
    * It should be minted to this contract by YETIToken, when the token is deployed.
    * 
    * Set to 32M (slightly less than 1/3) of total YETI supply.
    */
    uint constant public YETISupplyCap = 32e24; // 32 million

    IYETIToken public yetiToken;

    address public stabilityPoolAddress;

    uint public totalYETIIssued;
    uint public immutable deploymentTime;

    // --- Events ---

    event YETITokenAddressSet(address _yetiTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalYETIIssuedUpdated(uint _totalYETIIssued);

    // --- Functions ---

    constructor() public {
        deploymentTime = block.timestamp;
    }

    function setAddresses
    (
        address _yetiTokenAddress,
        address _stabilityPoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_yetiTokenAddress);
        checkContract(_stabilityPoolAddress);

        yetiToken = IYETIToken(_yetiTokenAddress);
        stabilityPoolAddress = _stabilityPoolAddress;

        // When YETIToken deployed, it should have transferred CommunityIssuance's YETI entitlement
        uint YETIBalance = yetiToken.balanceOf(address(this));
        require(YETIBalance >= YETISupplyCap, "setAddresses: balance must be less than supplycap");

        emit YETITokenAddressSet(_yetiTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);

        _renounceOwnership();
    }

    function issueYETI() external override returns (uint) {
        _requireCallerIsStabilityPool();

        uint latestTotalYETIIssued = YETISupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalYETIIssued.sub(totalYETIIssued);

        totalYETIIssued = latestTotalYETIIssued;
        emit TotalYETIIssuedUpdated(latestTotalYETIIssued);
        
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last YETI issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        // Get the time passed since deployment
        uint timePassedInMinutes = block.timestamp.sub(deploymentTime).div(SECONDS_IN_ONE_MINUTE);

        // f^t
        uint power = LiquityMath._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint cumulativeIssuanceFraction = (uint(DECIMAL_PRECISION).sub(power));
        require(cumulativeIssuanceFraction <= DECIMAL_PRECISION, "Fraction must be in range [0,1]"); // must be in range [0,1]

        return cumulativeIssuanceFraction;
    }

    function sendYETI(address _account, uint _YETIamount) external override {
        _requireCallerIsStabilityPool();

        yetiToken.safeTransfer(_account, _YETIamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}

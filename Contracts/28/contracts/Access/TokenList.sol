pragma solidity 0.6.12;

import "../interfaces/IPointList.sol";
import "../interfaces/IERC20.sol";

/**
 * @notice TokenPointList - MISO Point List that references a given `token` balance to return approvals.
 */
contract TokenList {
    /// @notice Token contract for point list reference - can be ERC20, ERC721 or other tokens with `balanceOf()` check.
    IERC20 public token;
    
    /// @notice Whether initialised or not.
    bool private initialised;

    constructor() public {
    }

    /**
     * @notice Initializes token point list with reference token.
     * @param _token Token address.
     */
    function initPointList(IERC20 _token) public {
        require(!initialised, "Already initialised");
        token = _token;
        initialised = true;
    }

    /**
     * @notice Checks if account address is in the list (has any tokens).
     * @param _account Account address.
     * @return bool True or False.
     */
    function isInList(address _account) public view returns (bool) {
        return token.balanceOf(_account) > 0;
    }

    /**
     * @notice Checks if account has more or equal points (tokens) as the number given.
     * @param _account Account address.
     * @param _amount Desired amount of points.
     * @return bool True or False.
     */
    function hasPoints(address _account, uint256 _amount) public view returns (bool) {
        return token.balanceOf(_account) >= _amount;
    }
}

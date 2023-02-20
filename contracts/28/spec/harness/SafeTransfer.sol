pragma solidity 0.6.12;

/**
 * Simplified version for easy of verification using Certora Prover.
 */
interface ISimpleERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface Receiver {
    function sendTo() external payable returns (bool);
}

contract SafeTransfer {
    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
   
    function _safeTokenPayment(
        address _token,
        address payable _to,
        uint256 _amount
    ) internal {
        if (address(_token) == ETH_ADDRESS) {
            _safeTransferETH(_to,_amount );
        } else {
            _safeTransfer(_token, _to, _amount);
        }
    }

    function _safeApprove(address token, address to, uint value) internal {
        ISimpleERC20(token).approve(to, value);
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 amount
    ) internal virtual {
        ISimpleERC20(token).transfer(to, amount);
    }

    function _safeTransferFrom(
        address token,
        address from,
        uint256 amount
    ) internal virtual {
        ISimpleERC20(token).transferFrom(from, address(this), amount);
    }

    function _safeTransferFrom(address token, address from, address to, uint value) internal {
        ISimpleERC20(token).transferFrom(from, to, value);
    }

    function _safeTransferETH(address to, uint value) internal {
        bool success = Receiver(to).sendTo{value:value}();
        require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
    }
}
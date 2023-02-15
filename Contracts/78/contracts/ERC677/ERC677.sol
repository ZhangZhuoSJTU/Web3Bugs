// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./ERC20Burnable.sol";
import "./IERC677Receiver.sol";

/*
All tokens in Limbo comply with the ERC677 standard. In addition they are ownable, alow burning
and can whitelist addresses with finite or infinite minting power
*/

contract ERC677 is ERC20Burnable, Ownable {
   
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {

    }

    /**
     * @dev transfer token to a contract address with additional data if the recipient is a contact.
     * @param _to The address to transfer to.
     * @param _value The amount to be transferred.
     * @param _data The extra data to be passed to the receiving contract.
     */
    function transferAndCall(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public returns (bool success) {
        super.transfer(_to, _value);
        _transfer(msg.sender, _to, _value);
        if (isContract(_to)) {
            contractFallback(_to, _value, _data);
        }
        return true;
    }

    function contractFallback(
        address _to,
        uint256 _value,
        bytes memory _data
    ) private {
        IERC677Receiver receiver = IERC677Receiver(_to);
        receiver.onTokenTransfer(msg.sender, _value, _data);
    }

    function isContract(address _addr) private view returns (bool hasCode) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }
}

// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ISafeOwnable.sol";

contract SafeOwnable is ISafeOwnable, Ownable {
  address private _nominee;

  modifier onlyNominee() {
    require(_msgSender() == _nominee, "msg.sender != nominee");
    _;
  }

  function transferOwnership(address _newNominee) public virtual override(ISafeOwnable, Ownable) onlyOwner {
    _setNominee(_newNominee);
  }

  function acceptOwnership() public virtual override onlyNominee {
    _transferOwnership(_nominee);
    _setNominee(address(0));
  }

  function renounceOwnership() public virtual override(ISafeOwnable, Ownable) onlyOwner {
    super.renounceOwnership();
    _setNominee(address(0));
  }

  function getNominee() public view virtual override returns (address) {
    return _nominee;
  }

  function _setNominee(address _newNominee) internal virtual {
    address _oldNominee = _nominee;
    _nominee = _newNominee;
    emit NomineeUpdate(_oldNominee, _newNominee);
  }
}

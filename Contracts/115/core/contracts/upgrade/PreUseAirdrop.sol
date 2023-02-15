// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../token/MIMO.sol";

import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "../liquidityMining/interfaces/IMIMODistributor.sol";

contract PreUseAirdrop {
  using SafeERC20 for IERC20;

  struct Payout {
    address recipient;
    uint256 amount;
  }

  Payout[] public payouts;

  IGovernanceAddressProvider public ga;
  IMIMODistributor public mimoDistributor;

  modifier onlyManager() {
    require(ga.controller().hasRole(ga.controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  constructor(IGovernanceAddressProvider _ga, IMIMODistributor _mimoDistributor) public {
    require(address(_ga) != address(0));
    require(address(_mimoDistributor) != address(0));

    ga = _ga;
    mimoDistributor = _mimoDistributor;

    payouts.push(Payout(0xBBd92c75C6f8B0FFe9e5BCb2e56a5e2600871a10, 271147720731494841509243076));
    payouts.push(Payout(0xcc8793d5eB95fAa707ea4155e09b2D3F44F33D1E, 210989402066696530434956148));
    payouts.push(Payout(0x185f19B43d818E10a31BE68f445ef8EDCB8AFB83, 22182938994846641176273320));
    payouts.push(Payout(0xDeD9F901D40A96C3Ee558E6885bcc7eFC51ad078, 13678603288816593264718593));
    payouts.push(Payout(0x0B3890bbF2553Bd098B45006aDD734d6Fbd6089E, 8416873402881706143143730));
    payouts.push(Payout(0x3F41a1CFd3C8B8d9c162dE0f42307a0095A6e5DF, 7159719590701445955473554));
    payouts.push(Payout(0x9115BaDce4873d58fa73b08279529A796550999a, 5632453715407980754075398));
    payouts.push(Payout(0x7BC8C0B66d7f0E2193ED11eeCAAfE7c1837b926f, 5414893264683531027764823));
    payouts.push(Payout(0xE7809aaaaa78E5a24E059889E561f598F3a4664c, 4712320945661497844704387));
    payouts.push(Payout(0xf4D3566729f257edD0D4bF365d8f0Db7bF56e1C6, 2997276841876706895655431));
    payouts.push(Payout(0x6Cf9AA65EBaD7028536E353393630e2340ca6049, 2734992792750385321760387));
    payouts.push(Payout(0x74386381Cb384CC0FBa0Ac669d22f515FfC147D2, 1366427847282177615773594));
    payouts.push(Payout(0x9144b150f28437E06Ab5FF5190365294eb1E87ec, 1363226310703652991601514));
    payouts.push(Payout(0x5691d53685e8e219329bD8ADf62b1A0A17df9D11, 702790464733701088417744));
    payouts.push(Payout(0x2B91B4f5223a0a1f5c7e1D139dDdD6B5B57C7A51, 678663683269882192090830));
    payouts.push(Payout(0x8ddBad507F3b20239516810C308Ba4f3BaeAf3a1, 635520835923336863138335));
    payouts.push(Payout(0xc3874A2C59b9779A75874Be6B5f0b578120A8701, 488385391000796390198744));
    payouts.push(Payout(0x0A22C160f7E57F2e7d88b2fa1B1B03571bdE6128, 297735186117080365383063));
    payouts.push(Payout(0x0a1aa2b65832fC0c71f2Ba488c84BeE0b9DB9692, 132688033756581498940995));
    payouts.push(Payout(0xAf7b7AbC272a3aE6dD6dA41b9832C758477a85f2, 130254714680714068405131));
    payouts.push(Payout(0xCDb17d9bCbA8E3bab6F68D59065efe784700Bee1, 71018627162763037055295));
    payouts.push(Payout(0x4Dec19003F9Bb01A4c0D089605618b2d76deE30d, 69655357581389001902516));
    payouts.push(Payout(0x31AacA1940C82130c2D4407E609e626E87A7BC18, 21678478730854029506989));
    payouts.push(Payout(0xBc77AB8dd8BAa6ddf0D0c241d31b2e30bcEC127d, 21573657481017931484432));
    payouts.push(Payout(0x1c25cDD83Cd7106C3dcB361230eC9E6930Aadd30, 14188368728356337446426));
    payouts.push(Payout(0xf1B78ed53fa2f9B8cFfa677Ad8023aCa92109d08, 13831474058511281838532));
    payouts.push(Payout(0xd27962455de27561e62345a516931F2392997263, 6968208393315527988941));
    payouts.push(Payout(0xD8A4411C623aD361E98bC9D98cA33eE1cF308Bca, 4476771187861728227997));
    payouts.push(Payout(0x1f06fA59809ee23Ee06e533D67D29C6564fC1964, 3358338614042115121460));
    payouts.push(Payout(0xeDccc1501e3BCC8b3973B9BE33f6Bd7072d28388, 2328788070517256560738));
    payouts.push(Payout(0xD738A884B2aFE625d372260E57e86E3eB4d5e1D7, 466769668474372743140));
    payouts.push(Payout(0x6942b1b6526Fa05035d47c09B419039c00Ef7545, 442736084997163005698));
  }

  function airdrop() public onlyManager {
    MIMO mimo = MIMO(address(ga.mimo()));
    for (uint256 i = 0; i < payouts.length; i++) {
      Payout memory payout = payouts[i];
      mimo.mint(payout.recipient, payout.amount);
    }
    require(mimoDistributor.mintableTokens() > 0);

    bytes32 MIMO_MINTER_ROLE = mimo.MIMO_MINTER_ROLE();
    ga.controller().renounceRole(MIMO_MINTER_ROLE, address(this));
  }
}

// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IClearingHouse, IMarginAccount, IAMM, IHubbleViewer } from "../Interfaces.sol";

contract Leaderboard {

    IClearingHouse public immutable clearingHouse;
    IMarginAccount public immutable marginAccount;
    IHubbleViewer  public immutable hubbleViewer;

    constructor(
        IHubbleViewer _hubbleViewer
    ) {
        clearingHouse = _hubbleViewer.clearingHouse();
        marginAccount = _hubbleViewer.marginAccount();
        hubbleViewer = _hubbleViewer;
    }

    function leaderboard(address[] calldata traders)
        external
        view
        returns(int[] memory makerMargins, int[] memory takerMargins)
    {
        uint numTraders = traders.length;
        makerMargins = new int[](numTraders);
        takerMargins = new int[](numTraders);
        uint l = clearingHouse.getAmmsLength();

        // local vars
        IAMM amm;
        address trader;
        uint dToken;
        int margin;
        int unrealizedPnl;
        int takerFundingPayment;
        int makerFundingPayment;
        bool isMaker;
        bool isTaker;

        // loop over traders and amms
        for (uint i = 0; i < numTraders; i++) {
            trader = traders[i];
            for (uint j = 0; j < l; j++) {
                amm = clearingHouse.amms(j);
                (takerFundingPayment,makerFundingPayment,,) = amm.getPendingFundingPayment(trader);

                // maker
                (,,dToken,,,,) = amm.makers(trader);
                if (dToken > 0) {
                    isMaker = true;
                    (,,unrealizedPnl) = hubbleViewer.getMakerPositionAndUnrealizedPnl(trader, j);
                    makerMargins[i] += (unrealizedPnl - makerFundingPayment);
                }

                // taker. using dToken to save a variable
                (dToken,unrealizedPnl) = amm.getTakerNotionalPositionAndUnrealizedPnl(trader);
                if (dToken > 0) {
                    isTaker = true;
                    takerMargins[i] += (unrealizedPnl - takerFundingPayment);
                }
            }

            margin = marginAccount.getSpotCollateralValue(trader);
            if (isMaker) {
                makerMargins[i] += margin;
                isMaker = false;
            }

            if (isTaker) {
                takerMargins[i] += margin;
                isTaker = false;
            }
        }
    }
}

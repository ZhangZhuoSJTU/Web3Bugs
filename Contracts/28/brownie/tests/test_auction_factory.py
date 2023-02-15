# import pytest
# from brownie import accounts, chain
# from brownie.convert import to_address
# from settings import *

# # reset the chain after every test case
# @pytest.fixture(autouse=True)
# def isolation(fn_isolation):
#     pass

# def test_create_auction(auction_factory, fixed_token, mintable_token):
#     token_supply = fixed_token.balanceOf(accounts[0])

#     assert token_supply != 0

#     fixed_token.approve(auction_factory, token_supply, {"from": accounts[0]})
    
#     start_date = chain.time() + 60 * 5 # current time + 5 minutes
#     end_date = start_date + 60 * 60 # start date + 60 minutes
#     start_price = 50000000000000000
#     minimum_price = 10000000000000000
#     wallet = accounts[0]

#     print("start_date", start_date)
#     print("end_date", end_date)

#     template_id = auction_factory.getTemplateId(fixed_token)
    
#     print("template_id:", template_id)

#     auction_factory.createAuction(
#             fixed_token, 
#             token_supply, 
#             start_date,
#             end_date, 
#             ETH_ADDRESS,
#             start_price,
#             minimum_price,
#             wallet,
#             template_id,
#             {"from": accounts[0]}
#         )

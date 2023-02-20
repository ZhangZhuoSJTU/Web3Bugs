import numpy as np
import matplotlib.pyplot as plt

# model parameters
class ModelParams:
    def __init__(self):
        self.D = 0.5 # base fee decay factor

        self.T = 1 # weighting for token price in trove issuance
        self.F = 0.3 # weighting for momentum in trove issuance

        self.lookback = 5 # Lookback parameter for ETH price momentum

        self.max_redemption_fraction = 1 # Maximum fraction of supply that can be redeemed in a timestep

# time series data 
class Data:
    def __init__(self):
        self.ETH_price = [500.0]
        self.momentum = [0.0]
        self.base_fee = [0.0]
        self.redeemed_amount = [0.0]
        self.token_price = [1.0]
        self.trove_issuance = [100.0]
        self.token_supply = [100.0]
        self.token_demand = 100.0
  
        
### Functions
def get_new_momentum(data, params, ETH_price):
    lookback = params.lookback
    if lookback == 0:
        return 0

    ETH_price_past = get_past_ETH_price(data, params)

    new_momentum = (ETH_price - ETH_price_past) /  ETH_price_past
    return new_momentum

def get_past_ETH_price(data, params):
    length = len(data.ETH_price)
    
    ETH_price_past = None
    if (params.lookback > length):
        ETH_price_past = data.ETH_price[0]
    else:
        ETH_price_past = data.ETH_price[length - params.lookback - 1]

    if ETH_price_past == 0:
        return 1
    return ETH_price_past

def get_new_redeemed_amount(data, params):
    max_redeemable  = data.token_supply[-1] * params.max_redemption_fraction 
    if max_redeemable == 0:
        return 0

    redeemed = (1 - data.token_price[-1] - data.base_fee[-1]) * data.token_supply[-1] 

    if redeemed < 0:
        return 0
    else:
        return min(redeemed, max_redeemable)
       

# Decay base fee correctly
def get_new_base_fee(data, redeemed_amount):
    if data.token_supply[-1] == 0:
        return 0

    base_fee = (data.base_fee[-1] + (redeemed_amount / (2 * data.token_supply[-1]))) *params.D
    return base_fee

# return the exogenous market demand for holding YETI tokens. Assume constant. Could be a function of:
# - Demand for a safe-haven $1-pegged asset  
# - Traders' demand for short-term liquidity
def get_token_demand():
    return 100.0

# compute price based on setting token supply = trove demand, and clearing the market
def get_new_token_price(data, params, redeemed_amount, momentum):
    T = params.T
    F = params.F

    factor =  1/T
    print(f'factor: {factor}')
    price = (((data.token_demand  - redeemed_amount) / (data.trove_issuance[-1])) - (F * momentum)) * factor 

    if price < 0:
        return 0
    else:
        return price
    return price

def get_new_token_demand(data, params, token_price, momentum):
    demand = data.token_demand
    if demand < 0:
        return 0
    else: 
        return demand

def get_new_trove_issuance(data, params, token_price, momentum ):
    trove_issuance = data.trove_issuance[-1] * (params.T*(token_price) + params.F*(momentum))

    if trove_issuance < 0:
        return 0
    else: 
        return trove_issuance

def get_new_token_supply(trove_issuance, redeemed):
    new_supply =  trove_issuance - redeemed

    if new_supply < 0:
        return 0
    else: 
        return new_supply

# Given Liquity's hard price ceiling of 1.10, 
# compute the excess trove issuance needed to maintain the price at 1.1, according to QTM.
def get_excess_issuance(token_price, token_supply):
    if token_price > 1.1:
        excess_issuance = token_supply * (token_price - 1.1)/1.1
        return excess_issuance
    else:
        return 0
 
### Various ETH price functions

def constant_ETH_price(last_price):
    return last_price

# ETH price generator is a random walk (normal dist.), with occasional large +ve and -ve jumps
def randomwalk_ETH_price(last_price):
    big_event = 0
    big_event_chance = np.random.normal()

    if (big_event_chance > 1.5) or (big_event_chance < -1.5):
        big_event = big_event_chance * 20
 
    new_price  = last_price + np.random.normal(scale=5) + big_event
    
    if new_price < 0: 
        return 0
    else:
        return new_price

def linear_increasing_ETH_price(last_price, gradient):
    return last_price + gradient

def oscillating_ETH_price(min, magnitude, i):
    return min + magnitude + magnitude*np.sin(i)

def linear_decreasing_ETH_price(start, gradient, i):
    val = (start - (gradient*i))
    if val <= 0:
        return 0
    return val

def one_over_i_ETH_price(scale, i):
    return scale/i

def quadratic_ETH_price(min, scale, i):
    return min + scale*(i**2)

def sublinear_ETH_price(last_price, steepness, i):
    return last_price + 1/(2*np.sqrt(steepness*(i+1)))
    
# ### Script

# Initialize model parameters and data timeseries
params = ModelParams() 
data = Data()

# Run the model
for i in range(1, 250):
    last_ETH_price =  data.ETH_price[-1]

    # update exogenous ETH price

    # ETH_price = last_ETH_price
    ETH_price = randomwalk_ETH_price(last_ETH_price)
    # ETH_price = oscillating_ETH_price(500, 100, i)
    # ETH_price = quadratic_ETH_price(500, 10, i)
    # ETH_price = linear_increasing_ETH_price(last_ETH_price, 3)
    # ETH_price = linear_decreasing_ETH_price(800, 1, i)
    # ETH_price = one_over_i_ETH_price(1000, i)
    # ETH_price = sublinear_ETH_price(last_ETH_price, 10, i)
    
    momentum = get_new_momentum(data, params, ETH_price)
    redeemed_amount = get_new_redeemed_amount(data, params)
    base_fee = get_new_base_fee(data, redeemed_amount)

    data.token_demand = get_token_demand()

    # clear the market
    token_price = get_new_token_price(data, params, redeemed_amount, momentum)
    token_demand = get_new_token_demand(data, params, token_price, momentum)
    trove_issuance = get_new_trove_issuance(data, params, token_price, momentum)
    token_supply = get_new_token_supply(trove_issuance, redeemed_amount)
    
    # if price > 1.1, correct it via the price ceiling and QTM
    excess_issuance = get_excess_issuance(token_price, token_supply)
    
    if token_price > 1.1:
        token_price = 1.1

    trove_issuance = trove_issuance + excess_issuance
    token_supply = get_new_token_supply(trove_issuance, 0)
    
    # Log all new values
    print(f'step: {i}')
    print(f'ETH price: {ETH_price}')
    print(f'momentum: {momentum}')
    print(f'redeemed amount: {redeemed_amount}')
    print(f'base fee: {base_fee}')
    print(f'token price: {token_price}')
    print(f'token demand: {token_demand}')
    print(f'trove_issuance: {trove_issuance}')
    print(f'token_supply: {token_supply}')

    # update all timeseries arrays
    data.ETH_price.append(ETH_price)
    data.momentum.append(momentum)
    data.redeemed_amount.append(redeemed_amount)
    data.base_fee.append(base_fee)
    data.token_price.append(token_price)
    data.token_demand = token_demand
    data.trove_issuance.append(trove_issuance)
    data.token_supply.append(token_supply)

### Graph the results

fig = plt.figure()
ax1 = fig.add_subplot(221)
ax1.set_title('Token price')
plt.ylim(0.0, 1.5)
plt.plot(data.token_price)

ax2 = fig.add_subplot(222)
ax2.set_title('Redeemed amount')
plt.ylim(0.0, 10)
plt.plot(data.redeemed_amount)

ax3 = fig.add_subplot(223)
ax3.set_title('ETH Price')
plt.ylim(0, 1000)
plt.plot(data.ETH_price)

ax4 = fig.add_subplot(224)
ax4.set_title('Base fee')
plt.ylim(0.0, 0.05)
plt.plot(data.base_fee)

# plt.plot(data.momentum)
# plt.plot(data.token_demand)

params_string = f'Parameters:  D={params.D}  T={params.T}  F={params.F}  L={params.lookback}  r_max={params.max_redemption_fraction}'
plt.figtext(0.5, 0.05, params_string, ha="center", fontsize=10)

plt.show()
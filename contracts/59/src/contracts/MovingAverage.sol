pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint.sol";

import "./Permissions.sol";


/// @title Moving Average
/// @author 0xScotch <scotch@malt.money>
/// @notice For tracking the average of a data stream over time
/// @dev Based on the cumulativeValue mechanism for TWAP in uniswapV2
contract MovingAverage is Initializable, Permissions {
  using FixedPoint for *;
  using SafeMath for uint256;

  struct Sample {
    uint64 timestamp;
    uint256 value;
    uint256 cumulativeValue;
    uint256 lastValue;
  }

  bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

  uint256 public sampleLength;
  uint256 public cumulativeValue;
  uint256 public sampleMemory;
  uint256 public defaultValue;

  uint64 public blockTimestampLast;

  uint256 private counter;
  uint256 private activeSamples;

  Sample[] private samples;

  event Update(uint256 value, uint256 cumulativeValue);

  function initialize(
    address _timelock,
    address initialAdmin,
    uint256 _sampleLength, // eg 5min represented as seconds
    uint256 _sampleMemory,
    address _updater,
    uint256 _defaultValue
  ) external initializer {
    require(_sampleMemory > 1, 'MA: SampleMemory > 1');

    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);
    _roleSetup(UPDATER_ROLE, _updater);
    _roleSetup(UPDATER_ROLE, initialAdmin);

    sampleLength = _sampleLength;
    sampleMemory = _sampleMemory;
    defaultValue = _defaultValue;

    for (uint i = 0; i < sampleMemory; i++) {
      samples.push();
    }
  }

  /*
   * PUBLIC VIEW METHODS
   */
  function getValue() public view returns (uint256) {
    if (activeSamples < 2) {
      return defaultValue;
    } else if (activeSamples == 2) {
      Sample storage currentSample = _getCurrentSample();
      return currentSample.value;
    } else if (activeSamples < sampleMemory) {
      // Subtract 2 because this is a lookback from the current sample.
      // activeSamples - 1 is the in progress sample. - 2 is the active sample
      // IE if there are 2 samples, we are on one and want to lookback 1.
      // If there are 3 samples, we are on one and want to lookback 2 etc
      uint256 lookback = (activeSamples - 2) * sampleLength;
      return getValueWithLookback(lookback);
    }
    Sample storage currentSample = _getCurrentSample();
    Sample storage firstSample = _getFirstSample();

    uint256 timeElapsed = currentSample.timestamp - firstSample.timestamp;
    uint256 sampleDiff = currentSample.cumulativeValue - firstSample.cumulativeValue;

    if (timeElapsed == 0) {
      return currentSample.value;
    } 

    FixedPoint.uq112x112 memory sampleAverage = FixedPoint.fraction(sampleDiff, timeElapsed);

    return sampleAverage.decode();
  }

  function getValueWithLookback(uint256 _lookbackTime) public view returns (uint256) {
    // _lookbackTime in is seconds
    uint256 lookbackSamples;
    if (_lookbackTime % sampleLength == 0) {
      // If it divides equally just divide down
      lookbackSamples = _lookbackTime / sampleLength;

      if (lookbackSamples == 0) {
        lookbackSamples = 1;
      }
    } else {
      // If it doesn't divide equally, divide and add 1.
      // Creates a Math.ceil() situation
      lookbackSamples = (_lookbackTime / sampleLength) + 1;
    }

    if (activeSamples < 2) {
      return defaultValue;
    } else if (activeSamples == 2) {
      Sample storage currentSample = _getCurrentSample();
      return currentSample.value;
    } else if (lookbackSamples >= activeSamples - 1) {
      // Looking for longer lookback than sampleMemory allows.
      // Just return the full memory average
      return getValue();
    }

    Sample storage currentSample = _getCurrentSample();
    Sample storage nthSample = _getNthSample(lookbackSamples);

    uint256 timeElapsed = currentSample.timestamp - nthSample.timestamp;
    uint256 sampleDiff = currentSample.cumulativeValue - nthSample.cumulativeValue;

    if (timeElapsed == 0) {
      return currentSample.value;
    } 

    FixedPoint.uq112x112 memory sampleAverage = FixedPoint.fraction(sampleDiff, timeElapsed);

    return sampleAverage.decode();
  }

  /*
   * MUTATION METHODS
   */
  function update(uint256 newValue)
    external 
    onlyRole(UPDATER_ROLE, "Must have updater privs")
  {
    /* 
     * This function only creates a sample at the end of the sample period.
     * The current sample period just updates the cumulativeValue but doesn't
     * Actually create a sample until the end of the period.
     * This is to protect against flashloan attacks that could try manipulate
     * the samples.
     */
    Sample storage liveSample = samples[_getIndexOfSample(counter)];
    uint64 blockTimestamp = uint64(block.timestamp % 2**64); 

    // Deal with first ever sample
    if (liveSample.timestamp == 0) {
      liveSample.timestamp = uint64(block.timestamp);
      liveSample.value = newValue;
      liveSample.lastValue = newValue;
      liveSample.cumulativeValue = newValue;

      cumulativeValue = newValue;
      blockTimestampLast = blockTimestamp;

      activeSamples = activeSamples + 1;
      return;
    }

    uint64 timeElapsed = blockTimestamp - liveSample.timestamp;

    if (timeElapsed < sampleLength) {
      cumulativeValue += liveSample.lastValue.mul(blockTimestamp - blockTimestampLast);
      liveSample.cumulativeValue = cumulativeValue;
      liveSample.lastValue = newValue;

      blockTimestampLast = blockTimestamp;
      return;
    } else if (timeElapsed >= (sampleLength - 1) * sampleMemory) {
      // More than total sample memory has elapsed. Reset with new values
      uint256 addition = liveSample.lastValue.mul(sampleLength);

      uint256 currentCumulative = cumulativeValue;
      uint64 currentTimestamp = blockTimestamp - uint64(sampleLength * sampleMemory);

      uint256 tempCount = counter;
      for (uint256 i = 0; i < sampleMemory; i++ ) {
        tempCount += 1;
        liveSample = samples[_getIndexOfSample(tempCount)];
        liveSample.timestamp = currentTimestamp;
        liveSample.cumulativeValue = currentCumulative;

        currentCumulative += addition;
        currentTimestamp += uint64(sampleLength);
      }

      // Reset the adding of 'addition' in the final loop
      currentCumulative = liveSample.cumulativeValue;

      tempCount += 1;
      liveSample = samples[_getIndexOfSample(tempCount)];
      liveSample.timestamp = blockTimestamp;
      // Only the most recent values really matter here
      liveSample.value = newValue;
      liveSample.lastValue = newValue;
      liveSample.cumulativeValue = currentCumulative;

      counter = tempCount;
      cumulativeValue = currentCumulative;
      blockTimestampLast = blockTimestamp;
      activeSamples = sampleMemory;
      return;
    }

    uint64 nextSampleTime = liveSample.timestamp + uint64(sampleLength);

    // Finish out the current sample
    cumulativeValue += liveSample.lastValue.mul(nextSampleTime - blockTimestampLast);
    liveSample.cumulativeValue = cumulativeValue;

    liveSample = _createNewSample(nextSampleTime, cumulativeValue);
    timeElapsed = timeElapsed - uint64(sampleLength);

    uint256 elapsedSamples = timeElapsed / sampleLength;

    for (uint256 i = 1; i <= elapsedSamples; i = i + 1) {
      // update
      cumulativeValue += liveSample.lastValue.mul(sampleLength);
      liveSample.cumulativeValue = cumulativeValue;

      uint64 sampleTime = liveSample.timestamp + uint64(sampleLength);

      liveSample = _createNewSample(sampleTime, cumulativeValue);
    }

    cumulativeValue += liveSample.lastValue.mul(timeElapsed % sampleLength);

    // Now set the value of the current sample to the new value
    liveSample.value = newValue;
    liveSample.lastValue = newValue;
    liveSample.cumulativeValue = cumulativeValue;

    blockTimestampLast = blockTimestamp;

    emit Update(newValue, cumulativeValue);
  }

  function updateCumulative(uint256 _cumulative)
    external 
    onlyRole(UPDATER_ROLE, "Must have updater privs")
  {
    require(_cumulative >= cumulativeValue, "Cumulative value can only go up");

    Sample storage liveSample = samples[_getIndexOfSample(counter)];
    uint64 blockTimestamp = uint64(block.timestamp % 2**64); 

    if (liveSample.timestamp == 0) {
      cumulativeValue = _cumulative;
      blockTimestampLast = blockTimestamp;

      liveSample.timestamp = blockTimestamp;
      liveSample.cumulativeValue = _cumulative;
      liveSample.value = _cumulative;
      liveSample.lastValue = _cumulative;

      activeSamples = activeSamples + 1;
      return;
    }

    uint64 timeElapsed = blockTimestamp - liveSample.timestamp;
    uint64 timeElapsedSinceUpdate = blockTimestamp - blockTimestampLast;
    uint256 newLastValue = (_cumulative - cumulativeValue).div(timeElapsedSinceUpdate);

    if (timeElapsed < sampleLength) {
      // The current sample isn't over. Just update
      liveSample.cumulativeValue = _cumulative;
      liveSample.value = newLastValue;
      liveSample.lastValue = newLastValue;

      blockTimestampLast = blockTimestamp;
      cumulativeValue = _cumulative;
      return;
    } else if (timeElapsed >= sampleLength * (sampleMemory - 1)) {
      // More than total sample memory has elapsed. Reset with new values

      uint256 addition = newLastValue.mul(sampleLength);

      uint256 currentCumulative = _cumulative.sub(addition * (sampleMemory - 1));
      uint64 currentTimestamp = blockTimestamp - uint64(sampleLength * (sampleMemory));

      uint256 tempCount = counter;
      for (uint256 i = 0; i < sampleMemory; i++ ) {
        tempCount += 1;
        liveSample = samples[_getIndexOfSample(tempCount)];
        liveSample.timestamp = currentTimestamp;
        liveSample.cumulativeValue = currentCumulative;

        currentCumulative += addition;
        currentTimestamp += uint64(sampleLength);
      }

      tempCount += 1;
      liveSample = samples[_getIndexOfSample(tempCount)];
      liveSample.timestamp = blockTimestamp;
      // Only the most recent values really matter here
      liveSample.value = newLastValue;
      liveSample.lastValue = newLastValue;
      liveSample.cumulativeValue = _cumulative;

      counter = tempCount;
      cumulativeValue = _cumulative;
      blockTimestampLast = blockTimestamp;
      activeSamples = sampleMemory;
      return;
    }

    // One or more sample boundaries have been crossed.
    uint64 nextSampleTime = liveSample.timestamp + uint64(sampleLength);
    // Finish out the current sample
    cumulativeValue += newLastValue.mul(nextSampleTime - blockTimestampLast);
    liveSample.cumulativeValue = cumulativeValue;
    liveSample.lastValue = newLastValue;

    liveSample = _createNewSample(nextSampleTime, cumulativeValue);
    timeElapsed = timeElapsed - uint64(sampleLength);

    uint256 elapsedSamples = timeElapsed / sampleLength;

    for (uint256 i = 1; i <= elapsedSamples; i = i + 1) {
      // update
      cumulativeValue += newLastValue.mul(sampleLength);
      liveSample.cumulativeValue = cumulativeValue;

      uint64 sampleTime = liveSample.timestamp + uint64(sampleLength);

      liveSample = _createNewSample(sampleTime, cumulativeValue);
    }

    liveSample.value = newLastValue;
    liveSample.lastValue = newLastValue;
    liveSample.cumulativeValue = _cumulative;

    cumulativeValue = _cumulative;
    blockTimestampLast = blockTimestamp;

    emit Update(newLastValue, cumulativeValue);
  }

  /*
   * INTERNAL VIEW METHODS
   */
  function _getIndexOfSample(uint _count) internal view returns (uint32 index) {
    return uint32(_count % sampleMemory);
  }

  function _getCurrentSample() private view returns (Sample storage currentSample) {
    // Active sample is always counter - 1. Counter is the in progress sample
    uint32 currentSampleIndex = _getIndexOfSample(counter - 1);
    currentSample = samples[currentSampleIndex];
  }

  function _getFirstSample() private view returns (Sample storage firstSample) {
    uint32 sampleIndex = _getIndexOfSample(counter);
    // no overflow issue. if sampleIndex + 1 overflows, result is still zero.
    uint32 firstSampleIndex = uint32((sampleIndex + 1) % sampleMemory);
    firstSample = samples[firstSampleIndex];
  }

  function _getNthSample(uint256 n) private view returns (Sample storage sample) {
    require(n < activeSamples - 1, "Not enough samples");
    uint32 sampleIndex = _getIndexOfSample(counter - 1 - n);
    sample = samples[sampleIndex];
  }

  /*
   * INTERNAL METHODS
   */
  function _createNewSample(uint64 sampleTime, uint256 cumulativeValue)
    internal
    returns(Sample storage liveSample)
  {
    Sample storage oldSample = samples[_getIndexOfSample(counter - 1)];
    Sample storage previousSample = samples[_getIndexOfSample(counter)];

    if (oldSample.timestamp > 0 && activeSamples > 1) {
      previousSample.value = (previousSample.cumulativeValue - oldSample.cumulativeValue).div(sampleLength);
    }

    counter += 1;
    liveSample = samples[_getIndexOfSample(counter)];
    liveSample.timestamp = sampleTime;
    liveSample.cumulativeValue = cumulativeValue;
    liveSample.value = previousSample.value;
    liveSample.lastValue = previousSample.lastValue;

    if (activeSamples < sampleMemory) {
      // Active samples is how we keep track of how many real samples we have vs default 0 values
      // This is useful for providing data even when full sample set isn't populated yet
      activeSamples = activeSamples + 1;
    }

    blockTimestampLast = sampleTime;
  }

  /*
   * PRIVILEDGED METHODS
   */
  function setSampleLength(uint256 _sampleLength)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_sampleLength > 0, "Cannot have 0 second sample length");
    sampleLength = _sampleLength;
  }

  function resetLiveSampleTime()
    external
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    Sample storage liveSample = samples[_getIndexOfSample(counter)];
    liveSample.timestamp = uint64(block.timestamp % 2**64); 
  }

  function setSampleMemory(uint256 _sampleMemory)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_sampleMemory > 0, "Cannot have sample memroy of 0");

    if (_sampleMemory > sampleMemory) {
      for (uint i = sampleMemory; i < _sampleMemory; i++) {
        samples.push();
      }
      counter = counter % _sampleMemory;
    } else {
      activeSamples = _sampleMemory;

      // TODO handle when list is smaller Tue 21 Sep 2021 22:29:41 BST
    }

    sampleMemory = _sampleMemory;
  }
}

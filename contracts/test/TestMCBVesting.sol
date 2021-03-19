pragma solidity 0.7.4;

import "../MCBVesting.sol";

contract TestMCBVesting is MCBVesting {
    address internal _mockMCBToken;
    uint256 internal _mockTimestamp;

    constructor(address mcbToken_, uint256 beginTime_) MCBVesting(beginTime_) {
        _mockMCBToken = mcbToken_;
    }

    function _mcbToken() internal view virtual override returns (address) {
        return _mockMCBToken;
    }

    function setTimestamp(uint256 timestamp) public {
        _mockTimestamp = timestamp;
    }

    function _blockTimestamp() internal view virtual override returns (uint256) {
        return _mockTimestamp;
    }
}

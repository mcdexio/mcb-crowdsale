// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "../MCBVestingUpgradeable.sol";

contract TestMCBVesting is MCBVestingUpgradeable {
    address internal _mockMCBToken;
    uint256 internal _mockTimestamp;

    constructor(
        address mcbToken_,
        uint256 beginTime_,
        address[] memory beneficiaries_,
        uint96[] memory amounts_
    ) {
        _mockMCBToken = mcbToken_;
        require(beneficiaries_.length == amounts_.length, "length of parameters are not match");

        __ReentrancyGuard_init();
        __Ownable_init();

        beginTime = beginTime_;

        uint96 totalCommitment_;
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            (address beneficiary, uint96 amount) = (beneficiaries_[i], amounts_[i]);
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(amount != 0, "amount cannot be zero");
            accounts[beneficiary] = VestingAccount({
                commitment: amount,
                cumulativeRef: 0,
                claimed: 0
            });
            totalCommitment_ = _add96(totalCommitment_, _safe96(amount));
        }
        totalCommitment = totalCommitment_;
        emit AddBeneficiaries(beneficiaries_, amounts_);
    }

    function _mcbToken() internal view virtual override returns (IERC20Upgradeable) {
        return IERC20Upgradeable(_mockMCBToken);
    }

    function setTimestamp(uint256 timestamp) public {
        _mockTimestamp = timestamp;
    }

    function _blockTimestamp() internal view virtual override returns (uint256) {
        return _mockTimestamp;
    }
}

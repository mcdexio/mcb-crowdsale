// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./libraries/SafeMathExt.sol";

contract MCBVesting is ReentrancyGuard, Ownable {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeMathExt for uint256;
    using SafeERC20 for IERC20;

    address public constant MCDEX_FOUNDATION_ADDRESS = 0x38ca50c6E3391A5bf73c2504bd9Cd9c0b9D89053;
    address public constant MCB_TOKEN_ADDRESS = 0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42;

    uint256 public beginTime;
    uint256 public totalCommitment;
    uint256 public lastRemainingBalance;
    uint256 public cumulativeBalance;

    mapping(address => uint256) public commitments;
    mapping(address => uint256) public claimedCumulativeBalances;
    mapping(address => uint256) public claimedBalances;

    event AddBeneficiaries(address[] beneficiaries, uint256[] amounts);
    event Claim(address indexed account, uint256 amount);
    event UpdateBeneficiary(address indexed oldBeneficiary, address indexed newBeneficiary);

    constructor(
        uint256 beginTime_,
        address[] memory beneficiaries_,
        uint256[] memory amounts_
    ) Ownable() {
        require(beneficiaries_.length == amounts_.length, "length of parameters are not match");
        beginTime = beginTime_;
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            address beneficiary = beneficiaries_[i];
            uint256 amount = amounts_[i];
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(amount != 0, "amount cannot be zero");
            commitments[beneficiary] = amount;
            totalCommitment = totalCommitment.add(amount);
        }
        emit AddBeneficiaries(beneficiaries_, amounts_);
    }

    function updateBeneficiary(address oldBeneficiary, address newBeneficiary) external onlyOwner {
        require(newBeneficiary != address(0), "new beneficiary is zero address");
        require(commitments[oldBeneficiary] > 0, "old beneficiary has no commitments");
        require(commitments[newBeneficiary] == 0, "new beneficiary must has no commitments");
        require(
            commitments[oldBeneficiary] != claimedBalances[oldBeneficiary],
            "old beneficiary has no more commitments to claim"
        );

        commitments[newBeneficiary] = commitments[oldBeneficiary];
        claimedBalances[newBeneficiary] = claimedBalances[oldBeneficiary];
        claimedCumulativeBalances[newBeneficiary] = claimedCumulativeBalances[oldBeneficiary];

        commitments[oldBeneficiary] = 0;
        claimedCumulativeBalances[oldBeneficiary] = 0;
        claimedBalances[oldBeneficiary] = 0;
        emit UpdateBeneficiary(oldBeneficiary, newBeneficiary);
    }

    /**
     * @notice  The share of commitment amount in total amount. The value will not change during vesting.
     */
    function shareOf(address account) public view returns (uint256) {
        return commitments[account].wdivFloor(totalCommitment);
    }

    /**
     * @notice  The amount can be claimed for an account.
     */
    function claimableToken(address account) external view returns (uint256) {
        if (_blockTimestamp() < beginTime || claimedBalances[account] >= commitments[account]) {
            return 0;
        }
        uint256 incrementalBalance = _mcbToken().balanceOf(address(this)).sub(lastRemainingBalance);
        uint256 currentCumulativeBalance = cumulativeBalance.add(incrementalBalance);
        if (currentCumulativeBalance <= claimedCumulativeBalances[account]) {
            return 0;
        }
        uint256 unclaimedAmount =
            currentCumulativeBalance.sub(claimedCumulativeBalances[account]).wmul(shareOf(account));
        uint256 unclaimedCommitment = commitments[account].sub(claimedBalances[account]);
        return unclaimedAmount.min(unclaimedCommitment);
    }

    /**
     * @notice  Claim token.
     */
    function claim(address account) external nonReentrant {
        require(_blockTimestamp() >= beginTime, "claim is not active now");
        require(commitments[account] > 0, "no token to claim");
        require(claimedBalances[account] < commitments[account], "no more token to claim");

        uint256 incrementalBalance = _mcbToken().balanceOf(address(this)).sub(lastRemainingBalance);
        cumulativeBalance = cumulativeBalance.add(incrementalBalance);

        require(cumulativeBalance > claimedCumulativeBalances[account], "no token to claim");
        uint256 claimableAmount =
            cumulativeBalance.sub(claimedCumulativeBalances[account]).wmul(shareOf(account));
        require(claimableAmount > 0, "no token to claim");
        _mcbToken().safeTransfer(account, claimableAmount);

        claimedCumulativeBalances[account] = cumulativeBalance;
        claimedBalances[account] = claimedBalances[account].add(claimableAmount);

        lastRemainingBalance = _mcbToken().balanceOf(address(this));

        emit Claim(account, claimableAmount);
    }

    function _mcbToken() internal view virtual returns (IERC20) {
        return IERC20(MCB_TOKEN_ADDRESS);
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}

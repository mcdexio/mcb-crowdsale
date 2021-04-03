// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./libraries/SafeMathExt.sol";

contract MCBCrowdsale is Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeMathExt for uint256;
    using SafeERC20 for IERC20;

    address public constant MCB_TOKEN_ADDRESS = 0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42;
    address public constant USDC_TOKEN_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant MCDEX_FOUNDATION_ADDRESS = 0x38ca50c6E3391A5bf73c2504bd9Cd9c0b9D89053;

    uint256 public constant MAX_SUPPLY = 100000 * 1e18;
    uint256 public constant USDC_DEPOSIT_RATE = 10 * 1e6;
    uint256 public constant MCB_DEPOSIT_RATE = 4 * 1e18;

    bool public isEmergency;
    uint256 public beginTime;
    uint256 public endTime;
    uint256 public unlockTime;

    uint256 internal _totalCommitment;
    mapping(address => uint256) internal _commitments;
    mapping(address => bool) internal _settlementFlags;

    event Purchase(uint256 amount, uint256 depositedMCB, uint256 depositUSDC);
    event Settle(address indexed account, uint256 settledAmount, uint256 refundUSDC);
    event ForwardFunds(uint256 claimableUSDCAmount);
    event SetEmergency();
    event EmergencySettle(address indexed account, uint256 mcbAmount, uint256 usdcAmount);
    event EmergencyForwardFunds(uint256 mcbAmount, uint256 usdcAmount);

    constructor(
        uint256 beginTime_,
        uint256 endTime_,
        uint256 lockPeriod_
    ) Ownable() ReentrancyGuard() {
        require(beginTime_ <= endTime_, "start time cannot be later than end time");
        require(lockPeriod_ <= 86400 * 7, "lock period too long");

        beginTime = beginTime_;
        endTime = endTime_;
        unlockTime = endTime_.add(lockPeriod_);
    }

    /**
     * @notice  Turn contract to emergency state. Make emergencySettle available.
     *          Only can be called before unlock.
     */
    function setEmergency() external onlyOwner {
        require(_blockTimestamp() < unlockTime, "can only set emergency before unlock time");
        require(!isEmergency, "already in emergency state");
        isEmergency = true;
        emit SetEmergency();
    }

    /**
     * @notice  A boolean to indicate if currently commit interface is available.
     */
    function isCommitable() public view returns (bool) {
        uint256 currentTimestamp = _blockTimestamp();
        return currentTimestamp >= beginTime && currentTimestamp < endTime;
    }

    /**
     * @notice  A boolean to indicate if currently settle interface is available.
     */
    function isSettleable() public view returns (bool) {
        uint256 currentTimestamp = _blockTimestamp();
        return currentTimestamp >= unlockTime;
    }

    /**
     * @notice  A boolean to indicate if the given account is already settled.
     */
    function isAccountSettled(address account) public view returns (bool) {
        return _settlementFlags[account];
    }

    /**
     * @notice  Total raw amount of users commited. This amount may exceed MAX_SUPPLY.
     */
    function totalCommitment() external view returns (uint256) {
        return _totalCommitment;
    }

    /**
     * @notice  Total amount of MCB commited by user. It should not exceed MAX_SUPPLY.
     */
    function totalCommitedSupply() public view returns (uint256) {
        return _totalCommitment.min(MAX_SUPPLY);
    }

    /**
     * @notice  The percentage of token sold and total supply.
     */
    function commitmentRate() public view returns (uint256) {
        return _totalCommitment <= MAX_SUPPLY ? 1e18 : _totalCommitment.wdivFloor(MAX_SUPPLY);
    }

    /**
     * @notice  The raw amount of an account commited.
     */
    function commitmentOf(address account) external view returns (uint256) {
        return _commitments[account];
    }

    /**
     * @notice  The share of amount in total commited amount for an account.
     */
    function shareOf(address account) external view returns (uint256) {
        return _commitments[account].wdivFloor(commitmentRate());
    }

    /**
     * @notice  User is able to commit 1 MCB token with 4x MCB and 10x USDC.
     *          All MCB deposited and refund USDC (if any) will be sent back to user
     *          after an unlock period.
     */
    function commit(uint256 amount) external {
        require(!isEmergency, "commit is not available in emergency state");
        require(isCommitable(), "commit is not active now");
        require(amount > 0, "amount to buy cannot be zero");

        uint256 depositMCB = amount.wmul(MCB_DEPOSIT_RATE);
        uint256 depositUSDC = amount.wmul(USDC_DEPOSIT_RATE);
        // transfer
        _mcbToken().safeTransferFrom(msg.sender, address(this), depositMCB);
        _usdcToken().safeTransferFrom(msg.sender, address(this), depositUSDC);

        _commitments[msg.sender] = _commitments[msg.sender].add(amount);
        _totalCommitment = _totalCommitment.add(amount);

        emit Purchase(amount, depositMCB, depositUSDC);
    }

    /**
     * @notice  User is able to get usdc refund if the total subscriptions exceeds target supply.
     *
     * @param   account The address to settle, to which the refund and deposited MCB will be transferred.
     */
    function settle(address account) external nonReentrant {
        require(!isEmergency, "settle is not available in emergency state");
        require(isSettleable(), "settle is not active now");
        require(!isAccountSettled(account), "account has alreay settled");

        uint256 settledAmount = _commitments[account].wdivFloor(commitmentRate());
        uint256 depositMCB = _commitments[account].wmul(MCB_DEPOSIT_RATE);
        uint256 depositUSDC = _commitments[account].wmul(USDC_DEPOSIT_RATE);
        uint256 costUSDC = depositUSDC.wdivCeil(commitmentRate());
        uint256 refundUSDC = 0;
        // usdc refund
        _settlementFlags[account] = true;
        if (depositUSDC > costUSDC) {
            refundUSDC = depositUSDC.sub(costUSDC);
            _usdcToken().safeTransfer(account, refundUSDC);
        }
        _mcbToken().safeTransfer(account, depositMCB);

        emit Settle(account, settledAmount, refundUSDC);
    }

    /**
     * @notice  Forword funds up to sale target to a preset address.
     */
    function forwardFunds() external nonReentrant onlyOwner {
        require(!isEmergency, "forward is not available in emergency state");
        require(isSettleable(), "forward is not active now");
        require(!isAccountSettled(address(this)), "funds has alreay been forwarded");

        _settlementFlags[address(this)] = true;
        uint256 fundUSDC = totalCommitedSupply().wmul(USDC_DEPOSIT_RATE);
        _usdcToken().safeTransfer(_mcdexFoundation(), fundUSDC);

        emit ForwardFunds(fundUSDC);
    }

    /**
     * @notice  In emergency state, user is able to withdraw all deposited assets back directly.
     *
     * @param   account The address to settle, to which the deposited assets will be transferred.
     */
    function emergencySettle(address account) external nonReentrant {
        require(isEmergency, "emergency settle is only available in emergency state");
        require(!isAccountSettled(account), "account has alreay settled");

        uint256 depositedMCB = _commitments[account].wmul(MCB_DEPOSIT_RATE);
        uint256 depositedUSDC = _commitments[account].wmul(USDC_DEPOSIT_RATE);

        _totalCommitment = _totalCommitment.sub(_commitments[account]);
        _commitments[account] = 0;
        _settlementFlags[account] = true;

        _mcbToken().safeTransfer(account, depositedMCB);
        _usdcToken().safeTransfer(account, depositedUSDC);

        emit EmergencySettle(account, depositedMCB, depositedUSDC);
    }

    function _mcbToken() internal view virtual returns (IERC20) {
        return IERC20(MCB_TOKEN_ADDRESS);
    }

    function _usdcToken() internal view virtual returns (IERC20) {
        return IERC20(USDC_TOKEN_ADDRESS);
    }

    function _mcdexFoundation() internal view virtual returns (address) {
        return MCDEX_FOUNDATION_ADDRESS;
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}

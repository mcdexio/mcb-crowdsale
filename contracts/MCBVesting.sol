// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MCBVesting is ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public constant MCB_TOKEN_ADDRESS = 0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42;

    struct TokenBalance {
        uint96 remaining;
        uint96 cumulative;
    }

    struct VestingAccount {
        uint96 claimed;
        uint96 cumulativeRef;
        uint96 commitment;
    }

    uint96 public totalCommitment;
    uint256 public immutable beginTime;

    TokenBalance public tokenBalance;
    mapping(address => VestingAccount) public accounts;

    event Claim(address indexed beneficiary, uint96 amount);
    event AddBeneficiaries(address[] beneficiaries, uint96[] amounts);
    event UpdateBeneficiary(address indexed oldBeneficiary, address indexed newBeneficiary);

    constructor(
        uint256 beginTime_,
        address[] memory beneficiaries_,
        uint96[] memory amounts_
    ) Ownable() {
        require(beneficiaries_.length == amounts_.length, "length of parameters are not match");
        beginTime = beginTime_;

        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            (address beneficiary, uint96 amount) = (beneficiaries_[i], amounts_[i]);
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(amount != 0, "amount cannot be zero");
            accounts[beneficiary] = VestingAccount({
                commitment: amount,
                cumulativeRef: 0,
                claimed: 0
            });
            totalCommitment = _add96(totalCommitment, _safe96(amount));
        }
        emit AddBeneficiaries(beneficiaries_, amounts_);
    }

    /**
     * @notice  Update beneficiary address and claiming status.
     */
    function updateBeneficiary(address oldBeneficiary, address newBeneficiary) external onlyOwner {
        require(newBeneficiary != address(0), "new beneficiary is zero address");
        VestingAccount storage oldAccount = accounts[oldBeneficiary];
        VestingAccount storage newAccount = accounts[newBeneficiary];
        require(oldAccount.commitment > 0, "old beneficiary has no commitments");
        require(newAccount.commitment == 0, "new beneficiary must has no commitments");
        require(
            oldAccount.claimed != oldAccount.commitment,
            "old beneficiary has no more token to claim"
        );

        newAccount.commitment = oldAccount.commitment;
        newAccount.cumulativeRef = oldAccount.cumulativeRef;
        newAccount.claimed = oldAccount.claimed;
        oldAccount.commitment = 0;
        oldAccount.cumulativeRef = 0;
        oldAccount.claimed = 0;

        emit UpdateBeneficiary(oldBeneficiary, newBeneficiary);
    }

    function commitments(address beneficiary) public view returns (uint96) {
        return accounts[beneficiary].commitment;
    }

    function claimedBalances(address beneficiary) public view returns (uint96) {
        return accounts[beneficiary].claimed;
    }

    /**
     * @notice  The share of commitment amount in total amount. The value will not change during vesting.
     */
    function shareOf(address beneficiary) public view returns (uint96) {
        return _wdivFloor96(accounts[beneficiary].commitment, totalCommitment);
    }

    /**
     * @notice  The amount can be claimed for an account.
     */
    function claimableToken(address beneficiary) external view returns (uint256) {
        (uint96 claimable, ) = _claimableToken(beneficiary);
        return claimable;
    }

    /**
     * @notice  Claim token.
     */
    function claim(address beneficiary) external nonReentrant {
        require(_blockTimestamp() >= beginTime, "claim is not active now");
        (uint96 claimable, uint96 cumulativeReceived) = _claimableToken(beneficiary);
        require(claimable > 0, "no token to claim");
        // claim for beneficiary
        VestingAccount storage account = accounts[beneficiary];
        account.claimed = _add96(account.claimed, claimable);
        account.cumulativeRef = cumulativeReceived;
        _mcbToken().safeTransfer(beneficiary, claimable);
        // udpate received token tokenBalance
        tokenBalance.remaining = _safe96(_mcbBalance());
        tokenBalance.cumulative = cumulativeReceived;

        emit Claim(beneficiary, claimable);
    }

    function _claimableToken(address beneficiary)
        internal
        view
        returns (uint96 claimable, uint96 cumulativeReceived)
    {
        // get received token tokenBalance
        uint96 incrementalReceived = _sub96(_safe96(_mcbBalance()), tokenBalance.remaining);
        cumulativeReceived = _add96(tokenBalance.cumulative, incrementalReceived);
        // calc claimable of beneficiary
        VestingAccount storage account = accounts[beneficiary];
        uint96 maxUnclaimed = _sub96(account.commitment, account.claimed);
        if (maxUnclaimed != 0 && cumulativeReceived > account.cumulativeRef) {
            claimable = _sub96(cumulativeReceived, account.cumulativeRef);
            claimable = _wmul96(claimable, shareOf(beneficiary));
            claimable = claimable < maxUnclaimed ? claimable : maxUnclaimed;
        } else {
            claimable = 0;
        }
    }

    function _mcbBalance() internal view virtual returns (uint96) {
        return _safe96(_mcbToken().balanceOf(address(this)));
    }

    function _mcbToken() internal view virtual returns (IERC20) {
        return IERC20(MCB_TOKEN_ADDRESS);
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    // math libs
    function _add96(uint96 a, uint96 b) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, "addition overflow");
        return c;
    }

    function _sub96(uint96 a, uint96 b) internal pure returns (uint96) {
        require(b <= a, "subtraction overflow");
        return a - b;
    }

    function _safe96(uint256 n) internal pure returns (uint96) {
        return _safe96(n, "conversion to uint96 overflow");
    }

    function _safe96(uint256 n, string memory errorMessage) internal pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    function _wmul96(uint256 x, uint256 y) internal pure returns (uint96 z) {
        z = _safe96(x.mul(y) / 1e18, "multiplication overflow");
    }

    function _wdivFloor96(uint256 x, uint256 y) internal pure returns (uint96 z) {
        z = _safe96(x.mul(1e18).div(y), "division overflow");
    }
}

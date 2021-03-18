pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./libraries/SafeMathExt.sol";

contract MCBVesting {
    using SafeMath for uint256;
    using SafeMathExt for uint256;
    using SafeERC20 for IERC20;

    address public constant MCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant VMCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;

    uint256 public beginTime;
    uint256 public totalQuota;
    uint256 public lastMCBBalance;
    uint256 public cumulativeMCBBalance;

    mapping(address => uint256) public quotas;
    mapping(address => uint256) public claimedQuotas;
    mapping(address => uint256) public mcbBalanceMark;

    event AddBeneficiaries(address[] beneficiaries, uint256[] quotas);
    event Claim(address indexed account, uint256 amount);

    constructor(uint256 beginTime_) {
        beginTime = beginTime_;
    }

    function addQuotas(address[] calldata beneficiaries_, uint256[] calldata quotas_) external {
        require(beneficiaries_.length == quotas_.length, "length of parameters are not match");
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            address beneficiary = beneficiaries_[i];
            uint256 quota = quotas_[i];
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(quota != 0, "quota cannot be zero");
            quotas[beneficiary] = quota;
            totalQuota = totalQuota.add(quota);
        }
        emit AddBeneficiaries(beneficiaries_, quotas_);
    }

    function shareOf(address account) public view returns (uint256) {
        return quotas[account].div(totalQuota);
    }

    function claimableMCBToken(address account) public view returns (uint256) {
        uint256 incremental =
            IERC20(MCB_TOKEN_ADDRESS).balanceOf(address(this)).sub(lastMCBBalance);
        return incremental.mul(shareOf(account));
    }

    function claimMCBToken(address account) public {
        uint256 incremental =
            IERC20(MCB_TOKEN_ADDRESS).balanceOf(address(this)).sub(lastMCBBalance);
        cumulativeMCBBalance = cumulativeMCBBalance.add(incremental);
        uint256 claimableAmount = incremental.mul(shareOf(account));
        mcbBalanceMark[account] = cumulativeMCBBalance;
        IERC20(MCB_TOKEN_ADDRESS).safeTransfer(account, claimableAmount);
        lastMCBBalance = IERC20(MCB_TOKEN_ADDRESS).balanceOf(address(this));
        emit Claim(account, claimableAmount);
    }
}

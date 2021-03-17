pragma solidity 0.7.4;

contract MCBVesting {
    address public constant MCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant VMCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;

    mapping(address => uint256) public quotas;

    event AddBeneficiaries(address[] beneficiaries, uint256[] quotas);

    constructor() {}

    function addQuotas(address[] calldata beneficiaries_, uint256[] calldata quotas_) external {
        require(beneficiaries.length == quotas.length, "length of parameters are not match");
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            address beneficiary = beneficiaries[i];
            uint256 quota = quotas_[i];
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(quota != 0, "quota cannot be zero");
            quotas[beneficiary] = quota;
        }
        emit AddBeneficiaries(beneficiaries_, quota_);
    }

    function claimableMCB(address account) public view returns (uint256) {}

    function claimMCB() public {}
}

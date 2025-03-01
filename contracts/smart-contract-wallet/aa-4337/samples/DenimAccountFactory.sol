// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./DenimAccount.sol";

/**
 * A sample factory contract for Wallet
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract DenimAccountFactory {
    DenimAccount public immutable denimAccountImpl;
    IEntryPoint public immutable entryPoint;

    event DenimAccountCreated(DenimAccount indexed denimAccountImpl);

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
        denimAccountImpl = new DenimAccount();
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(
        address owner,
        uint256 salt
    ) public returns (DenimAccount ret) {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return DenimAccount(payable(addr));
        }
        ret = DenimAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(denimAccountImpl),
                    abi.encodeCall(DenimAccount.initialize, (owner, entryPoint))
                )
            )
        );

        emit DenimAccountCreated(ret);
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(
        address owner,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(denimAccountImpl),
                            abi.encodeCall(
                                DenimAccount.initialize,
                                (owner, entryPoint)
                            )
                        )
                    )
                )
            );
    }
}

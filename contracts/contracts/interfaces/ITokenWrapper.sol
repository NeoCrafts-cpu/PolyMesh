// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITokenWrapper
 * @notice Interface for the Token Wrapper contract
 */
interface ITokenWrapper {
    /**
     * @notice Deposit ERC-20 tokens and receive wrapped tokens
     * @param token Address of the token to deposit
     * @param amount Amount to deposit
     * @return wrapped Amount of wrapped tokens received
     */
    function deposit(address token, uint256 amount) external returns (uint256 wrapped);
    
    /**
     * @notice Withdraw underlying tokens by burning wrapped tokens
     * @param token Address of the token to withdraw
     * @param wrappedAmount Amount of wrapped tokens to burn
     * @return received Amount of underlying tokens received
     */
    function withdraw(address token, uint256 wrappedAmount) external returns (uint256 received);
    
    /**
     * @notice Transfer wrapped tokens cross-chain via AggLayer
     * @param token Token to transfer
     * @param from Source address
     * @param destinationNetwork Destination chain ID
     * @param recipient Recipient on destination chain
     * @param amount Amount to transfer
     */
    function crossChainTransfer(
        address token,
        address from,
        uint32 destinationNetwork,
        address recipient,
        uint256 amount
    ) external returns (bool);
    
    /**
     * @notice Execute arbitrage swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param agent Agent executing the swap
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @return amountOut Amount of output tokens received
     */
    function executeArbitrageSwap(
        address tokenIn,
        address tokenOut,
        address agent,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
    
    /**
     * @notice Get user's wrapped balance for a token
     */
    function getWrappedBalance(address token, address user) external view returns (uint256);
    
    /**
     * @notice Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory);
}

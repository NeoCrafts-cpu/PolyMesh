// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IZKMLVerifier
 * @notice Interface for the ZKML Verifier contract
 */
interface IZKMLVerifier {
    /**
     * @notice Verify a ZKML proof of AI decision
     * @param agent Address of the agent submitting the proof
     * @param proofData Encoded proof data
     * @return verified Whether the proof is valid
     * @return proofHash Hash of the verified proof
     */
    function verifyProof(
        address agent,
        bytes calldata proofData
    ) external returns (bool verified, bytes32 proofHash);
    
    /**
     * @notice Check if a model is registered and active
     */
    function isModelActive(bytes32 modelHash) external view returns (bool);
    
    /**
     * @notice Check if a proof has been verified
     */
    function isProofVerified(bytes32 proofHash) external view returns (bool);
    
    /**
     * @notice Get verification stats for an agent
     */
    function getAgentVerificationStats(address agent) external view returns (uint256);
}

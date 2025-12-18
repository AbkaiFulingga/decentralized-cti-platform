# DECENTRALIZED CYBER THREAT INTELLIGENCE SHARING PLATFORM WITH PRIVACY-PRESERVING MECHANISMS

## Capstone Project 1 (CP1) - Planning Document

**Student Name:** [Your Name]  
**Student ID:** 20084695  
**Programme:** [Your Programme Name]  
**Academic Year:** 2024/2025  
**Supervisor:** [Supervisor Name]  

**Project Type:** Software Development  
**Domain:** Cybersecurity, Blockchain, Distributed Systems  

---

## DECLARATION OF ORIGINALITY

I hereby declare that this Capstone Project 1 Planning Document is my original work and has been written by me in its entirety. I have duly acknowledged all the sources of information which have been used in the preparation of this report.

This report has not been submitted for any degree in any other university.

**Name:** [Your Name]  
**Signature:** ________________  
**Date:** December 17, 2025  

---

## ABSTRACT

Traditional Cyber Threat Intelligence (CTI) sharing platforms face critical challenges including centralization risks, lack of contributor privacy, data integrity concerns, and limited access control mechanisms. This project proposes a novel decentralized CTI sharing platform that leverages blockchain technology, the InterPlanetary File System (IPFS), and cryptographic techniques to address these limitations. The system combines Ethereum smart contracts deployed on Arbitrum Layer 2 for cost-efficient transaction processing, IPFS for scalable off-chain storage, client-side encryption for confidentiality, and a tiered staking mechanism for spam prevention and quality assurance. The platform implements a hybrid architecture where Indicators of Compromise (IOCs) are encrypted client-side before IPFS upload, with access controlled through smart contract-based credential verification using EIP-712 signatures and Merkle tree-based role assignments. A multi-signature governance model ensures decentralized batch approval, while zero-knowledge proof integration is planned for Capstone Project 2 to enable anonymous submissions with unlinkable credentials. This CP1 planning document presents comprehensive system design, methodology, implementation strategy, literature review covering 40+ academic and industry sources, detailed project timeline with risk management, and evaluation criteria for developing a privacy-preserving, trustless CTI ecosystem that balances transparency with contributor anonymity.

**Keywords:** Cyber Threat Intelligence, Blockchain, IPFS, Decentralized Systems, Smart Contracts, Access Control, Privacy-Preserving, IOC Sharing, Ethereum, Layer 2 Scaling, Client-Side Encryption, Zero-Knowledge Proofs

---

## ACKNOWLEDGEMENTS

I would like to express my sincere gratitude to my project supervisor, [Supervisor Name], for their invaluable guidance, constructive feedback, and continuous support throughout the planning phase of this capstone project. Their expertise in blockchain technology and cybersecurity has been instrumental in shaping the direction of this research.

I also extend my appreciation to the School of Engineering and Technology faculty members for providing the academic foundation necessary for undertaking this ambitious project. Special thanks to the open-source communities behind Ethereum, IPFS, Hardhat, and related technologies whose documentation and tools have been essential to this project's feasibility assessment.

Finally, I am grateful to my peers and colleagues who provided feedback during project discussions and helped refine the problem statement and design considerations.

---

## TABLE OF CONTENTS

**FRONT MATTER**
- Cover Page ................................................................... i
- Declaration of Originality .................................................. ii
- Abstract ..................................................................... iii
- Acknowledgements ............................................................ iv
- Table of Contents ........................................................... v
- List of Figures ............................................................. viii
- List of Tables .............................................................. ix
- List of Abbreviations and Acronyms ......................................... x

**CHAPTER 1: INTRODUCTION** ....................................................... 1
- 1.1 Background and Motivation ................................................. 1
- 1.2 Challenges in Decentralized IOC Sharing Ecosystems ........................ 3
  - 1.2.1 Integrity and Provenance ............................................ 3
  - 1.2.2 Confidentiality and Access Control .................................. 4
  - 1.2.3 Authorization and Abuse Resistance .................................. 5
  - 1.2.4 Privacy Leakage via Blockchain Metadata ............................. 6
  - 1.2.5 Scalability and Cost Constraints .................................... 7
- 1.3 Problem Statement ......................................................... 8
- 1.4 Aim and Objectives ........................................................ 9
- 1.5 Scope, Out-of-Scope, and Assumptions ..................................... 10
- 1.6 Proposed Solution Overview ................................................ 12
- 1.7 High-Level Architecture Overview .......................................... 13
- 1.8 Report Organization ....................................................... 15

**CHAPTER 2: LITERATURE REVIEW** .................................................. 16
- 2.1 Literature Review Methodology ............................................. 16
  - 2.1.1 Search Strategy and Selection Criteria .............................. 16
  - 2.1.2 Thematic Organization of the Review ................................. 17
- 2.2 Centralized CTI/IOC Sharing Platforms ..................................... 18
- 2.3 Blockchain for CTI and Provenance ......................................... 21
- 2.4 Hybrid On-Chain/Off-Chain Storage Patterns ................................ 24
  - 2.4.1 IPFS and Blockchain Architectures ................................... 24
  - 2.4.2 IPFS Security Limitations and Mitigations ........................... 26
- 2.5 Access Control and Governance in Decentralized Systems .................... 28
  - 2.5.1 Smart Contract Authorization and Credential Systems ................. 28
  - 2.5.2 Scalable Authorization Mechanisms ................................... 30
- 2.6 Privacy-Preserving Technologies for CTI ................................... 32
  - 2.6.1 Encryption Approaches ............................................... 32
  - 2.6.2 Zero-Knowledge Proofs for Privacy ................................... 34
- 2.7 Economic and Scalability Considerations ................................... 36
- 2.8 Summary of Gaps and Opportunities ......................................... 38
- 2.9 Comprehensive Literature Survey Table ..................................... 40

**CHAPTER 3: METHODOLOGY AND SYSTEM DESIGN** ...................................... 48
- 3.1 Design Goals and Requirements ............................................. 48
- 3.2 Threat Model and Security Assumptions ..................................... 50
- 3.3 System Architecture Specification .......................................... 52
  - 3.3.1 Component Overview .................................................. 52
  - 3.3.2 Data Models ......................................................... 54
- 3.4 End-to-End Workflows ....................................................... 56
  - 3.4.1 Credential Issuance Workflow ........................................ 56
  - 3.4.2 IOC Submission Workflow ............................................. 57
  - 3.4.3 IOC Retrieval Workflow .............................................. 59
- 3.5 Cryptographic Building Blocks .............................................. 60
  - 3.5.1 Signatures and Authentication ....................................... 60
  - 3.5.2 Hashing and Commitments ............................................. 62
  - 3.5.3 Encryption Strategy ................................................. 63
  - 3.5.4 Zero-Knowledge Proof Roadmap (CP2) .................................. 65
- 3.6 Smart Contract Design ...................................................... 67
  - 3.6.1 PrivacyPreservingRegistry Contract .................................. 67
  - 3.6.2 ThresholdGovernance Contract ........................................ 69
  - 3.6.3 Gas and Storage Optimization Strategy ............................... 70
- 3.7 Access Control and Governance .............................................. 72
- 3.8 Privacy and Anonymity Design ............................................... 74
- 3.9 Security Analysis .......................................................... 76
- 3.10 Test and Evaluation Plan (CP2 Preview) ................................... 78

**CHAPTER 4: IMPLEMENTATION PLAN AND TOOLS** ...................................... 80
- 4.1 Technology Stack Selection and Rationale .................................. 80
- 4.2 Network Deployment Strategy ................................................ 82
- 4.3 Development Phases and Integration Plan ................................... 83
- 4.4 Quality Assurance Strategy ................................................. 85

**CHAPTER 5: PROJECT TIMELINE AND RISK MANAGEMENT** .............................. 87
- 5.1 Milestones and Deliverables ................................................ 87
- 5.2 Work Breakdown and Timeline ................................................ 88
- 5.3 Risk Assessment and Mitigation ............................................. 90
- 5.4 Resource Requirements ...................................................... 92

**CHAPTER 6: CONCLUSION (CP1)** ................................................... 93
- 6.1 Summary of CP1 Planning Outputs ........................................... 93
- 6.2 Expected Contributions ..................................................... 94
- 6.3 CP2 Implementation Roadmap ................................................. 95
- 6.4 Concluding Remarks ......................................................... 96

**BACK MATTER**
- References .................................................................... 97
- Appendices
  - Appendix A: Extended Literature Survey Table .............................. 105
  - Appendix B: Additional Diagrams ........................................... 110
  - Appendix C: Draft Specifications .......................................... 115
  - Appendix D: Supervision Meeting Records ................................... 120

---

## LIST OF FIGURES

Figure 1.1: High-Level System Architecture Diagram ............................... 14
Figure 2.1: Literature Review Methodology Flowchart .............................. 17
Figure 3.1: Hybrid On-Chain/Off-Chain Storage Architecture ....................... 53
Figure 3.2: End-to-End IOC Submission Workflow ................................... 58
Figure 3.3: IOC Retrieval Workflow Sequence Diagram .............................. 59
Figure 3.4: Authorization Verification Process ................................... 61
Figure 3.5: Merkle Tree Role-Based Access Control Structure ...................... 73
Figure 3.6: Component Trust Boundaries ........................................... 51
Figure 3.7: Threat Model Diagram ................................................. 51
Figure 5.1: Project Gantt Chart with Critical Path and Dependencies ............. 89

---

## LIST OF TABLES

Table 2.1: Comprehensive Literature Survey (40+ entries) ......................... 40
Table 3.1: IOC Metadata Schema Specification ..................................... 54
Table 3.2: Credential Schema Specification (EIP-712 Structure) ................... 55
Table 3.3: Authorization Policy Rules Matrix ..................................... 72
Table 3.4: Cryptographic Building Blocks Summary ................................. 66
Table 3.5: Smart Contract Interface Specifications ............................... 71
Table 3.6: Security Threat-Control Mapping ....................................... 77
Table 4.1: Technology Stack Comparison ........................................... 81
Table 4.2: Network Deployment Comparison (Sepolia vs Arbitrum Sepolia) ........... 82
Table 5.1: Milestone Deliverables ................................................ 87
Table 5.2: Risk Assessment Matrix with Mitigation Strategies ..................... 91

---

## LIST OF ABBREVIATIONS AND ACRONYMS

| Abbreviation | Full Term |
|--------------|-----------|
| ABI | Application Binary Interface |
| AES | Advanced Encryption Standard |
| API | Application Programming Interface |
| CID | Content Identifier |
| CP1 | Capstone Project 1 |
| CP2 | Capstone Project 2 |
| CTI | Cyber Threat Intelligence |
| DAO | Decentralized Autonomous Organization |
| DApp | Decentralized Application |
| DHT | Distributed Hash Table |
| ECDSA | Elliptic Curve Digital Signature Algorithm |
| EIP | Ethereum Improvement Proposal |
| ETH | Ether (Ethereum cryptocurrency) |
| EVM | Ethereum Virtual Machine |
| GCM | Galois/Counter Mode |
| IPFS | InterPlanetary File System |
| IOC | Indicator of Compromise |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| KDF | Key Derivation Function |
| L1 | Layer 1 (blockchain mainnet) |
| L2 | Layer 2 (blockchain scaling solution) |
| MDS | Maximum Distance Separable |
| MISP | Malware Information Sharing Platform |
| NFT | Non-Fungible Token |
| PBKDF2 | Password-Based Key Derivation Function 2 |
| RBAC | Role-Based Access Control |
| RPC | Remote Procedure Call |
| SBT | Soulbound Token |
| SIEM | Security Information and Event Management |
| STIX | Structured Threat Information Expression |
| TPS | Transactions Per Second |
| UI | User Interface |
| ZKP | Zero-Knowledge Proof |
| zkSNARK | Zero-Knowledge Succinct Non-Interactive Argument of Knowledge |

---

# CHAPTER 1: INTRODUCTION

## 1.1 Background and Motivation

Cyber threats have evolved into one of the most significant challenges facing organizations, governments, and individuals in the digital age. The increasing sophistication of cyberattacks, ranging from ransomware campaigns to state-sponsored advanced persistent threats (APTs), necessitates collaborative defense mechanisms where threat intelligence is shared rapidly and reliably across organizational boundaries. Cyber Threat Intelligence (CTI) encompasses the collection, analysis, and dissemination of information about cyber threats, including Indicators of Compromise (IOCs) such as malicious IP addresses, file hashes, domain names, and attack patterns [].

Traditional CTI sharing platforms operate on centralized architectures where a single entity controls the data repository, user access, and dissemination policies. While platforms such as the Malware Information Sharing Platform (MISP) [], AlienVault Open Threat Exchange (OTX) [], and commercial services like ThreatConnect [] have facilitated community-driven threat intelligence sharing, they suffer from fundamental architectural limitations. Centralized platforms create single points of failure, are vulnerable to data manipulation or censorship by the controlling entity, lack transparency in data provenance, and fail to adequately protect contributor privacy. Organizations are often reluctant to share sensitive threat intelligence publicly due to fears of reputational damage, legal liability, or revealing details about their security posture to adversaries.

The emergence of blockchain technology presents a paradigm shift in how distributed systems can achieve trustless consensus, immutable record-keeping, and transparent yet pseudonymous transactions without central authorities []. Blockchain's properties of data immutability, cryptographic auditability, and decentralized consensus mechanisms align closely with the requirements for trustworthy CTI sharing platforms. By leveraging smart contracts on platforms like Ethereum [], stakeholders can encode business logic, access control policies, and governance rules directly into executable code that runs deterministically across a distributed network of nodes.

However, storing large volumes of threat intelligence data directly on blockchain networks is economically prohibitive due to high transaction costs and limited throughput. Ethereum Layer 1 (L1) mainnet, for instance, processes approximately 15-30 transactions per second with gas costs that can exceed $50 per transaction during network congestion []. This creates a fundamental tension: blockchain provides the trust and transparency needed for CTI sharing, but cannot scale to handle the data volumes and submission frequencies required by real-world threat intelligence operations.

Complementary decentralized storage solutions like the InterPlanetary File System (IPFS) [] offer a potential resolution. IPFS provides content-addressed, distributed file storage where data is identified by cryptographic hashes (Content Identifiers or CIDs) rather than location-based URLs. By combining blockchain's trust layer with IPFS's scalable storage layer, hybrid architectures can achieve both data integrity verification and practical storage economics. However, IPFS itself provides no built-in access control mechanisms—any entity possessing a CID can retrieve the associated content from the IPFS network. This creates a critical confidentiality gap that must be addressed through additional cryptographic mechanisms.

Furthermore, the transparent nature of public blockchains introduces privacy challenges. All transactions, including those submitting threat intelligence, are visible to any observer of the blockchain. This metadata leakage can reveal patterns about which organizations are submitting what types of threats and when, potentially exposing information about ongoing security incidents or organizational vulnerabilities. Advanced privacy-preserving cryptographic techniques, particularly zero-knowledge proofs (ZKPs) [], offer promising solutions by enabling contributors to prove they possess valid credentials or that submitted data meets quality criteria without revealing their identity or the data itself.

Layer 2 (L2) scaling solutions have emerged to address blockchain throughput and cost limitations. Technologies such as Optimistic Rollups (e.g., Arbitrum [], Optimism []) and Zero-Knowledge Rollups (e.g., zkSync [], StarkNet []) batch multiple transactions off-chain before submitting compressed proofs to the Layer 1 mainnet, achieving 10-100x improvements in transaction throughput and 50-100x reductions in per-transaction costs while inheriting the security guarantees of the underlying L1 chain.

This project is motivated by the hypothesis that combining these technologies—blockchain smart contracts for trust and governance, IPFS for scalable storage, client-side encryption for confidentiality, Layer 2 scaling for economic viability, and zero-knowledge proofs for privacy—can create a decentralized CTI sharing platform that addresses the fundamental limitations of centralized systems while maintaining practical usability and security guarantees. The platform aims to enable organizations to contribute threat intelligence with cryptographic assurances of data integrity, flexible access control policies, protection of contributor identity, and resistance to censorship or manipulation by any single party.

## 1.2 Challenges in Decentralized IOC Sharing Ecosystems

The design of a decentralized IOC sharing platform must address five primary technical challenges, each representing a critical requirement that existing solutions fail to adequately satisfy:

### 1.2.1 Integrity and Provenance

**Challenge Description:**  
In centralized CTI platforms, users must trust the platform operator not to modify, delete, or tamper with submitted threat intelligence. There is no cryptographic mechanism for independently verifying that retrieved IOC data matches what was originally submitted or that the claimed submission timestamp is accurate. This trust requirement creates opportunities for insider attacks, regulatory coercion, or silent data corruption.

**Technical Requirements:**  
A decentralized solution must provide:
- Cryptographic proof that submitted data has not been altered after submission
- Tamper-evident audit trail linking each IOC batch to a specific contributor and timestamp
- Ability for any third party to independently verify data integrity without trusting platform operators
- Resistance to retroactive modification or deletion of historical submissions

**Current State of Art:**  
Existing blockchain-based approaches such as [] store hash commitments of IOC data on-chain, enabling integrity verification. However, these implementations often lack comprehensive provenance tracking that links submissions to verified contributor identities, making it difficult to assess the credibility or historical accuracy of individual contributors.

**Proposed Approach:**  
This project will leverage blockchain's immutability properties by storing IPFS Content Identifiers (CIDs) and Merkle tree roots of IOC batches in smart contracts. The IPFS CID serves as a cryptographic hash of the data content, automatically providing tamper detection. Merkle trees enable efficient verification of individual IOCs within a batch. Smart contract events will create an immutable audit trail linking each submission to a contributor's Ethereum address and block timestamp, providing verifiable provenance.

### 1.2.2 Confidentiality and Access Control

**Challenge Description:**  
IPFS, by design, makes any content retrievable by anyone who knows the CID. Unlike HTTP-based systems where server-side access controls can restrict who retrieves specific resources, IPFS operates as a peer-to-peer network where content discovery and retrieval are decoupled from authorization. This creates a fundamental confidentiality problem: if an IOC batch's CID is submitted to a public blockchain (where it becomes visible to all network observers), anyone can retrieve that data from IPFS, regardless of intended access restrictions.

Consider this concrete example:
```
1. Organization A submits sensitive IOC batch to IPFS → receives CID: QmXyz123...
2. Organization A submits CID "QmXyz123..." to blockchain smart contract
3. Blockchain transaction is public → CID is now visible to everyone
4. Attacker sees CID in blockchain transaction logs
5. Attacker retrieves IOC data from IPFS using: ipfs.io/ipfs/QmXyz123...
6. Confidentiality is completely compromised
```

This scenario demonstrates that storing plaintext IOC data in IPFS while recording CIDs on public blockchains provides zero confidentiality protection.

**Technical Requirements:**  
A secure solution must:
- Encrypt IOC data before uploading to IPFS, ensuring ciphertext-only storage
- Implement cryptographic access control where only authorized parties can decrypt retrieved data
- Manage encryption keys in a way that supports scalable, dynamic authorization policies
- Prevent unauthorized access even if attackers obtain the IPFS CID

**Current State of Art:**  
Research on "encrypted IPFS" [] and "blockchain-based access control" [] has explored client-side encryption approaches, but most implementations use naive symmetric key sharing that doesn't scale or attribute-based encryption schemes that require complex key hierarchies and lack blockchain integration.

**Proposed Approach (CP1 Scope):**  
This project will implement deterministic wallet-signature-derived encryption keys, where each contributor's MetaMask wallet signs a standardized message to generate a consistent AES-256-GCM encryption key. IOC batches are encrypted client-side before IPFS upload, and only users possessing valid credentials (verified on-chain) can derive the decryption key. This approach:
- Requires no separate key management infrastructure
- Provides deterministic key generation (same wallet always produces same key)
- Integrates naturally with blockchain-based authentication
- Documents limitations (key compromise exposes all historical data) for CP2 enhancement

### 1.2.3 Authorization and Abuse Resistance

**Challenge Description:**  
Decentralized systems must prevent Sybil attacks where malicious actors create numerous fake identities to spam low-quality or malicious IOC submissions, overwhelming legitimate data. Additionally, the system must enforce authorization policies that distinguish between contributors with different privilege levels (e.g., trusted organizations vs. individual researchers) without relying on centralized identity verification.

**Technical Requirements:**  
The platform must:
- Implement economic barriers to spam (staking/reputation mechanisms)
- Support role-based access control for submission, retrieval, and governance actions
- Enable scalable credential verification without centralized certificate authorities
- Provide mechanisms for revoking compromised or malicious contributors

**Current State of Art:**  
Blockchain projects commonly use token staking [], where users must lock economic value to participate, creating financial disincentives for abuse. Credential systems like EIP-712 [] enable structured data signing for authentication.

**Proposed Approach:**  
The system implements a three-tier staking mechanism (0.01/0.05/0.1 ETH) where contributors must stake funds to register, creating economic accountability. Higher stake amounts grant differential reputation rewards for accepted submissions. A 2-of-3 multi-signature governance contract requires threshold approval from designated admin addresses before batches are accepted, preventing spam from bypassing quality checks. Merkle tree-based role verification enables gas-efficient on-chain credential checking where contributor addresses are organized into a Merkle tree, and authorization requires providing a Merkle proof of inclusion rather than storing entire access control lists on-chain.

### 1.2.4 Privacy Leakage via Blockchain Metadata

**Challenge Description:**  
Even if IOC content is encrypted, blockchain transaction metadata reveals:
- **Contributor identity:** The Ethereum address submitting each batch
- **Submission patterns:** Timestamps, frequency, and correlation across submissions
- **Organizational activity:** Linking multiple submissions from the same address reveals ongoing incidents

For example, if a financial institution's Ethereum address submits IOC batches about banking malware every day for two weeks, observers can infer that the institution is experiencing an active security incident, even without seeing the IOC content.

**Technical Requirements:**  
Privacy-preserving submission mechanisms must:
- Decouple submission actions from contributor identities on-chain
- Prevent linking multiple submissions from the same contributor
- Enable reputation/credential verification without revealing specific contributor addresses
- Maintain these properties while supporting accountability and abuse prevention

**Current State of Art:**  
Zero-knowledge proof systems like zkSNARKs [] enable "anonymous credentials" where users prove possession of valid credentials without revealing which credential they hold. Projects like Tornado Cash [] and Semaphore [] demonstrate practical applications of ZKP for privacy.

**Proposed Approach (CP2 Scope):**  
The CP1 implementation will support both public and anonymous submission modes, documenting the privacy limitations of public submissions. CP2 will integrate Groth16 zkSNARK proofs where contributors prove membership in a pre-registered set (stored as a Merkle tree root on-chain) without revealing which member they are. Each submission uses a unique cryptographic commitment (Poseidon hash of address + random nonce) to prevent linkability across submissions. The smart contract verifies the zkSNARK proof on-chain, confirming the submitter is authorized without learning their identity.

### 1.2.5 Scalability and Cost Constraints

**Challenge Description:**  
Real-world threat intelligence operations involve thousands of IOC submissions daily. For example, the AbuseIPDB blacklist contains over 5 million abusive IP addresses. If each IOC submission required a separate Ethereum L1 transaction at $10-50 per transaction, costs would be prohibitive for large-scale deployment.

Consider this cost analysis for a hypothetical CTI platform:
```
Scenario: 100 organizations each submitting 50 IOC batches/day
- Transactions per day: 100 × 50 = 5,000 tx/day
- Ethereum L1 gas cost: $20/tx (moderate congestion)
- Daily cost: 5,000 × $20 = $100,000/day
- Annual cost: $36.5 million/year
```

This cost structure is economically unsustainable for a community-driven platform.

**Technical Requirements:**  
A practical solution must:
- Reduce per-transaction costs by 50-100x compared to Ethereum L1
- Support throughput of hundreds to thousands of transactions per day
- Maintain security and decentralization properties of L1
- Provide finality within reasonable timeframes (minutes, not hours)

**Current State of Art:**  
Layer 2 scaling solutions have matured significantly, with Optimistic Rollups (Arbitrum, Optimism) providing 10-100x cost reductions and zkRollups (zkSync, StarkNet) offering even higher scalability with cryptographic validity proofs [].

**Proposed Approach:**  
This project deploys smart contracts on Arbitrum Sepolia (testnet) and Arbitrum One (mainnet for CP2), an Optimistic Rollup that reduces gas costs by ~50-100x compared to Ethereum mainnet while inheriting Ethereum L1's security through fraud proofs. Transaction finality on Arbitrum occurs within seconds for practical purposes, with L1 settlement occurring periodically. This architecture enables economically viable large-scale deployment while maintaining the security guarantees essential for CTI applications.

## 1.3 Problem Statement

Traditional centralized Cyber Threat Intelligence sharing platforms suffer from five critical limitations that this project aims to address:

1. **Trust Dependency:** Users must trust platform operators not to tamper with data, censor submissions, or manipulate timestamps
2. **Privacy Violation:** Contributor identities and submission patterns are exposed to platform operators and potentially third parties
3. **Confidentiality Gaps:** IPFS provides no native access control, allowing unauthorized retrieval if CIDs are publicly visible
4. **Centralization Risks:** Single points of failure for data availability, policy enforcement, and governance decisions
5. **Economic Barriers:** High blockchain transaction costs prevent practical large-scale deployment

**Synthesis:**  
These challenges collectively prevent organizations from confidently sharing sensitive threat intelligence in a decentralized manner. A trustless platform is needed that provides cryptographic integrity guarantees, flexible privacy-preserving submission modes, practical access control mechanisms, and economic viability for real-world deployment.

The central research question is:  
**How can blockchain technology, distributed storage systems, and privacy-preserving cryptographic techniques be combined into a practical, economically viable platform for decentralized CTI sharing that provides integrity, confidentiality, authorization, and contributor privacy without dependence on trusted central authorities?**

## 1.4 Aim and Objectives

**Aim:**  
To design, implement, and evaluate a decentralized Cyber Threat Intelligence sharing platform that leverages blockchain smart contracts, IPFS distributed storage, client-side encryption, and privacy-preserving cryptographic techniques to enable trustless, confidential, and privacy-respecting IOC sharing among security practitioners.

**Specific Objectives:**

**O1: System Architecture Design**  
Design a hybrid on-chain/off-chain architecture that combines Ethereum smart contracts for trust and governance with IPFS for scalable data storage, specifying component interactions, data models, and cryptographic protocols.

- **Deliverable:** Comprehensive architecture diagrams showing component boundaries, trust relationships, and data flows
- **Success Criteria:** Architecture addresses all five challenges identified in Section 1.2 with clear technical approaches

**O2: Cryptographic Protocol Specification**  
Specify cryptographic protocols for data integrity verification, access control enforcement, contributor authentication, and privacy preservation, including encryption schemes, signature verification, and hash commitment structures.

- **Deliverable:** Detailed protocol specifications for encryption (AES-256-GCM), authentication (ECDSA, EIP-712), hashing (keccak256, IPFS CID), and CP2 zero-knowledge proofs (Groth16)
- **Success Criteria:** Protocols satisfy confidentiality, integrity, and authenticity security properties under specified threat model

**O3: Smart Contract Implementation**  
Implement Solidity smart contracts for contributor registration, IOC batch submission, multi-signature governance, access control policy enforcement, and reputation tracking, optimized for gas efficiency.

- **Deliverable:** Audited smart contracts for PrivacyPreservingRegistry, ThresholdGovernance, and MerkleZKRegistry (CP2)
- **Success Criteria:** Contracts pass automated security analysis, achieve <200K gas per submission, support 100+ contributors

**O4: Client-Side Application Development**  
Develop a Next.js web application integrating MetaMask wallet authentication, client-side encryption/decryption, IPFS upload/retrieval, smart contract interaction, and user interface for submission and retrieval workflows.

- **Deliverable:** Production-ready web application deployed on IPFS with full workflow support
- **Success Criteria:** End-to-end workflows (register → submit → approve → retrieve) complete successfully with <10 second latency

**O5: Privacy-Preserving Mechanism Integration (CP2)**  
Design and implement zero-knowledge proof circuits for anonymous submission using Groth16 zkSNARKs, enabling contributors to prove valid credentials without revealing identity.

- **Deliverable:** Circom circuits, proof generation system, on-chain verifier contract, frontend integration
- **Success Criteria:** Anonymous submissions indistinguishable from public submissions, proof generation <30 seconds, verification <100K gas

**O6: Evaluation and Validation**  
Evaluate the system across four dimensions: security (threat model validation), performance (gas costs, latency, throughput), usability (workflow complexity), and economic viability (cost comparison vs. centralized systems).

- **Deliverable:** Comprehensive evaluation report with quantitative metrics and qualitative analysis
- **Success Criteria:** Meets all functional requirements, demonstrates <$1 per IOC batch submission on L2, supports 100+ TPS

## 1.5 Scope, Out-of-Scope, and Assumptions

### In-Scope for CP1

**Core System Components:**
- Smart contract design and implementation for contributor registration, IOC batch submission, multi-signature governance, and on-chain access control verification
- IPFS integration for decentralized storage of IOC data with CID-based retrieval
- Client-side encryption implementation using wallet-signature-derived AES-256-GCM keys
- Next.js frontend application with MetaMask wallet integration
- Deployment on Ethereum Sepolia testnet and Arbitrum Sepolia L2 testnet
- Multi-signature governance with 2-of-3 threshold approval for batch acceptance
- Tiered staking mechanism (0.01/0.05/0.1 ETH) for spam prevention
- Public submission mode with full contributor identity disclosure

**Documentation and Planning:**
- Comprehensive literature review of blockchain CTI platforms, IPFS security, access control mechanisms, and privacy-preserving technologies
- Detailed system architecture specification with component diagrams
- Threat model and security analysis
- Implementation timeline and risk management plan
- Draft specifications for data schemas, contract interfaces, and API endpoints

### Out-of-Scope for CP1 (Deferred to CP2)

**Advanced Privacy Features:**
- Zero-knowledge proof (zkSNARK) implementation for anonymous submissions
- Unlinkable credential systems for multi-submission privacy
- Commitment-based reputation tracking for anonymous contributors
- Anonymous credential revocation mechanisms

**Advanced Features:**
- Automated threat feed oracle integration (AbuseIPDB, VirusTotal)
- STIX 2.1 format conversion and export
- Cross-chain bridge for multi-network deployment
- Decentralized governance (DAO) voting mechanisms
- On-chain reputation NFTs/Soulbound Tokens
- Machine learning-based IOC quality scoring
- Mobile application development

**Production Hardening:**
- Mainnet deployment on Ethereum L1 or Arbitrum One
- Comprehensive smart contract security audit by third-party firm
- Formal verification of critical contract functions
- Load testing beyond 1000 concurrent users
- Disaster recovery and backup strategies
- 24/7 monitoring and alerting infrastructure

### Assumptions

**Technical Assumptions:**
1. **MetaMask Availability:** Users have MetaMask or compatible Web3 wallet installed
2. **IPFS Reliability:** Pinata IPFS gateway maintains >99% uptime and data availability
3. **Blockchain Finality:** Arbitrum L2 provides practical finality within 1-2 minutes
4. **Network Access:** Users can access Ethereum RPC endpoints and IPFS gateways
5. **Browser Compatibility:** Modern browsers (Chrome, Firefox, Edge) support required Web3 APIs

**Security Assumptions:**
1. **Smart Contract Security:** No critical vulnerabilities in OpenZeppelin libraries or Solidity compiler
2. **Cryptographic Primitives:** AES-256-GCM, keccak256, and ECDSA are computationally secure
3. **Wallet Security:** Users protect their private keys and are not compromised by malware
4. **Admin Honesty:** At least 2 of 3 governance admins act honestly and are not colluding

**Operational Assumptions:**
1. **User Competence:** Contributors understand basic blockchain concepts and can manage gas fees
2. **Data Quality:** Contributors submit legitimate IOC data, not intentional misinformation
3. **Legal Compliance:** IOC sharing complies with applicable data protection and cybersecurity laws
4. **Network Economics:** Arbitrum L2 gas costs remain <$1 per transaction

**Scope Boundaries:**
- This project focuses on the technical platform implementation, not organizational adoption strategies
- Integration with existing SIEM systems is discussed but not implemented
- The platform is a proof-of-concept demonstrating feasibility; production deployment requires additional hardening
- CP1 delivers a functional prototype with public submissions; CP2 adds privacy-preserving features

## 1.6 Proposed Solution Overview

This project proposes a **hybrid blockchain-IPFS architecture** that maps each identified challenge to specific technical components:

**Challenge → Solution Mapping:**

| Challenge | Technical Solution | Component |
|-----------|-------------------|-----------|
| **Integrity & Provenance** | Blockchain-stored IPFS CIDs + Merkle roots, immutable event logs | PrivacyPreservingRegistry.sol |
| **Confidentiality & Access** | Client-side AES-256-GCM encryption before IPFS upload, wallet-derived keys | Frontend encryption module |
| **Authorization & Abuse** | Tiered staking (0.01/0.05/0.1 ETH), Merkle tree RBAC, 2-of-3 multi-sig approval | ThresholdGovernance.sol |
| **Privacy Leakage** | CP2: Groth16 zkSNARK proofs, one-time commitments, Merkle tree anonymity sets | MerkleZKRegistry.sol (CP2) |
| **Scalability & Cost** | Arbitrum L2 deployment, batch submissions, gas-optimized contracts | Infrastructure layer |

**Core Architecture Principles:**

1. **Separation of Concerns:** Data storage (IPFS), trust/consensus (blockchain), computation (client-side), governance (multi-sig)

2. **Defense in Depth:**
   - Layer 1: Encryption (prevents unauthorized IPFS access)
   - Layer 2: Access Control (smart contract credential verification)
   - Layer 3: Privacy (zkSNARK anonymity for CP2)
   - Layer 4: Economic Security (staking disincentivizes spam)

3. **Progressive Enhancement:**
   - CP1: Public submissions with encryption
   - CP2: Add anonymous submissions with zkSNARKs
   - Future: Cross-chain, DAO governance, AI-assisted validation

**Key Innovation:**  
Unlike existing solutions that treat blockchain OR encryption OR privacy as isolated features, this platform integrates all three into a cohesive system where:
- Blockchain provides verifiable integrity without storing sensitive data
- IPFS provides scalable storage without exposing plaintext
- Encryption provides confidentiality without centralized key management
- zkSNARKs (CP2) provide anonymity without sacrificing accountability

## 1.7 High-Level Architecture Overview

The system comprises six primary components organized in a layered architecture:

**Layer 1: Presentation Layer (Frontend)**
- Next.js 15.5.4 web application with React components
- MetaMask integration for wallet authentication
- Client-side encryption/decryption using Web Crypto API
- IPFS upload via Pinata API
- Real-time smart contract interaction via ethers.js v6

**Layer 2: Storage Layer (IPFS)**
- Distributed content-addressed storage via Pinata gateway
- Encrypted IOC batches stored as JSON files
- Content integrity via CID cryptographic hashing
- Decentralized availability through DHT-based peer discovery

**Layer 3: Consensus Layer (Blockchain)**
- Ethereum smart contracts deployed on Arbitrum Sepolia L2
- PrivacyPreservingRegistry: Core submission and retrieval logic
- ThresholdGovernance: Multi-signature batch approval
- MerkleZKRegistry (CP2): Anonymous submission verification
- Event logs providing immutable audit trail

**Layer 4: Cryptographic Layer**
- **Hashing:** keccak256 (Ethereum), SHA-256 (IPFS CID), Poseidon (CP2 zkSNARKs)
- **Encryption:** AES-256-GCM with wallet-signature-derived keys
- **Signatures:** ECDSA for transactions, EIP-712 for structured data
- **Proofs:** Merkle proofs for RBAC, Groth16 zkSNARKs for CP2 anonymity

**Layer 5: Governance Layer**
- 2-of-3 multi-signature approval for batch acceptance
- Admin addresses: configurable governance participants
- Threshold execution: automatic batch acceptance at 2 approvals
- Reputation rewards: tier-based points for accepted submissions

**Layer 6: Economic Layer**
- Tiered staking: 0.01 ETH (Basic), 0.05 ETH (Standard), 0.1 ETH (Premium)
- Gas optimization: batch submissions, Merkle tree compression
- L2 cost reduction: 50-100x cheaper than Ethereum L1
- Incentive alignment: reputation system rewards quality contributions

**System Workflow (Simplified):**

```
┌─────────────┐
│ Contributor │
└──────┬──────┘
       │ 1. Generate IOC data locally
       ▼
┌──────────────────┐
│ Encrypt IOC data │ (AES-256-GCM, wallet-derived key)
└──────┬───────────┘
       │ 2. Upload encrypted JSON to IPFS
       ▼
┌───────────────┐
│ Pinata Gateway│ → Returns CID: QmXyz123...
└──────┬────────┘
       │ 3. Build Merkle tree from IOC array
       ▼
┌──────────────────────┐
│ Submit to Blockchain │ addBatch(CID, MerkleRoot)
└──────┬───────────────┘
       │ 4. Transaction recorded on Arbitrum L2
       ▼
┌──────────────────────┐
│ Governance Approval  │ 2-of-3 multi-sig threshold
└──────┬───────────────┘
       │ 5. Batch accepted, reputation updated
       ▼
┌──────────────────────┐
│ Authorized Retrieval │ Download CID, verify Merkle proof, decrypt
└──────────────────────┘
```

**Figure 1.1: High-Level System Architecture** (detailed diagram in Chapter 3)

This architecture ensures:
- **No plaintext IOC data on blockchain** (only CIDs and Merkle roots)
- **No plaintext IOC data on IPFS** (encrypted before upload)
- **Cryptographic verification at every layer** (CID hash, Merkle proof, signature validation)
- **Economic incentives aligned with quality** (staking + reputation)
- **Governance without central authority** (multi-sig threshold)

## 1.8 Methodology Overview

This project follows a structured four-phase development approach:

**Phase 1: Research and Design (CP1 Focus)**  
*Timeline: Weeks 1-4*

Activities:
- Comprehensive literature review of blockchain CTI platforms, IPFS security, access control systems, and privacy-preserving technologies
- Threat modeling: identify adversaries, attack vectors, and security properties
- Architecture design: component specifications, interface definitions, data models
- Cryptographic protocol design: encryption schemes, key derivation, signature formats
- Smart contract interface specification: function signatures, events, access control policies

Deliverables:
- Literature review with gap analysis
- Threat model document
- System architecture diagrams
- Smart contract interface specifications
- Cryptographic protocol documentation

**Phase 2: Core Implementation (CP1)**  
*Timeline: Weeks 5-10*

Activities:
- Smart contract development in Solidity (PrivacyPreservingRegistry, ThresholdGovernance)
- Frontend application development with Next.js and ethers.js
- Client-side encryption module implementation
- IPFS integration via Pinata API
- MetaMask wallet integration
- Testing on Sepolia testnet

Deliverables:
- Deployed smart contracts on Sepolia and Arbitrum Sepolia
- Functional web application
- Test suite with unit and integration tests
- Deployment scripts and configuration

**Phase 3: Privacy Enhancement (CP2)**  
*Timeline: Weeks 11-16*

Activities:
- zkSNARK circuit design in Circom
- Groth16 proof generation system
- On-chain verifier contract implementation
- Frontend integration for anonymous submissions
- Merkle tree anonymity set construction
- Performance optimization

Deliverables:
- Circom circuit (contributor-proof-v2.circom)
- Proof generation library
- MerkleZKRegistry.sol contract
- Anonymous submission UI
- CP2 testing and validation

**Phase 4: Evaluation and Documentation (CP1 + CP2)**  
*Timeline: Weeks 17-20*

Activities:
- Security analysis: attack scenarios, mitigation verification
- Performance benchmarking: gas costs, latency, throughput
- Usability testing: workflow complexity, user feedback
- Economic analysis: cost comparison, sustainability model
- Documentation: final report, API reference, deployment guide

Deliverables:
- Comprehensive evaluation report
- Final capstone documentation
- Public repository with README
- Video demonstration
- Presentation materials

## 1.9 Expected Outcomes and Contributions

This project aims to deliver the following concrete outcomes:

**Technical Artifacts:**
1. **Smart Contract Suite:** Production-ready Solidity contracts for decentralized CTI sharing
2. **Web Application:** Fully functional Next.js frontend with MetaMask and IPFS integration
3. **zkSNARK Circuit:** Groth16 proof system for anonymous submissions (CP2)
4. **Deployment Package:** Scripts, configuration files, and documentation for reproducible deployment
5. **Test Suite:** Comprehensive unit, integration, and end-to-end tests

**Research Contributions:**
1. **Novel Architecture:** First integration of blockchain + IPFS + client-side encryption + zkSNARKs for CTI sharing
2. **Practical Evaluation:** Quantitative analysis of gas costs, latency, and scalability on Layer 2 networks
3. **Threat Model:** Comprehensive adversarial analysis for decentralized CTI platforms
4. **Design Patterns:** Reusable patterns for Merkle-based RBAC, wallet-derived encryption, multi-sig governance

**Academic Contributions:**
1. **Literature Synthesis:** Comprehensive review connecting blockchain, IPFS, access control, and privacy research domains
2. **Gap Analysis:** Identification of unmet requirements in existing CTI platforms
3. **Methodology:** Structured approach to integrating multiple decentralized technologies
4. **Evaluation Framework:** Metrics and methods for assessing decentralized CTI systems

**Practical Impact:**
1. **Proof-of-Concept:** Demonstrates technical feasibility of decentralized CTI sharing
2. **Cost Analysis:** Provides economic viability data for real-world deployment decisions
3. **Open Source:** Public repository enabling community adoption and extension
4. **Educational Resource:** Comprehensive documentation for researchers and practitioners

## 1.10 Organization of This Report

The remainder of this report is structured as follows:

**Chapter 2: Literature Review**  
Surveys existing research across six domains: centralized CTI platforms, blockchain applications in cybersecurity, IPFS security and access control, privacy-preserving technologies (zkSNARKs), Layer 2 scaling solutions, and related work on decentralized threat intelligence systems. Identifies gaps that this project addresses and establishes the theoretical foundation for design decisions.

**Chapter 3: Methodology and Design**  
Presents the comprehensive system design including threat model, architecture diagrams, data models, cryptographic protocols, smart contract specifications, frontend workflows, and security analysis. This chapter provides the technical blueprint for the implementation.

**Chapter 4: Implementation Plan and Technical Specifications**  
Details the implementation approach including development environment setup, smart contract code organization, frontend component structure, testing strategies, deployment procedures, and integration workflows. Includes specific technology choices and configuration parameters.

**Chapter 5: Project Timeline, Milestones, and Risk Management**  
Outlines the project schedule with Gantt chart, defines measurable milestones, identifies potential risks (technical, security, timeline), and describes mitigation strategies. Includes resource allocation and dependency management.

**Chapter 6: Conclusion and Future Work**  
Summarizes the project's objectives, expected contributions, and planned evaluation approach. Discusses limitations of the CP1 scope and outlines CP2 enhancements. Identifies directions for future research and practical deployment considerations.

**Appendices:**  
- Appendix A: Smart Contract Source Code
- Appendix B: Circuit Specifications (CP2)
- Appendix C: API Reference Documentation
- Appendix D: Deployment Configuration Files
- Appendix E: Test Results and Benchmarks

**Activity Log:**  
Documents meeting records, supervisor consultations, development logs, and revision history demonstrating the progression of work throughout the project timeline.

---

*End of Chapter 1*


const ethers = require('ethers');

// Function signature from transaction
const inputData = "0x7f70aae900000000000000000000000000000000000000000000000000000000000000a09c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb65800000000000000000000000000000000000000000000000000000000000000019a5968cc030611495c12096f80056b206d8e735455cce1286aba72447c973a740000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000002e516d524150736f765962614637327854704d785361385171326573527055773378776d6434546e4e694a72784e3400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000";

// Get function selector
const functionSelector = inputData.slice(0, 10);
console.log("Function Selector:", functionSelector);

// Common function selectors in the contract
const knownFunctions = {
  "0x7f70aae9": "addPrivacyBatch(string,bytes32,uint256,bytes32,bytes[8])",
  "0x12345678": "addBatch(string,bytes32)",
};

if (knownFunctions[functionSelector]) {
  console.log("Function Called:", knownFunctions[functionSelector]);
  console.log("✅ This is a PRIVACY/ANONYMOUS submission!");
} else {
  console.log("Unknown function, checking ABI...");
}

// Decode the parameters
console.log("\n📋 Input Data Analysis:");
console.log("Function selector:", functionSelector);
console.log("Data length:", inputData.length);
console.log("This appears to be addPrivacyBatch() - requires zkSNARK proof!");

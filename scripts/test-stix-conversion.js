// scripts/test-stix-conversion.js
const { STIXConverter } = require("./stix-utils");
const fs = require("fs");

async function main() {
    console.log("=== Testing STIX 2.1 Conversion ===\n");

    // Sample IOC dataset (same format you've been using)
    const flatIOCs = [
        "malicious-apt.com",
        "192.168.100.50",
        "a1b2c3d4e5f67890abcdef1234567890",
        "phishing-site.org",
        "deadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcdef"
    ];

    const metadata = {
        source: "Security Research Lab",
        confidence: "high",
        description: "APT29 infrastructure indicators",
        tags: ["apt29", "malware", "infrastructure"]
    };

    console.log("1. Converting flat IOCs to STIX 2.1...");
    console.log("Input IOCs:", flatIOCs);

    // Convert to STIX
    const stixBundle = STIXConverter.convertToSTIX(flatIOCs, metadata);
    
    console.log("\n2. Generated STIX Bundle:");
    console.log(JSON.stringify(stixBundle, null, 2));

    // Validate STIX objects
    console.log("\n3. Validating STIX objects...");
    let validCount = 0;
    stixBundle.objects.forEach((obj, index) => {
        const validation = STIXConverter.validateSTIX(obj);
        if (validation.valid) {
            validCount++;
            console.log(`  ✅ Object ${index} (${obj.type}): VALID`);
        } else {
            console.log(`  ❌ Object ${index}: ${validation.error}`);
        }
    });
    console.log(`Total valid objects: ${validCount}/${stixBundle.objects.length}`);

    // Test reverse conversion
    console.log("\n4. Testing reverse conversion...");
    const extractedIOCs = STIXConverter.extractIOCsFromSTIX(stixBundle);
    console.log("Extracted IOCs:", extractedIOCs);
    
    // Verify round-trip
    const matches = extractedIOCs.every(ioc => flatIOCs.includes(ioc));
    console.log(`Round-trip conversion: ${matches ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Save STIX bundle for inspection
    fs.writeFileSync("stix-sample.json", JSON.stringify(stixBundle, null, 2));
    console.log("\n📄 STIX bundle saved to stix-sample.json");
}

main().catch(console.error);

#!/usr/bin/env python3
# Fix line 959 in IOCSubmissionForm.jsx to add L2 network check

with open('cti-frontend/components/IOCSubmissionForm.jsx', 'r') as f:
    lines = f.readlines()

# Line 959 (0-indexed = 958)
OLD = "                        {!isRegistered ? 'Register first to unlock' : 'Groth16 proof generated in browser'}"
NEW = "                        {!isRegistered ? 'Register first to unlock' : currentNetwork?.chainId !== 421614 ? 'Switch to Arbitrum L2 (affordable gas)' : 'Groth16 proof generated in browser'}"

if lines[958].rstrip() == OLD:
    lines[958] = NEW + '\n'
    with open('cti-frontend/components/IOCSubmissionForm.jsx', 'w') as f:
        f.writelines(lines)
    print('✅ Line 959 updated successfully')
else:
    print('❌ Line does not match')
    print('Expected:', repr(OLD))
    print('Found:', repr(lines[958].rstrip()))

#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "📊 SMART CONTRACT ANALYSIS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

for contract in contracts/*.sol; do
  if [ -f "$contract" ]; then
    name=$(basename "$contract")
    lines=$(wc -l < "$contract")
    functions=$(grep -c "function " "$contract")
    events=$(grep -c "event " "$contract")
    modifiers=$(grep -c "modifier " "$contract")
    
    echo "📜 $name"
    echo "   Lines:     $lines"
    echo "   Functions: $functions"
    echo "   Events:    $events"
    echo "   Modifiers: $modifiers"
    echo "   Key Functions:"
    grep "function " "$contract" | head -5 | sed 's/^/      /'
    echo ""
  fi
done

echo "═══════════════════════════════════════════════════════════════"

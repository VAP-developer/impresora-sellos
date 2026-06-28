#!/usr/bin/env python3
import subprocess
import sys
import os

PRINTER = os.environ.get('PRINTER_1', 'Brother_4520_1')

try:
    result = subprocess.run(
        ["cupsdisable", "-r", "Pausada por el usuario", PRINTER],
        capture_output=True, text=True, timeout=10
    )
    if result.returncode == 0:
        print("Impresora pausada")
    else:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)

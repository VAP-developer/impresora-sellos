#!/usr/bin/env python3
import subprocess
import os

printer = os.environ.get('PRINTER_1', 'Brother_4520_1')

subprocess.call(["cupsdisable", "-r", "Pausada por el usuario", printer])
print("Spool desactivado")

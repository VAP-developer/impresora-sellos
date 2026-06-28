#!/usr/bin/env python3
import subprocess
import os

printer = os.environ.get('PRINTER_1', 'Brother_4520_1')

subprocess.call(["cupsenable", printer])
print("Spool activado")

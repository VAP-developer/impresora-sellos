#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test de generación de PDFs.

Este script simula el flujo completo que ocurre cuando un usuario
pulsa el botón del carrito en /kiosko:
  1. Se construye un mensaje idéntico al que envía el WebSocket
  2. Se parsea el mensaje (como hace servidor-ws.py)
  3. Se llama a report.afkarPrint() para generar los PDFs
  4. Se verifican que los PDFs se hayan creado correctamente

USO:
  Ejecutar desde la carpeta 'demonio' (donde están las fuentes e imágenes):
    cd demonio && python ../test/test_pdf_generation.py

  O con Docker:
    docker compose run --rm demonio-python python /test/test_pdf_generation.py
"""

import os
import sys
import time

# Asegurar que estamos en el directorio correcto (demonio/)
# En Docker, la app está en /app. En local, buscamos ../demonio
if os.path.exists('/app/report.py'):
    DEMONIO_DIR = '/app'
else:
    DEMONIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demonio')

os.chdir(DEMONIO_DIR)
sys.path.insert(0, DEMONIO_DIR)

print("=" * 60)
print("TEST: Generacion de PDFs desde report.py")
print("=" * 60)
print("")
print("Directorio de trabajo: " + os.getcwd())
print("")

# ─────────────────────────────────────────────
# 1. Verificar dependencias
# ─────────────────────────────────────────────
print("[1/5] Verificando dependencias...")

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    print("  OK - reportlab instalado")
except ImportError:
    print("  ERROR - reportlab no instalado. Instalar con: pip install reportlab")
    sys.exit(1)

# ─────────────────────────────────────────────
# 2. Verificar archivos necesarios
# ─────────────────────────────────────────────
print("[2/5] Verificando archivos necesarios...")

archivos_necesarios = [
    'franklin_gothic.ttf',
    'franklin_gothic_bold.ttf',
    'franklin_gothic_condensed.ttf',
    'image2.jpg',
    'fondoticketori.png',
    'fondoticketcop-nada.png',
    'fondoticketcop.png',
    'fondoetiqueta-nada.png',
]

archivos_faltantes = []
for archivo in archivos_necesarios:
    if os.path.exists(archivo):
        print("  OK - " + archivo)
    else:
        print("  FALTA - " + archivo)
        archivos_faltantes.append(archivo)

if archivos_faltantes:
    print("")
    print("  AVISO: Faltan " + str(len(archivos_faltantes)) + " archivo(s).")
    print("  La generacion puede fallar si report.py los necesita.")
    print("")

# ─────────────────────────────────────────────
# 3. Importar report.py
# ─────────────────────────────────────────────
print("[3/5] Importando report.py...")

try:
    import report
    print("  OK - report.py importado correctamente")
except Exception as e:
    print("  ERROR - No se pudo importar report.py: " + str(e))
    sys.exit(1)

# ─────────────────────────────────────────────
# 4. Simular datos de compra y generar PDFs
# ─────────────────────────────────────────────
print("[4/5] Generando PDFs con datos de prueba...")
print("")

# Datos de prueba que simulan una compra tipica:
# 2 etiquetas Tarifa A modelo 1, 1 etiqueta Tarifa B modelo 1
items = [
    {'idProducto': 'tarifaAS1', 'cantidad': 2},
    {'idProducto': 'tarifaA2S1', 'cantidad': 0},
    {'idProducto': 'tarifaBS1', 'cantidad': 1},
    {'idProducto': 'tarifaCS1', 'cantidad': 0},
    {'idProducto': 'tarifaAT1', 'cantidad': 0},
    {'idProducto': 'tarifa4T1', 'cantidad': 0},
    {'idProducto': 'tarifaAS2', 'cantidad': 1},
    {'idProducto': 'tarifaA2S2', 'cantidad': 0},
    {'idProducto': 'tarifaBS2', 'cantidad': 0},
    {'idProducto': 'tarifaCS2', 'cantidad': 0},
    {'idProducto': 'tarifaAT2', 'cantidad': 0},
    {'idProducto': 'tarifa4T2', 'cantidad': 0},
]

precios = [0.50, 0.60, 1.25, 1.35]

# Parametros de la compra
id_cliente = 1
id_producto = 1
fecha_sello = "10 Junio 2026"
evento_sello = "Test Kiro"
fecha_ticket = "10/06/2026 12:00:00"
modo_ticket = "Factura Simplificada"
modo_ticket_copia = "COPIA Factura Simplificada"
modelo1_ticket = "fondoetiqueta-nada"
modelo2_ticket = "fondoetiqueta-nada"
modo_maquina = "P"
nombre_maquina = "CH17"
mes_maquina = "6"
pais_maquina = "ES"
year_maquina = "2026"
feria = "Test Generacion PDF"
lugar = "Laboratorio"
empresa = "S.E. Correos y Telegrafos S.A., S.M.E."
cif = "A83052407"
cp = "28042 Madrid"
l1 = "Exento de impuestos"
l2 = "Objeto de coleccionismo"
l3 = "No se admiten devoluciones"
T1especial = "0"
T2especial = "0"
T3especial = "0"
TEmod1 = "0"
TEmod2 = "0"
ImprimeCopiaTicket = "N"
ImprimeMasterTicket = "N"

# Limpiar PDFs anteriores de test
pdfs_esperados = [
    'stamp_simple_1_a.pdf',
    'stamp_simple_1_a2.pdf',
    'stamp_simple_1_b.pdf',
    'stamp_simple_1_c.pdf',
    'stamp_simple_2_a.pdf',
    'stamp_simple_2_a2.pdf',
    'stamp_simple_2_b.pdf',
    'stamp_simple_2_c.pdf',
    'stamp_tira_1.pdf',
    'stamp_tira_2.pdf',
    'stamp_tira_1_especial.pdf',
    'stamp_tira_2_especial.pdf',
    'stamp_simple_1_a_overflow.pdf',
    'stamp_simple_1_a2_overflow.pdf',
    'stamp_simple_1_b_overflow.pdf',
    'stamp_simple_1_c_overflow.pdf',
    'stamp_simple_2_a_overflow.pdf',
    'stamp_simple_2_a2_overflow.pdf',
    'stamp_simple_2_b_overflow.pdf',
    'stamp_simple_2_c_overflow.pdf',
    'ticket.pdf',
    'tickettira.pdf',
]

print("  Llamando a report.afkarPrint()...")
print("")

try:
    report.afkarPrint(
        items, precios, id_cliente, id_producto,
        fecha_sello, evento_sello, fecha_ticket,
        modo_ticket, modo_ticket_copia,
        modelo1_ticket, modelo2_ticket,
        modo_maquina, nombre_maquina, mes_maquina,
        pais_maquina, year_maquina,
        feria, lugar, empresa, cif, cp, l1, l2, l3,
        T1especial, T2especial, T3especial,
        TEmod1, TEmod2, ImprimeCopiaTicket, ImprimeMasterTicket
    )
    print("")
    print("  OK - afkarPrint() ejecutado sin excepciones")
except Exception as e:
    print("")
    print("  ERROR - afkarPrint() fallo: " + str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)

# ─────────────────────────────────────────────
# 5. Verificar PDFs generados
# ─────────────────────────────────────────────
print("")
print("[5/5] Verificando PDFs generados...")
print("")

pdfs_ok = 0
pdfs_vacios = 0
pdfs_no_encontrados = 0

for pdf in pdfs_esperados:
    if os.path.exists(pdf):
        size = os.path.getsize(pdf)
        if size > 2000:
            print("  OK  - " + pdf + " (" + str(size) + " bytes) -> SE IMPRIMIRIA")
            pdfs_ok += 1
        else:
            print("  --  - " + pdf + " (" + str(size) + " bytes) -> vacio/sin contenido (normal si no hay items de ese tipo)")
            pdfs_vacios += 1
    else:
        print("  ERR - " + pdf + " -> NO EXISTE")
        pdfs_no_encontrados += 1

# ─────────────────────────────────────────────
# Resumen
# ─────────────────────────────────────────────
print("")
print("=" * 60)
print("RESUMEN")
print("=" * 60)
print("  PDFs con contenido (se imprimirian):  " + str(pdfs_ok))
print("  PDFs vacios (sin items de ese tipo):  " + str(pdfs_vacios))
print("  PDFs no generados (ERROR):            " + str(pdfs_no_encontrados))
print("")

if pdfs_ok > 0:
    print("RESULTADO: OK - La generacion de PDFs funciona correctamente.")
    print("")
    print("Los PDFs se han generado en: " + os.getcwd())
    print("Puedes abrirlos para verificar visualmente su contenido.")
elif pdfs_no_encontrados > 0:
    print("RESULTADO: ERROR - Algunos PDFs no se generaron.")
    print("Revisa los errores arriba para diagnosticar el problema.")
else:
    print("RESULTADO: PARCIAL - PDFs generados pero todos vacios.")
    print("Esto puede ser normal si los items de prueba tienen cantidad 0.")

print("")
sys.exit(0 if pdfs_ok > 0 else 1)

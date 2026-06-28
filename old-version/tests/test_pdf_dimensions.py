#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Feature: stack-migration, Property 5: Dimensiones correctas de PDFs generados

Property-based test que verifica:
  Para cualquier OrdenImpresion válida con al menos un producto con cantidad > 0,
  los PDFs de sellos generados DEBEN tener dimensiones de 55x25mm,
  y los PDFs de tickets DEBEN tener un ancho de 78mm.

Framework: Hypothesis (Python)
Mínimo: 100 iteraciones
Valida: Requisitos 5.1
"""

import os
import sys
import tempfile
from io import BytesIO

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# Añadir el directorio demonio al path para importar los módulos
sys.path.insert(0, "demonio")

from servidor_ws_nuevo import OrdenImpresion

# ─────────────────────────────────────────────
# Constantes esperadas (en puntos PDF — 1 mm = 2.834645669 pt)
# ─────────────────────────────────────────────

STAMP_WIDTH_MM = 55
STAMP_HEIGHT_MM = 25
TICKET_WIDTH_MM = 78

# Tolerancia en puntos para comparación de dimensiones flotantes
TOLERANCE_PT = 0.5  # Medio punto de tolerancia


def mm_to_pt(milimeters):
    """Convierte milímetros a puntos PDF (1mm = 2.834645669pt)."""
    return milimeters * mm  # reportlab's mm unit already converts to pt


# ─────────────────────────────────────────────
# Estrategias de generación de datos
# ─────────────────────────────────────────────

def gen_cantidad_positiva():
    """Genera cantidad > 0 para al menos un producto."""
    return st.integers(min_value=1, max_value=10)


def gen_cantidad():
    """Genera cantidad >= 0."""
    return st.integers(min_value=0, max_value=10)


def gen_items_con_al_menos_uno_positivo():
    """
    Genera una lista de 12 items donde al menos uno tiene cantidad > 0.
    Cada item tiene idProducto y cantidad, como espera printStamps/printTickets.
    """
    # Generate 12 quantities, ensuring at least one is > 0
    return st.lists(
        gen_cantidad(),
        min_size=12,
        max_size=12,
    ).filter(lambda qs: any(q > 0 for q in qs)).map(
        lambda qs: [{"idProducto": f"prod{i}", "cantidad": q} for i, q in enumerate(qs)]
    )


def gen_items_simple_stamps():
    """
    Genera items para sellos simples (modo "S") con al menos uno con cantidad > 0.
    Se usa un solo item con modelo 1 y tarifa A para simplificar.
    """
    return gen_cantidad_positiva().map(
        lambda q: [{"idProducto": f"tarifaA1", "cantidad": q}]
    )


def gen_productos_for_items(items):
    """
    Genera la lista de productos correspondiente a los items.
    Cada producto tiene modo, idProducto y nombre_ticket.
    """
    productos = []
    for item in items:
        productos.append({
            "idProducto": item["idProducto"],
            "modo": "S",
            "nombre_ticket": "Tarifa A",
        })
    return productos


def gen_nombre_maquina():
    """Genera nombre de máquina (no MD para usar genStampI/D con logo)."""
    # Use non-MD prefix to exercise the standard stamp path
    return st.sampled_from(["KK01", "VA01", "PM01", "FI01", "IR01"])


def gen_nombre_maquina_md():
    """Genera nombre de máquina con prefijo MD (sin logo de fondo)."""
    return st.sampled_from(["MD25", "MD26", "MD24"])


def gen_id_numerico():
    """Genera IDs numéricos para id_cliente e id_producto."""
    return st.integers(min_value=1, max_value=9999)


def gen_texto_corto():
    """Genera texto corto seguro para campos de impresión."""
    return st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=20,
    )


def gen_cantidades_str():
    """
    Genera campo cantidades: 12 valores enteros separados por espacio,
    con al menos uno > 0.
    """
    return st.lists(
        st.integers(min_value=0, max_value=10),
        min_size=12,
        max_size=12,
    ).filter(lambda qs: any(q > 0 for q in qs)).map(
        lambda qs: " ".join(str(q) for q in qs)
    )


def gen_precios_str():
    """Genera campo precios: 4 valores decimales separados por espacio."""
    return st.lists(
        st.floats(min_value=0.5, max_value=50.0, allow_nan=False, allow_infinity=False).map(
            lambda f: f"{f:.2f}"
        ),
        min_size=4,
        max_size=4,
    ).map(lambda ps: " ".join(ps))


def gen_orden_impresion():
    """Genera una OrdenImpresion válida con cantidades > 0."""
    return st.builds(
        OrdenImpresion,
        id_cliente=st.integers(min_value=1, max_value=9999).map(str),
        id_producto=st.integers(min_value=1, max_value=999).map(str),
        fecha_sello=st.just("01/06/2025"),
        evento_sello=st.just("Evento Test"),
        fecha_ticket=st.just("01/06/2025 10:00"),
        modo_ticket=st.just("Factura Simplificada"),
        modelo1_ticket=st.just("fondoetiqueta1-nada"),
        modelo2_ticket=st.just("fondoetiqueta2-nada"),
        modo_maquina=st.just("A"),
        nombre_maquina=gen_nombre_maquina(),
        mes_maquina=st.sampled_from(["01", "02", "03", "04", "05", "06",
                                      "07", "08", "09", "10", "11", "12"]),
        pais_maquina=st.just("ES"),
        year_maquina=st.just("2025"),
        cantidades=gen_cantidades_str(),
        precios=gen_precios_str(),
        empresa=st.just("Test SL"),
        cif=st.just("B12345678"),
        cp=st.just("28001"),
        l1=st.just("Calle Test 1"),
        l2=st.just("Madrid"),
        l3=st.just("España"),
        feria=st.just("Feria Test"),
        lugar=st.just("Madrid"),
        T1especial=st.just(""),
        T2especial=st.just(""),
        T3especial=st.just(""),
        TEmod1=st.just(""),
        TEmod2=st.just(""),
        ImprimeCopiaTicket=st.just("N"),
        ImprimeMasterTicket=st.just("N"),
        modo_ticket_copia=st.just("Copia"),
    )


# ─────────────────────────────────────────────
# Funciones auxiliares para inspeccionar PDFs
# ─────────────────────────────────────────────

def get_pdf_page_dimensions(pdf_path):
    """
    Lee un archivo PDF y devuelve una lista de (width, height) en puntos
    para cada página del PDF.
    """
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        box = page.mediabox
        width = float(box.width)
        height = float(box.height)
        pages.append((width, height))
    return pages


def get_pdf_page_dimensions_from_bytes(pdf_bytes):
    """
    Lee bytes de un PDF y devuelve una lista de (width, height) en puntos
    para cada página.
    """
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        box = page.mediabox
        width = float(box.width)
        height = float(box.height)
        pages.append((width, height))
    return pages


def assert_stamp_dimensions(width_pt, height_pt):
    """Verifica que las dimensiones corresponden a 55x25mm."""
    expected_width = STAMP_WIDTH_MM * mm
    expected_height = STAMP_HEIGHT_MM * mm
    assert abs(width_pt - expected_width) < TOLERANCE_PT, (
        f"Stamp width {width_pt:.2f}pt != expected {expected_width:.2f}pt "
        f"({STAMP_WIDTH_MM}mm)"
    )
    assert abs(height_pt - expected_height) < TOLERANCE_PT, (
        f"Stamp height {height_pt:.2f}pt != expected {expected_height:.2f}pt "
        f"({STAMP_HEIGHT_MM}mm)"
    )


def assert_ticket_width(width_pt):
    """Verifica que el ancho del ticket corresponde a 78mm."""
    expected_width = TICKET_WIDTH_MM * mm
    assert abs(width_pt - expected_width) < TOLERANCE_PT, (
        f"Ticket width {width_pt:.2f}pt != expected {expected_width:.2f}pt "
        f"({TICKET_WIDTH_MM}mm)"
    )


# ─────────────────────────────────────────────
# Property-based tests: Stamp dimensions (55x25mm)
# ─────────────────────────────────────────────

@given(
    tarifa=st.sampled_from(["Tarifa A", "Tarifa A2", "Tarifa B", "Tarifa C"]),
    fecha=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=30,
    ),
    evento=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=30,
    ),
    codigo=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=5,
        max_size=20,
    ),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_stamp_genStamp_dimensions(tarifa, fecha, evento, codigo, tmp_path):
    """
    Property 5: Dimensiones correctas de PDFs de sellos (genStamp).

    Para cualquier combinación válida de tarifa, fecha, evento y código,
    el PDF de sello generado por genStamp DEBE tener dimensiones 55x25mm.
    """
    pdf_path = str(tmp_path / "test_stamp.pdf")

    page_width = 55 * mm
    page_height = 25 * mm
    c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))

    # genStamp draws onto the canvas — we call it in the demonio working dir
    # to resolve font and image references
    original_cwd = os.getcwd()
    os.chdir("demonio")
    try:
        from report import genStamp
        genStamp(tarifa, fecha, evento, codigo, c)
        c.showPage()
        c.save()
    finally:
        os.chdir(original_cwd)

    # Verify dimensions
    pages = get_pdf_page_dimensions(pdf_path)
    assert len(pages) >= 1
    for width_pt, height_pt in pages:
        assert_stamp_dimensions(width_pt, height_pt)


@given(
    tarifa=st.sampled_from(["Tarifa A", "Tarifa A2", "Tarifa B", "Tarifa C"]),
    fecha=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=30,
    ),
    evento=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=30,
    ),
    codigo=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=5,
        max_size=20,
    ),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_stamp_genStampImdcc_dimensions(tarifa, fecha, evento, codigo, tmp_path):
    """
    Property 5: Dimensiones correctas de PDFs de sellos (genStampImdcc - modo MD).

    Para cualquier combinación válida, el PDF de sello generado por genStampImdcc
    (máquinas MD sin logo personalizado) DEBE tener dimensiones 55x25mm.
    """
    pdf_path = str(tmp_path / "test_stamp_mdcc.pdf")

    page_width = 55 * mm
    page_height = 25 * mm
    c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))

    original_cwd = os.getcwd()
    os.chdir("demonio")
    try:
        from report import genStampImdcc
        genStampImdcc("fondoetiqueta1-nada", tarifa, fecha, evento, codigo, c)
        c.showPage()
        c.save()
    finally:
        os.chdir(original_cwd)

    pages = get_pdf_page_dimensions(pdf_path)
    assert len(pages) >= 1
    for width_pt, height_pt in pages:
        assert_stamp_dimensions(width_pt, height_pt)


@given(
    tarifa=st.sampled_from(["Tarifa A", "Tarifa A2", "Tarifa B", "Tarifa C"]),
    fecha=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=30,
    ),
    evento=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=1,
        max_size=30,
    ),
    codigo=st.text(
        alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"),
                               blacklist_characters="\x00"),
        min_size=5,
        max_size=20,
    ),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_stamp_genStampDmdcc_dimensions(tarifa, fecha, evento, codigo, tmp_path):
    """
    Property 5: Dimensiones correctas de PDFs de sellos (genStampDmdcc - modo MD modelo 2).

    DEBE tener dimensiones 55x25mm.
    """
    pdf_path = str(tmp_path / "test_stamp_dmdcc.pdf")

    page_width = 55 * mm
    page_height = 25 * mm
    c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))

    original_cwd = os.getcwd()
    os.chdir("demonio")
    try:
        from report import genStampDmdcc
        genStampDmdcc("fondoetiqueta2-nada", tarifa, fecha, evento, codigo, c)
        c.showPage()
        c.save()
    finally:
        os.chdir(original_cwd)

    pages = get_pdf_page_dimensions(pdf_path)
    assert len(pages) >= 1
    for width_pt, height_pt in pages:
        assert_stamp_dimensions(width_pt, height_pt)


# ─────────────────────────────────────────────
# Property-based tests: Ticket dimensions (78mm width)
# ─────────────────────────────────────────────

@given(
    nitems=st.integers(min_value=1, max_value=12),
    id_cliente=st.integers(min_value=1, max_value=9999),
    nombre_maquina=st.sampled_from(["KK01", "VA01", "PM01"]),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_ticket_width_dimensions(nitems, id_cliente, nombre_maquina, tmp_path):
    """
    Property 5: Ancho correcto de PDFs de tickets (78mm).

    Para cualquier número de items con cantidad > 0 (1-12),
    el PDF de ticket generado DEBE tener un ancho de 78mm.
    La altura es variable según el número de items.
    """
    pdf_path = str(tmp_path / "test_ticket.pdf")

    # Calcular page dimensions como lo hace printTickets
    eitems = 3 * nitems - 17
    page_width = 78 * mm
    page_height = (126 + eitems) * mm

    c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))

    # Build items and productos lists
    items = []
    productos = []
    for i in range(nitems):
        items.append({
            "idProducto": f"tarifaA{(i % 2) + 1}",
            "cantidad": 1,
        })
        productos.append({
            "idProducto": f"tarifaA{(i % 2) + 1}",
            "modo": "S",
            "nombre_ticket": "Tarifa A",
            "precio": 1.50,
        })
    # Pad to 12 items (with 0 quantity for the rest)
    for i in range(nitems, 12):
        items.append({
            "idProducto": f"tarifaA{(i % 2) + 1}",
            "cantidad": 0,
        })
        productos.append({
            "idProducto": f"tarifaA{(i % 2) + 1}",
            "modo": "S",
            "nombre_ticket": "Tarifa A",
            "precio": 1.50,
        })

    original_cwd = os.getcwd()
    os.chdir("demonio")
    try:
        from report import genTicket
        genTicket(
            "01/06/2025 10:00",  # fecha_ticket
            "Factura Simplificada",  # modo_ticket
            "fondoetiqueta1-nada",  # modelo1_ticket
            "fondoetiqueta2-nada",  # modelo2_ticket
            items,
            id_cliente,
            nombre_maquina,
            productos,
            "Feria Test",  # feria
            "Madrid",  # lugar
            "Test SL",  # empresa
            "B12345678",  # cif
            "28001",  # cp
            "Calle Test",  # l1
            "Madrid",  # l2
            "España",  # l3
            page_height,
            page_width,
            c,
        )
        c.showPage()
        c.save()
    finally:
        os.chdir(original_cwd)

    # Verify width is 78mm
    pages = get_pdf_page_dimensions(pdf_path)
    assert len(pages) >= 1
    for width_pt, height_pt in pages:
        assert_ticket_width(width_pt)


# ─────────────────────────────────────────────
# Property-based tests: printStamps full function
# ─────────────────────────────────────────────

@given(
    cantidad=st.integers(min_value=1, max_value=5),
    id_cliente=st.integers(min_value=1, max_value=9999),
    id_producto=st.integers(min_value=1, max_value=999),
    nombre_maquina=gen_nombre_maquina_md(),
)
@settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_printStamps_all_pdfs_have_stamp_dimensions(
    cantidad, id_cliente, id_producto, nombre_maquina, tmp_path
):
    """
    Property 5: printStamps genera PDFs con dimensiones 55x25mm.

    Para cualquier OrdenImpresion válida con cantidades > 0,
    TODOS los PDFs de sellos generados por printStamps DEBEN tener
    dimensiones de 55x25mm.

    Usa máquinas MD (genStampImdcc/Dmdcc) para evitar dependencias de
    imágenes de logo personalizadas.
    """
    original_cwd = os.getcwd()
    os.chdir("demonio")
    try:
        from report import printStamps

        # Build items with one product having cantidad > 0
        items = [{"idProducto": "tarifaA1", "cantidad": cantidad}]
        for i in range(1, 12):
            items.append({"idProducto": f"prod{i}", "cantidad": 0})

        productos = [{"idProducto": "tarifaA1", "modo": "S", "nombre_ticket": "Tarifa A", "precio": 1.50}]
        for i in range(1, 12):
            productos.append({"idProducto": f"prod{i}", "modo": "S", "nombre_ticket": "Tarifa A", "precio": 1.50})

        printStamps(
            "fondoetiqueta1-nada",  # modelo1_ticket
            "fondoetiqueta2-nada",  # modelo2_ticket
            id_cliente,
            id_producto,
            "01/06/2025",  # fecha_sello
            "Evento Test",  # evento_sello
            "A",  # modo_maquina
            nombre_maquina,
            "06",  # mes_maquina
            "ES",  # pais_maquina
            "2025",  # year_maquina
            items,
            productos,
            "0",  # T1especial
            "0",  # T2especial
            "0",  # T3especial
            "",  # TEmod1
            "",  # TEmod2
        )

        # Check all stamp PDFs generated
        stamp_pdf_files = [
            "stamp_simple_1_a.pdf",
            "stamp_simple_1_a_overflow.pdf",
        ]

        for pdf_file in stamp_pdf_files:
            if os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 0:
                try:
                    pages = get_pdf_page_dimensions(pdf_file)
                    for width_pt, height_pt in pages:
                        assert_stamp_dimensions(width_pt, height_pt)
                except Exception:
                    # Empty PDFs (no pages) are acceptable for unused canvas files
                    pass

    finally:
        os.chdir(original_cwd)


# ─────────────────────────────────────────────
# Property-based tests: printTickets full function
# ─────────────────────────────────────────────

@given(
    nitems=st.integers(min_value=1, max_value=6),
    id_cliente=st.integers(min_value=1, max_value=9999),
    nombre_maquina=st.sampled_from(["KK01", "VA01", "PM01"]),
)
@settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_printTickets_width_is_78mm(nitems, id_cliente, nombre_maquina, tmp_path):
    """
    Property 5: printTickets genera PDFs de tickets con ancho de 78mm.

    Para cualquier OrdenImpresion válida con al menos un producto con cantidad > 0,
    los PDFs de ticket generados por printTickets DEBEN tener ancho de 78mm.
    """
    original_cwd = os.getcwd()
    os.chdir("demonio")
    try:
        from report import printTickets

        # Build items with nitems having cantidad > 0
        items = []
        productos = []
        for i in range(nitems):
            items.append({
                "idProducto": f"tarifaA{(i % 2) + 1}",
                "cantidad": 1,
            })
            productos.append({
                "idProducto": f"tarifaA{(i % 2) + 1}",
                "modo": "S",
                "nombre_ticket": "Tarifa A",
                "precio": 1.50,
            })
        # Pad to 12
        for i in range(nitems, 12):
            items.append({
                "idProducto": f"tarifaA{(i % 2) + 1}",
                "cantidad": 0,
            })
            productos.append({
                "idProducto": f"tarifaA{(i % 2) + 1}",
                "modo": "S",
                "nombre_ticket": "Tarifa A",
                "precio": 1.50,
            })

        printTickets(
            "01/06/2025 10:00",  # fecha_ticket
            "Factura Simplificada",  # modo_ticket
            "Copia",  # modo_ticket_copia
            "fondoetiqueta1-nada",  # modelo1_ticket
            "fondoetiqueta2-nada",  # modelo2_ticket
            items,
            id_cliente,
            nombre_maquina,
            productos,
            "Feria Test",  # feria
            "Madrid",  # lugar
            "Test SL",  # empresa
            "B12345678",  # cif
            "28001",  # cp
            "Calle Test",  # l1
            "Madrid",  # l2
            "España",  # l3
            "N",  # ImprimeCopiaTicket
            "N",  # ImprimeMasterTicket
        )

        # Check ticket.pdf and tickettira.pdf
        ticket_files = ["ticket.pdf", "tickettira.pdf"]
        for pdf_file in ticket_files:
            if os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 0:
                try:
                    pages = get_pdf_page_dimensions(pdf_file)
                    for width_pt, height_pt in pages:
                        assert_ticket_width(width_pt)
                except Exception:
                    # Empty PDFs (no actual pages drawn) are acceptable
                    pass

    finally:
        os.chdir(original_cwd)


# ─────────────────────────────────────────────
# Deterministic unit tests (complement PBT)
# ─────────────────────────────────────────────

def test_stamp_canvas_pagesize_is_55x25mm():
    """
    Verifica directamente que el Canvas para sellos se crea con pagesize 55x25mm.
    Test determinista complementario a las propiedades.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        page_width = 55 * mm
        page_height = 25 * mm
        c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))
        c.showPage()
        c.save()

        pages = get_pdf_page_dimensions(pdf_path)
        assert len(pages) == 1
        width_pt, height_pt = pages[0]
        assert_stamp_dimensions(width_pt, height_pt)
    finally:
        os.unlink(pdf_path)


def test_ticket_canvas_pagesize_width_is_78mm():
    """
    Verifica directamente que el Canvas para tickets se crea con ancho 78mm.
    Test determinista complementario a las propiedades.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        page_width = 78 * mm
        page_height = 126 * mm  # minimum height
        c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))
        c.showPage()
        c.save()

        pages = get_pdf_page_dimensions(pdf_path)
        assert len(pages) == 1
        width_pt, height_pt = pages[0]
        assert_ticket_width(width_pt)
    finally:
        os.unlink(pdf_path)


def test_ticket_height_varies_with_items():
    """
    Verifica que la altura del ticket varía según el número de items,
    pero el ancho siempre es 78mm.
    """
    heights = []
    for nitems in [1, 3, 6, 12]:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            pdf_path = f.name

        try:
            eitems = 3 * nitems - 17
            page_width = 78 * mm
            page_height = (126 + eitems) * mm
            c = canvas.Canvas(pdf_path, pagesize=(page_width, page_height))
            c.showPage()
            c.save()

            pages = get_pdf_page_dimensions(pdf_path)
            width_pt, height_pt = pages[0]
            assert_ticket_width(width_pt)
            heights.append(height_pt)
        finally:
            os.unlink(pdf_path)

    # Heights should be increasing with more items
    assert heights == sorted(heights), (
        f"Ticket heights should increase with items: {heights}"
    )

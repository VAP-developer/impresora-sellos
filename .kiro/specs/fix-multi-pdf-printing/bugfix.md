# Bugfix Requirements Document

## Introduction

La función `generateSalePdfs` en `pdf-generator.ts` no genera correctamente los PDFs para la impresión. El comportamiento deseado es que cada tipo de producto (sellos simples, tiras, tickets) genere **1 único PDF** por grupo/tipo, donde el número de corte define dónde la impresora debe cortar el papel entre unidades. Actualmente los sellos simples no se agrupan por `cutNumber`, las tiras generan un PDF separado por cada unidad individual, y los tickets generan múltiples PDFs separados.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a sale includes simple stamps (sellos sueltos) THEN the system generates a single PDF with ALL stamps without any cut mark grouping, regardless of the configured `cutNumber`

1.2 WHEN a sale includes multiple units of the same strip type (e.g., 5 units of Tira A of 3 stamps each) THEN the system generates 5 separate PDFs (one per unit), instead of consolidating all 15 stamps into a single PDF with cut marks every 3 stamps

1.3 WHEN a sale includes multiple ticket types (factura simplificada, copia, master, tickets individuales por tira) THEN the system generates multiple separate PDFs (one per ticket type/unit), instead of consolidating all ticket pages into a single PDF

### Expected Behavior (Correct)

2.1 WHEN a sale includes simple stamps (sellos sueltos) for a given tariff/model THEN the system SHALL generate exactly 1 PDF containing all stamps of that tariff/model, where the printer cuts every `cutNumber` stamps (the `cutNumber` comes from the application configuration, range 2-16)

2.2 WHEN a sale includes N units of the same strip type (tira) with S stamps per strip THEN the system SHALL generate exactly 1 PDF containing N×S total pages (all units concatenated), where the printer cuts every S stamps (the strip's own size defines the cut interval)

2.3 WHEN a sale includes tickets THEN the system SHALL generate a single PDF containing all ticket pages concatenated (factura simplificada + copia + master + tickets individuales por tira), where the printer cuts every 1 page (cut size = 1)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a sale includes different strip types (e.g., Tira A of 3 stamps and Tira B of 6 stamps) THEN the system SHALL CONTINUE TO generate separate PDFs per strip type (1 PDF for all Tira A units, 1 PDF for all Tira B units), never mixing different strip types in the same PDF

3.2 WHEN a sale includes simple stamps of different tariffs/models THEN the system SHALL CONTINUE TO generate separate PDFs per tariff/model combination (each tariff/model has its own PDF)

3.3 WHEN strips are assigned to different printers (modelo1 → printer1, modelo2 → printer2) THEN the system SHALL CONTINUE TO generate separate PDFs per printer target, even for the same strip type

3.4 WHEN special strips (tiras especiales) are enabled THEN the system SHALL CONTINUE TO generate them as part of the stamp output (separate from regular strips)

---

### Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SaleInput
  OUTPUT: boolean
  
  // Bug 1: simple stamps don't respect cutNumber (all in one PDF without cut marks)
  CONDITION_1 := X.isSimpleStamp = true AND X.quantity > 0
  
  // Bug 2: strips generate N separate PDFs instead of 1 consolidated PDF per type
  CONDITION_2 := X.isStrip = true AND X.unitCount > 1
  
  // Bug 3: tickets generate multiple separate PDFs instead of 1 consolidated PDF
  CONDITION_3 := X.hasTickets = true AND X.expectedTicketPages > 1
  
  RETURN CONDITION_1 OR CONDITION_2 OR CONDITION_3
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property 1: Simple stamps — 1 PDF per tariff/model, cut every cutNumber
FOR ALL X WHERE X.isSimpleStamp = true AND X.quantity > 0 DO
  result ← generateSalePdfs'(X)
  simplePdfs ← result.pdfs WHERE pdfType = 'stamp_simple' AND target = X.target AND tariff = X.tariff
  ASSERT COUNT(simplePdfs) = 1
  ASSERT simplePdfs[0].pageCount = X.quantity
  ASSERT simplePdfs[0].cutInterval = X.cutNumber
END FOR

// Property 2: Strips — 1 PDF per strip type per model, cut every stripSize
FOR ALL X WHERE X.isStrip = true AND X.unitCount > 0 DO
  result ← generateSalePdfs'(X)
  stripPdfs ← result.pdfs WHERE pdfType = 'stamp_tira' AND stripType = X.stripType AND target = X.target
  ASSERT COUNT(stripPdfs) = 1
  ASSERT stripPdfs[0].pageCount = X.unitCount × X.stripSize
  ASSERT stripPdfs[0].cutInterval = X.stripSize
END FOR

// Property 3: Tickets — 1 PDF total, cut every 1 page
FOR ALL X WHERE X.hasTickets = true DO
  result ← generateSalePdfs'(X)
  ticketPdfs ← result.pdfs WHERE target = 'ticket'
  ASSERT COUNT(ticketPdfs) = 1
  ASSERT ticketPdfs[0].pageCount = totalExpectedTicketPages(X)
  ASSERT ticketPdfs[0].cutInterval = 1
END FOR
```

### Property: Preservation Checking

```pascal
// Preservation: Different strip types remain in separate PDFs
FOR ALL sales WITH multiple strip types DO
  result ← generateSalePdfs'(sale)
  FOR EACH stripType IN sale.stripTypes DO
    FOR EACH model IN [1, 2] DO
      stripPdfs ← result.pdfs WHERE stripType = stripType AND model = model
      ASSERT COUNT(stripPdfs) <= 1
    END FOR
  END FOR
END FOR
```

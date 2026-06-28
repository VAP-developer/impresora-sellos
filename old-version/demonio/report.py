#!/usr/bin/env python
# -*- coding: utf-8 -*-

# ANDORRA

# FICHEROS CON MODIFICACIONES PARA TARIFAS A-B-C-D: IMPRIMIR.HTML Y KIOSKO.HTML

import os

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from decimal import Decimal

# ─────────────────────────────────────────────
# Rutas base para recursos (fuentes, imágenes, PDFs de salida)
# ─────────────────────────────────────────────
_BASEDIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(_BASEDIR, "fonts")
IMAGES_DIR = os.path.join(_BASEDIR, "images")
OUTPUT_DIR = os.path.join(_BASEDIR, "output")


def _font(name):
    """Devuelve la ruta completa a un archivo de fuente."""
    return os.path.join(FONTS_DIR, name)


def _img(name):
    """Devuelve la ruta completa a un archivo de imagen."""
    return os.path.join(IMAGES_DIR, name)


def _output(name):
    """Devuelve la ruta completa a un archivo PDF de salida."""
    return os.path.join(OUTPUT_DIR, name)
	

def drawLogo(img, img_width, y, page_width, c):
	c.drawImage(img, (page_width - img_width)/2, y, width=img_width, preserveAspectRatio=True)

def drawfondo(img, img_width, y, page_width, c):
	c.drawImage(img, 5 * mm, y, width=img_width, preserveAspectRatio=True)	
# c.drawImage(img, coordenada x 5 * mm ....TICKET
def drawfondot(img, img_width, y, page_width, c):
	c.drawImage(img, 5 * mm, y, width=img_width, preserveAspectRatio=True, mask='auto')	
# c.drawImage(img, coordenada x 5 * mm ....TICKET


def drawfondoeti(img, img_width, y, page_width, c):
	c.drawImage(img, 0 * mm, y, width=img_width, preserveAspectRatio=True)

def drawTitle(text, font, fontSize, y, page_width, c):
	c.setFont(font, fontSize)
	text_width = stringWidth(text, font, fontSize)
	c.drawString((page_width - text_width)/2, y, text)

def drawTextRight(text, font, fontSize, x, y, c):
	c.setFont(font, fontSize)
	text_width = stringWidth(text, font, fontSize)
	print(text)
	c.drawString(x - text_width, y, text)

def drawText(text, font, fontSize, x, y, c):
	c.setFont(font, fontSize)
	c.drawString(x, y, text)

def drawMotives(y, motive1, motive2, firstLabelMotive1, lastLabelMotive1, firstLabelMotive2, lastLabelMotive2, page_width, c):
	font = "FranklinGothicCondensed"
	font_size = 8

	c.setFont(font, font_size)
	text_width_1 = stringWidth(motive1, font, font_size)
	text_width_2 = stringWidth(motive2, font, font_size)
	text_width_label = stringWidth("Etiquetas Números", font, font_size)

	font = "FranklinGothicBold"
	font_size = 7

	text_width_ids_1 = stringWidth(firstLabelMotive1 + " al " + lastLabelMotive1, font, font_size)
	text_width_ids_2 = stringWidth(firstLabelMotive2 + " al " + lastLabelMotive2, font, font_size)

	font = "FranklinGothicCondensed"
	font_size = 8
	c.setFont(font, font_size)

	c.drawString((page_width/2 - text_width_1)/2, y, motive1)
	c.drawString((page_width/2 - text_width_label)/2, y-3*mm, "Etiquetas Números")

	font = "FranklinGothicBold"
	font_size = 7
	c.setFont(font, font_size)

	c.drawString((page_width/2 - text_width_ids_1)/2, y-6*mm, firstLabelMotive1 + " al " + lastLabelMotive1)

	font = "FranklinGothicCondensed"
	font_size = 8
	c.setFont(font, font_size)

	c.drawString(page_width/2 + (page_width/2 - text_width_2)/2, y, motive2)
	c.drawString(page_width/2 + (page_width/2 - text_width_label)/2, y-3*mm, "Etiquetas Números")
	
	font = "FranklinGothicBold"
	font_size = 7
	c.setFont(font, font_size)
	
	c.drawString(page_width/2 + (page_width/2 - text_width_ids_2)/2, y-6*mm, firstLabelMotive2 + " al " + lastLabelMotive2)

def drawLine(x, y, width, c):
	c.setLineWidth(0.6)
	c.setDash(1.5,0.4)
	c.line(x, y, x+width, y)

def drawItem(y, itemName, quantity, price, total, c):
	drawText(itemName, "FranklinGothicCondensed", 8, 5*mm, y, c)
	drawTextRight(quantity, "FranklinGothicCondensed", 8, 50*mm, y, c)

	print(price)
	print(price.split('.'))
	print(len(price.split('.')[1]))
	if len(price.split('.')[1])<5:
		price = price[:-3] + '0' + '€'
	
	if len(total.split('.')[1])<5:
		total = total[:-3] + '0' + '€'

	drawTextRight(price, "FranklinGothicCondensed", 8, 62*mm, y, c)
	drawTextRight(total, "FranklinGothicCondensed", 8, 73*mm, y, c)

def drawItemCaja(y, itemName, quantity, price, total, c):
	drawText(itemName, "FranklinGothicCondensed", 8, 5*mm, y, c)
	drawTextRight(quantity, "FranklinGothicCondensed", 8, 50*mm, y, c)

	print(price)
	print(price.split('.'))
	print(len(price.split('.')[1]))
	if len(price.split('.')[1])<5:
		price = price[:-3] + '0' + '€'
	
	if len(total.split('.')[1])<5:
		total = total[:-3] + '0' + '€'

	drawTextRight(price, "FranklinGothicCondensed", 8, 62*mm, y, c)
	drawTextRight(total, "FranklinGothicCondensed", 8, 73*mm, y, c)


def drawTotal(y, quantity, total, c):
	drawText("Total:", "FranklinGothicCondensed", 8, 35*mm, y, c)
	drawTextRight(quantity, "FranklinGothicCondensed", 8, 50*mm, y, c)
	if len(total.split('.')[1])<5:
		total = total[:-3] + '0' + '€'
	
	drawTextRight(total, "FranklinGothicCondensed", 8, 73*mm, y, c)

def genTicket(fecha_ticket, modo_ticket, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_height, page_width, c):
	print("Printing ticket")
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))
	
	print("Fonts loaded")
     # Añadido:
     #------------------
	nitems = 0
	for index, item in enumerate(items):
		if item["cantidad"]>0:
			nitems = nitems + 1   #numero de items
	#ANULADO CAMBIOS
		# nitems = 12
	#Si necestias mas espacio abajo SUMAR. EJEMPLO eitmes = 3*items + 3   
	eitems = 3*nitems -12    #espacios necesarios	QUITADA 1 LINEA : eitems = 3*nitems -12
     #Cambios de medidas:
	c1 = 71 + eitems
	c2 = 86 + eitems
	c3 = 56 + eitems
	c4 = 51 + eitems
	c5 = 50 + eitems  
	drawLogo(_img("image2.jpg"), 30*mm, c1*mm, page_width, c)                                    #110
	drawTitle(feria, "FranklinGothicBold", 12, c2*mm, page_width, c) 
	drawfondot(_img("fondoticketori.png"), 20*mm, c5*mm - 10*mm, page_width, c)                      #125
	drawTitle(lugar, "FranklinGothicBold", 10, c2*mm - 6*mm, page_width, c)                #125
	drawTitle(empresa, "FranklinGothicBold", 7.5, c2*mm - 10*mm, page_width, c)            #125
	drawTitle(cif, "FranklinGothicBold", 7.5, c2*mm - 14*mm, page_width, c)                #125 
	drawTitle(cp, "FranklinGothicBold", 7.5, c2*mm - 18*mm, page_width, c)                 #125
	#----------------- ticket TRADUCCION 1/3
	drawTitle("Fecha", "FranklinGothicCondensed", 8, c2*mm - 22*mm, page_width, c)         #125 ESPAÑOL
	#drawTitle("Date", "FranklinGothicCondensed", 8, c2*mm - 22*mm, page_width, c)         #125 INGLES
	#drawTitle("Date", "FranklinGothicCondensed", 8, c2*mm - 22*mm, page_width, c)         #125 FRANCES
	#----------------- 
	drawTitle(fecha_ticket, "FranklinGothicCondensed", 8, c2*mm - 25*mm, page_width, c)    #125 
	drawText(modo_ticket, "FranklinGothicBold", 6.5, 5*mm, c3*mm, c)                        #95
	#----------------- ticket TRADUCCION 2/3
	drawText("Producto", "FranklinGothicCondensed", 8, 5*mm, c4*mm, c)                      #90 ESPAÑOL
	drawText("Cant.", "FranklinGothicCondensed", 8, 45*mm, c4*mm, c)                        #90 ESPAÑOL
	drawText("Precio", "FranklinGothicCondensed", 8, 55*mm, c4*mm, c)                       #90 ESPAÑOL
	drawText("Importe", "FranklinGothicCondensed", 8, 65*mm, c4*mm, c)                      #90 ESPAÑOL
	#drawText("Product", "FranklinGothicCondensed", 8, 5*mm, c4*mm, c)                      #90 INGLES
	#drawText("Units", "FranklinGothicCondensed", 8, 45*mm, c4*mm, c)                        #90 INGLES
	#drawText("Price", "FranklinGothicCondensed", 8, 55*mm, c4*mm, c)                       #90 INGLES
	#drawText("Amount", "FranklinGothicCondensed", 8, 65*mm, c4*mm, c)                      #90 INGLES
	#drawText("Produit", "FranklinGothicCondensed", 8, 5*mm, c4*mm, c)                      #90 FRANCES
	#drawText("Qté", "FranklinGothicCondensed", 8, 45*mm, c4*mm, c)                        #90 FRANCES
	#drawText("Prix", "FranklinGothicCondensed", 8, 55*mm, c4*mm, c)                       #90 FRANCES
	#drawText("Montant", "FranklinGothicCondensed", 8, 65*mm, c4*mm, c)                      #90 FRANCES

	drawLine(5*mm, c5*mm, page_width-2*5*mm, c)                                             #89 

	
	totalProductos = 0
	totalImporte = 0
	y = 46 + eitems                                                                         #82

	for index, item in enumerate(items):
		if item["cantidad"]>0:
			if item["idProducto"][-1:]=="1":
				modelo_ticket = modelo1_ticket
			else:
				modelo_ticket = modelo2_ticket

			totalProductos = totalProductos + item["cantidad"]
			totalImporte = totalImporte + item["cantidad"] * productos[index]["precio"]

			drawItem(y*mm, modelo_ticket + " " + productos[index]["nombre_ticket"], str(item["cantidad"]), str(productos[index]["precio"]) + "€", str(item["cantidad"] * productos[index]["precio"]) + "€", c)
			y = y - 3
	

	# SIGUIENTE LINEA  -12 : drawLine(30*mm, 46*mm, page_width-30*mm - 5*mm, c)	
	drawLine(30*mm, 34*mm, page_width-30*mm - 5*mm, c)
	# QUITADA LINEA -12: drawTotal(42*mm, str(totalProductos), str(totalImporte) + "€", c)
	drawTotal(30*mm, str(totalProductos), str(totalImporte) + "€", c)
	# SIGUIENTE LINEA ANULADA: eitems = 3*nitems -12
	# drawLine(5*mm, 38*mm, page_width-2*5*mm, c) 
		# drawMotives(34*mm, "Feria - Cibeles", "Feria - Caballo", "0361", "0480", "0364", "0483", page_width, c)
	drawLine(5*mm, 26*mm, page_width-2*5*mm, c)
	if id_cliente < 10:
		id_cliente = "000" + str(id_cliente)
	elif id_cliente < 100:
		id_cliente = "00" + str(id_cliente)
	elif id_cliente < 1000:
		id_cliente = "0" + str(id_cliente)
	elif id_cliente < 10000:
		id_cliente = "" + str(id_cliente)	
	print(nombre_maquina)
	print(id_cliente)
	#----------------- ticket TRADUCCION 3/3
	drawTitle("" + nombre_maquina +( " - Sesión: ") + id_cliente, "FranklinGothicCondensed", 9, 20*mm, page_width, c) # ESPAÑOL
	#drawTitle("" + nombre_maquina +( " - Session ID: ") + id_cliente, "FranklinGothicCondensed", 9, 20*mm, page_width, c) # INGLES
	#drawTitle("" + nombre_maquina +( " - Session: ") + id_cliente, "FranklinGothicCondensed", 9, 20*mm, page_width, c) # FRANCES

	drawTitle(l1, "FranklinGothicBold", 7.5, 13*mm, page_width, c)
	drawTitle(l2, "FranklinGothicBold", 7.5, 9*mm, page_width, c)
	drawTitle(l3, "FranklinGothicBold", 7.5, 5*mm, page_width, c)

# $$$$$$$$$$$$$$$$$$$$$$$ ----------------------------------------------------------------------
# TICKET CAJA
def genTicketCaja(fecha_ticket, modo_ticket, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_height, page_width, c):
	print("Printing ticket")
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))
	
	print("Fonts loaded")
     # Añadido:
     #------------------
	nitems = 0
	for index, item in enumerate(items):
		if item["cantidad"]>0:
			nitems = nitems + 1   #numero de items
	#ANULADO CAMBIOS
		# nitems = 12
	#Si necestias mas espacio abajo SUMAR. EJEMPLO eitmes = 3*items + 3   
	eitems = 3.5*nitems -12    #espacios necesarios	QUITADA 1 LINEA : eitems = 3*nitems -12
     #Cambios de medidas:
	c1 = 71 + eitems -6
	c2 = 86 + eitems -6
	c3 = 56 + eitems -6
	c4 = 51 + eitems -6
	c5 = 50 + eitems -6
	drawLogo(_img("image2.jpg"), 30*mm, c1*mm, page_width, c) 
                              #110
	drawTitle(feria, "FranklinGothicBold", 12, c2*mm, page_width, c)  
	#drawText("Xacobeo TIRA 4T:", "FranklinGothicBold", 12, 10*mm, c2*mm, c) 
	#drawLine(55*mm, c2*mm, page_width-55*mm - 5*mm, c)                      #125
	drawTitle(lugar, "FranklinGothicBold", 10, c2*mm - 6*mm, page_width, c)                #125
	#drawText("Xacobeo SPD:", "FranklinGothicBold", 12, 10*mm, c2*mm - 6*mm, c) 
	#drawLine(55*mm, c2*mm - 6*mm, page_width-55*mm - 5*mm, c) 
	drawTitle(empresa, "FranklinGothicBold", 7.5, c2*mm - 10*mm, page_width, c)            #125
	drawTitle(cif, "FranklinGothicBold", 7.5, c2*mm - 14*mm, page_width, c)               #125 
	drawTitle(cp, "FranklinGothicBold", 7.5, c2*mm - 18*mm, page_width, c)                 #125
	#----------------- TICKET caja solo ESPAÑOL TRADUCCION 1/3
	#drawTitle("Fecha", "FranklinGothicCondensed", 8, c2*mm - 22*mm, page_width, c)         #125
	drawTitle(fecha_ticket, "FranklinGothicCondensed", 8, c2*mm - 12*mm, page_width, c)
	drawfondot(_img("fondoticketcop-nada.png"), 20*mm, c5*mm - 10*mm, page_width, c) 
	    #125
	drawText(modo_ticket, "FranklinGothicBold", 6.5, 5*mm, c3*mm, c)  
	#drawText("Producto", "FranklinGothicCondensed", 8, 5*mm, c2*mm - 21*mm, c) 
	drawText("TARJETA P.:", "FranklinGothicBold", 12, 20*mm, c2*mm - 9*mm, c)                       #95
	drawLine(55*mm, c2*mm - 9*mm, page_width-55*mm - 5*mm, c) 
	drawText("TP TUSELLO:", "FranklinGothicBold", 12, 20*mm, c2*mm - 15*mm, c)                       #95
	drawLine(55*mm, c2*mm - 15*mm, page_width-55*mm - 5*mm, c) 

	drawText("ATM SOBRE:", "FranklinGothicBold", 12, 20*mm, c2*mm - 21*mm, c)                       #95
	drawLine(55*mm, c2*mm - 21*mm, page_width-55*mm - 5*mm, c) 
	drawText("ATM Tarifa A:", "FranklinGothicBold", 12, 20*mm, c2*mm - 27*mm, c)                       #95
	drawLine(55*mm, c2*mm - 27*mm, page_width-55*mm - 5*mm, c) 	
	#----------------- TICKET casa solo ESPAÑOL TRADUCCION 2/3
	drawText("Producto", "FranklinGothicCondensed", 8, 5*mm, c4*mm, c)                      #90
	drawText("Cantidad", "FranklinGothicCondensed", 8, 30*mm, c4*mm, c)                        #90
	#drawText("Precio", "FranklinGothicCondensed", 8, 55*mm, c4*mm, c)                       #90
	#drawText("Importe", "FranklinGothicCondensed", 8, 65*mm, c4*mm, c)                      #90
	drawLine(5*mm, c5*mm, page_width-2*5*mm, c)                                             #89 

	totalProductos = 0
	totalImporte = 0
	y = 46 + eitems -6                                                                     #82

	inicioMod2 = 0

	for index, item in enumerate(items):
		if item["cantidad"]>0:
			if item["idProducto"][-1:]=="1":
				modelo_ticket = modelo1_ticket
			else:
				if inicioMod2 == 0:
					y = y + 1.7
					drawLine(5*mm, y*mm, page_width-2*5*mm, c)
					inicioMod2=1
					y = y - 3.5

				modelo_ticket = modelo2_ticket

			totalProductos = totalProductos + item["cantidad"]
			totalImporte = totalImporte + item["cantidad"] * productos[index]["precio"]


			drawItemCaja(y*mm, modelo_ticket + " " + productos[index]["nombre_ticket"], str(item["cantidad"]), str(productos[index]["precio"]) + "€", str(item["cantidad"] * productos[index]["precio"]) + "€", c)
			#drawItem(y*mm, modelo_ticket + " " + productos[index]["nombre_ticket"], str(item["cantidad"]), "", "", c)
			#drawItem(y*mm, "" + " " + productos[index]["nombre_ticket"], str(item["cantidad"]), str(productos[index]["precio"]) + "€", str(item["cantidad"] * productos[index]["precio"]) + "€", c)
			y = y - 3.5
	
	# SIGUIENTE LINEA  -12 : drawLine(30*mm, 46*mm, page_width-30*mm - 5*mm, c)	
	drawLine(30*mm, 27*mm, page_width-30*mm - 5*mm, c)
	# QUITADA LINEA -12: drawTotal(42*mm, str(totalProductos), str(totalImporte) + "€", c)
	drawTotal(23*mm, str(totalProductos), str(totalImporte) + "€", c)
	# SIGUIENTE LINEA ANULADA: eitems = 3*nitems -12
	# drawLine(5*mm, 38*mm, page_width-2*5*mm, c) 
		# drawMotives(34*mm, "Feria - Cibeles", "Feria - Caballo", "0361", "0480", "0364", "0483", page_width, c)
	drawLine(5*mm, 21*mm, page_width-2*5*mm, c)
	if id_cliente < 10:
		id_cliente = "000" + str(id_cliente)
	elif id_cliente < 100:
		id_cliente = "00" + str(id_cliente)
	elif id_cliente < 1000:
		id_cliente = "0" + str(id_cliente)
	elif id_cliente < 10000:
		id_cliente = "" + str(id_cliente)	
	print(nombre_maquina)
	print(id_cliente)
	#----------------- TICKET caja solo ESPAÑOL TRADUCCION 3/3
	drawTitle("" + nombre_maquina +( " - Sesión: ") + id_cliente, "FranklinGothicBold", 7.5, 15*mm, page_width, c)
	
	drawTitle(l1, "FranklinGothicBold", 7.5, 13*mm, page_width, c)
	#drawTitle("PASE POR CAJA y ENTREGUE ESTE RESGUARDO", "FranklinGothicBold", 7.5, 13*mm, page_width, c)
	drawTitle(l2, "FranklinGothicBold", 7.5, 9*mm, page_width, c)
	drawTitle("PARA RECOGER SU PEDIDO", "FranklinGothicBold", 7.5, 9*mm, page_width, c)
	drawTitle(l3, "FranklinGothicBold", 7.5, 5*mm, page_width, c)
	#drawText("Producto", "FranklinGothicCondensed", 8, 5*mm, 5*mm, c) 
	drawTitle("PASE POR CAJA y ENTREGUE ESTE RESGUARDO", "FranklinGothicBold", 7.5, 5*mm, page_width, c)
# $$$$$$$$$$$$$$$$$$$$$$$ -------------------------------------------------------------------$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$---
# TICKET MASTER
def genTicketMaster(fecha_ticket, modo_ticket, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_height, page_width, c):
	print("Printing ticket")
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))
	
	print("Fonts loaded")
     # Añadido:
     #------------------
	nitems = 0
	for index, item in enumerate(items):
		if item["cantidad"]>0:
			nitems = nitems + 1   #numero de items
	#ANULADO CAMBIOS
		# nitems = 12
	#Si necestias mas espacio abajo SUMAR. EJEMPLO eitmes = 3*items + 3   
	eitems = 3.5*nitems -12    #espacios necesarios	QUITADA 1 LINEA : eitems = 3*nitems -12
     #Cambios de medidas:
	c1 = 71 + eitems -6
	c2 = 86 + eitems -6
	c3 = 56 + eitems 
	c4 = 51 + eitems -3
	c5 = 50 + eitems -6
	drawLogo(_img("image2.jpg"), 30*mm, c1*mm, page_width, c) 
	drawfondot(_img("fondoticketcop.png"), 70*mm, c1*mm - 45, page_width, c) 
                              #110
	drawTitle(feria, "FranklinGothicBold", 12, c2*mm, page_width, c)  
	drawTitle(lugar, "FranklinGothicBold", 10, c2*mm - 6*mm, page_width, c)                #125 
	drawTitle(empresa, "FranklinGothicBold", 7.5, c2*mm - 10*mm, page_width, c)            #125
	drawTitle(cif, "FranklinGothicBold", 7.5, c2*mm - 14*mm, page_width, c)               #125 
	drawTitle(cp, "FranklinGothicBold", 7.5, c2*mm - 18*mm, page_width, c)                 #125
	#----------------- TICKET caja solo ESPAÑOL TRADUCCION 1/3
	#drawTitle("Fecha", "FranklinGothicCondensed", 8, c2*mm - 22*mm, page_width, c)          #125
	drawTitle(fecha_ticket, "FranklinGothicCondensed", 8, c2*mm - 22*mm, page_width, c)    #125 
	drawText(modo_ticket, "FranklinGothicBold", 6.5, 5*mm, c3*mm - 6*mm, c)
	drawText("MASTER SET", "FranklinGothicBold", 9.5, 5*mm, c3*mm - 4*mm, c) # -3
		#drawTitle("MASTER SET", "FranklinGothicBold", 9.5, c3*mm - 6*mm, page_width, c)
	#drawText("Producto", "FranklinGothicCondensed", 8, 5*mm, c2*mm - 21*mm, c)  	
	#----------------- TICKET casa solo ESPAÑOL TRADUCCION 2/3
	drawText("Producto", "FranklinGothicCondensed", 8, 5*mm, c4*mm, c)                      #90 ESPAÑOL
	drawText("Cant.", "FranklinGothicCondensed", 8, 45*mm, c4*mm, c)                        #90 ESPAÑOL
	drawText("Precio", "FranklinGothicCondensed", 8, 55*mm, c4*mm, c)                       #90 ESPAÑOL
	drawText("Importe", "FranklinGothicCondensed", 8, 65*mm, c4*mm, c)                      #90
	drawLine(5*mm, c4*mm - 1*mm, page_width-2*5*mm, c)   # -0                                          #89 

	totalProductos = 0
	totalImporte = 0
	y = 43 + eitems #45
                                                                    #82

	inicioMod2 = 0

	for index, item in enumerate(items):
		if item["cantidad"]>0:
			if item["idProducto"][-1:]=="1":
				modelo_ticket = modelo1_ticket
			else:
				modelo_ticket = modelo2_ticket

			totalProductos = totalProductos + item["cantidad"]
			totalImporte = totalImporte + item["cantidad"] * productos[index]["precio"]


			drawItemCaja(y*mm, modelo_ticket + " Master Set", "1", "31.05€", "31.05€", c)
			#drawItem(y*mm, modelo_ticket + " " + productos[index]["nombre_ticket"], str(item["cantidad"]), "", "", c)
			#drawItem(y*mm, "" + " " + productos[index]["nombre_ticket"], str(item["cantidad"]), str(productos[index]["precio"]) + "€", str(item["cantidad"] * productos[index]["precio"]) + "€", c)
			y = y - 3
	
	# SIGUIENTE LINEA  -12 : drawLine(30*mm, 46*mm, page_width-30*mm - 5*mm, c)	
	drawLine(30*mm, 32*mm, page_width-30*mm - 5*mm, c)
	# QUITADA LINEA -12: drawTotal(42*mm, str(totalProductos), str(totalImporte) + "€", c)
	#					drawTotal(30*mm, str(totalProductos), str(totalImporte) + "€", c)
	# SIGUIENTE LINEA ANULADA: eitems = 3*nitems -12
	# drawLine(5*mm, 38*mm, page_width-2*5*mm, c) 
		# drawMotives(34*mm, "Feria - Cibeles", "Feria - Caballo", "0361", "0480", "0364", "0483", page_width, c)
	drawText("Total:     1", "FranklinGothicCondensed", 8, 40*mm, y*mm - 4*mm, c)                        # 090 ESPAÑOL                      #90 ESPAÑOL
	drawText("28.60€", "FranklinGothicCondensed", 8, 65*mm, y*mm - 4*mm, c)
	
	drawLine(5*mm, 26*mm, page_width-2*5*mm, c)
	if id_cliente < 10:
		id_cliente = "000" + str(id_cliente)
	elif id_cliente < 100:
		id_cliente = "00" + str(id_cliente)
	elif id_cliente < 1000:
		id_cliente = "0" + str(id_cliente)
	elif id_cliente < 10000:
		id_cliente = "" + str(id_cliente)	
	print(nombre_maquina)
	print(id_cliente)
	#----------------- TICKET caja solo ESPAÑOL TRADUCCION 3/3
	drawTitle("" + nombre_maquina +( " - Sesión: ") + id_cliente, "FranklinGothicCondensed", 9, 20*mm, page_width, c) # ESPAÑOL
	
	drawTitle(l1, "FranklinGothicBold", 7.5, 13*mm, page_width, c)
	drawTitle(l2, "FranklinGothicBold", 7.5, 9*mm, page_width, c)
	drawTitle(l3, "FranklinGothicBold", 7.5, 5*mm, page_width, c)

def genStamp(tarifa, fecha, evento, codigo, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm

	#new
	#drawfondoeti(_img("fondoetiqueta.png"), 55*mm, -45*mm, page_width, c) # irun p  ANTES -39 VALENCIA
	drawfondoeti(_img("fondoetiqueta-nada.png"), 55*mm, -41*mm, page_width, c)
	#drawText("Filatelia", "FranklinGothic", 12, 1.5*mm, 19.5*mm, c) 

	#original: drawText(tarifa, "FranklinGothic", 12, 1.5*mm, 19.5*mm, c)
	drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	drawText(fecha, "FranklinGothic", 9, 2*mm, 14*mm-3*mm, c)
	drawText(evento, "FranklinGothic", 9, 2*mm, 14*mm-7*mm, c)
	drawText(codigo, "FranklinGothic", 6, 2*mm, 12*mm-9*mm, c)


def genStampI(mod1, tarifa, fecha, evento, codigo, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm

	#new
	#drawfondoeti(_img("fondoetiqueta.png"), 55*mm, -45*mm, page_width, c) # irun -39 (VALENCIA -41) PM 2022 -38
	#drawfondoeti(_img("fondoetiqueta1.png"), 55*mm, -38*mm, page_width, c)

	#drawText("Filatelia", "FranklinGothic", 12, 1.5*mm, 19.5*mm, c) 
	drawfondoeti(_img(mod1 + ".png"), 55*mm, -38*mm, page_width, c)
		#original
	#drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	#drawText(fecha, "FranklinGothic", 9, 2*mm, 14*mm-3*mm, c)
	#drawText(evento, "FranklinGothic", 9, 2*mm, 14*mm-7*mm, c)
	#drawText(codigo, "FranklinGothic", 6, 2*mm, 12*mm-9*mm, c)

		#ETIQUETA HORIZONTAL localidad/fecha
	drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	drawTextRight(evento, "FranklinGothic", 9, 53*mm, 19*mm, c)
	drawTextRight(fecha, "FranklinGothic", 9, 53*mm, 15*mm, c)
	drawText(codigo, "FranklinGothic", 6, 2*mm, 15*mm, c)

def genStampD(mod2, tarifa, fecha, evento, codigo, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm
	#drawfondoeti(_img("fondoetiqueta2.png"), 55*mm, -38*mm, page_width, c)

	#new
	drawfondoeti(_img(mod2 + ".png"), 55*mm, -38*mm, page_width, c)
	# NO FUNCIONA: drawfondoeti(str(modelo2_ticket + '.png'), 55*mm, -38*mm, page_width, c)
	# NO FUNCIONA: mod2 = '"' + str(modelo2_ticket) + '.png' + '"'
	#mod2 = "fondoetiqueta2.png"
	#drawfondoeti(mod2, 55*mm, -38*mm, page_width, c)

	#drawfondoeti(_img("fondoetiqueta.png"), 55*mm, -45*mm, page_width, c) # irun -39 (VALENCIA -41) PM 2022 -38
	
	# NO FUNCIONA: drawfondoeti(('"'+modelo2_ticket+'.png"'), 55*mm, -38*mm, page_width, c)
	
	#drawText("Filatelia", "FranklinGothic", 12, 1.5*mm, 19.5*mm, c) 

		#original
	#drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	#drawText(fecha, "FranklinGothic", 9, 2*mm, 14*mm-3*mm, c)
	#drawText(evento, "FranklinGothic", 9, 2*mm, 14*mm-7*mm, c)
	#drawText(codigo, "FranklinGothic", 6, 2*mm, 12*mm-9*mm, c)

		#ETIQUETA HORIZONTAL localidad/fecha
	drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	drawTextRight(evento, "FranklinGothic", 9, 53*mm, 19*mm, c)
	drawTextRight(fecha, "FranklinGothic", 9, 53*mm, 15*mm, c)
	drawText(codigo, "FranklinGothic", 6, 2*mm, 15*mm, c)

def genStampImdcc(mod1, tarifa, fecha, evento, codigo, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm

	#new
	#drawfondoeti(_img("fondoetiqueta.png"), 55*mm, -45*mm, page_width, c) # irun -39 (VALENCIA -41) PM 2022 -38
	#drawfondoeti(_img("fondoetiqueta1.png"), 55*mm, -38*mm, page_width, c)

	#drawText("Filatelia", "FranklinGothic", 12, 1.5*mm, 19.5*mm, c) 
	drawfondoeti(_img("fondoetiqueta-nada.png"), 55*mm, -38*mm, page_width, c)
		#original
	#drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	#drawText(fecha, "FranklinGothic", 9, 2*mm, 14*mm-3*mm, c)
	#drawText(evento, "FranklinGothic", 9, 2*mm, 14*mm-7*mm, c)
	#drawText(codigo, "FranklinGothic", 6, 2*mm, 12*mm-9*mm, c)

		#ETIQUETA HORIZONTAL localidad/fecha
	drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	drawTextRight(evento, "FranklinGothic", 9, 53*mm, 19*mm, c)
	drawTextRight(fecha, "FranklinGothic", 9, 53*mm, 15*mm, c)
	drawText(codigo, "FranklinGothic", 6, 2*mm, 15*mm, c)

def genStampDmdcc(mod2, tarifa, fecha, evento, codigo, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm
	#drawfondoeti(_img("fondoetiqueta2.png"), 55*mm, -38*mm, page_width, c)

	#new
	drawfondoeti(_img("fondoetiqueta-nada.png"), 55*mm, -38*mm, page_width, c)
	# NO FUNCIONA: drawfondoeti(str(modelo2_ticket + '.png'), 55*mm, -38*mm, page_width, c)
	# NO FUNCIONA: mod2 = '"' + str(modelo2_ticket) + '.png' + '"'
	#mod2 = "fondoetiqueta2.png"
	#drawfondoeti(mod2, 55*mm, -38*mm, page_width, c)

	#drawfondoeti(_img("fondoetiqueta.png"), 55*mm, -45*mm, page_width, c) # irun -39 (VALENCIA -41) PM 2022 -38
	
	# NO FUNCIONA: drawfondoeti(('"'+modelo2_ticket+'.png"'), 55*mm, -38*mm, page_width, c)
	
	#drawText("Filatelia", "FranklinGothic", 12, 1.5*mm, 19.5*mm, c) 

		#original
	#drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	#drawText(fecha, "FranklinGothic", 9, 2*mm, 14*mm-3*mm, c)
	#drawText(evento, "FranklinGothic", 9, 2*mm, 14*mm-7*mm, c)
	#drawText(codigo, "FranklinGothic", 6, 2*mm, 12*mm-9*mm, c)

		#ETIQUETA HORIZONTAL localidad/fecha
	drawText(tarifa, "FranklinGothic", 12, 2*mm, 19.5*mm, c)
	drawTextRight(evento, "FranklinGothic", 9, 53*mm, 19*mm, c)
	drawTextRight(fecha, "FranklinGothic", 9, 53*mm, 15*mm, c)
	drawText(codigo, "FranklinGothic", 6, 2*mm, 15*mm, c)	
def genStampE1(codigo, esp, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm
	drawfondoeti(_img("TiraEspecial1.png"), 55*mm, -38*mm, page_width, c)
	drawText(codigo, "FranklinGothic", 6, 1.5*mm, 12*mm-10*mm, c)
	drawText(esp, "FranklinGothic", 6, 23.3*mm, 12*mm-10*mm, c)

#def genStampE2(tarifa, fecha, evento, codigo, esp, c):	

def genStampE2(tarifa, codigo, esp, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm
	drawfondoeti(_img("TiraEspecial2.png"), 55*mm, -38*mm, page_width, c)
	drawText(tarifa, "FranklinGothic", 12, 1.5*mm, 19.5*mm, c)
	#drawText(fecha, "FranklinGothic", 9, 1.5*mm, 14*mm-3*mm, c)
	#drawText(evento, "FranklinGothic", 9, 1.5*mm, 14*mm-7*mm, c)
	drawText(codigo, "FranklinGothic", 6, 1.5*mm, 12*mm-10*mm, c)
	drawText(esp, "FranklinGothic", 6, 23.3*mm, 12*mm-10*mm, c)

def genStampE3(tarifa, codigo, esp, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm
	drawfondoeti(_img("TiraEspecial3.png"), 55*mm, -38*mm, page_width, c)
	drawText(tarifa, "FranklinGothic", 12, 1.5*mm, 19.5*mm, c)
	#drawText(fecha, "FranklinGothic", 9, 1.5*mm, 14*mm-3*mm, c)
	#drawText(evento, "FranklinGothic", 9, 1.5*mm, 14*mm-7*mm, c)
	drawText(codigo, "FranklinGothic", 6, 1.5*mm, 12*mm-10*mm, c)
	drawText(esp, "FranklinGothic", 6, 23.3*mm, 12*mm-10*mm, c)

def genStampE4(codigo, esp, c):
	pdfmetrics.registerFont(TTFont('FranklinGothic', _font('franklin_gothic.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicBold', _font('franklin_gothic_bold.ttf')))
	pdfmetrics.registerFont(TTFont('FranklinGothicCondensed', _font('franklin_gothic_condensed.ttf')))

	page_width = 55 * mm
	page_height = 25 * mm
	drawfondoeti(_img("TiraEspecial4.png"), 55*mm, -38*mm, page_width, c)
	drawText(codigo, "FranklinGothic", 6, 1.5*mm, 12*mm-10*mm, c)
	drawText(esp, "FranklinGothic", 6, 23.3*mm, 12*mm-10*mm, c)		
	
def genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto):
	if id_cliente < 10:
		id_cliente = "000" + str(id_cliente)
	elif id_cliente < 100:
		id_cliente = "00" + str(id_cliente)
	elif id_cliente < 1000:
		id_cliente = "0" + str(id_cliente)

	if id_producto < 10:
		id_producto = "00" + str(id_producto)
	elif id_producto < 100:
		id_producto = "0" + str(id_producto)

	return str(modo_maquina) + str(mes_maquina) + str(pais_maquina) + str(year_maquina)[-2:] + ' ' + str(nombre_maquina) + '-' + str(id_cliente) + '-' + str(id_producto)
# Etiquetas del ticket principal (multiplo de 5) corte de 5 en SERVIDOR-WS.py
ETIQUETAS_POR_TICKET = 5

def genEtiquetasSimple(modelo1_ticket, modelo2_ticket, modelo, nombre_ticket, fecha_sello, evento_sello, modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto, cantidad, cs_principal, cs_overflow=None):
	""" LOGO
	Genera etiquetas simples agrupadas en tickets de ETIQUETAS_POR_TICKET (5).
	- cs_principal: canvas para las etiquetas en multiplos de 5.
	- cs_overflow: canvas para las etiquetas restantes (si None, usa cs_principal).
	Retorna el id_producto actualizado.
	"""
	id_producto = int(id_producto)
	etiquetas_principal = (cantidad // ETIQUETAS_POR_TICKET) * ETIQUETAS_POR_TICKET
	etiquetas_overflow = cantidad % ETIQUETAS_POR_TICKET

	# Etiquetas del ticket principal (multiplo de 5)
	for x in range(0, etiquetas_principal):
		if modelo == 1:
			genStampI(modelo1_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs_principal)
			id_producto = id_producto + 1
			cs_principal.showPage()
		else:
			genStampD(modelo2_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs_principal)
			id_producto = id_producto + 1
			cs_principal.showPage()

	# Etiquetas restantes van al ticket overflow
	canvas_ov = cs_overflow if cs_overflow is not None else cs_principal
	for x in range(0, etiquetas_overflow):
		if modelo == 1:
			genStampI(modelo1_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), canvas_ov)
			id_producto = id_producto + 1
			canvas_ov.showPage()
		else:
			genStampD(modelo2_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), canvas_ov)
			id_producto = id_producto + 1
			canvas_ov.showPage()

	return id_producto
def genEtiquetasSimpleMDCC(modelo1_ticket, modelo2_ticket, modelo, nombre_ticket, fecha_sello, evento_sello, modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto, cantidad, cs_principal, cs_overflow=None):
	""" LOGO
	Genera etiquetas simples agrupadas en tickets de ETIQUETAS_POR_TICKET (5).
	- cs_principal: canvas para las etiquetas en multiplos de 5.
	- cs_overflow: canvas para las etiquetas restantes (si None, usa cs_principal).
	Retorna el id_producto actualizado.
	"""
	id_producto = int(id_producto)
	etiquetas_principal = (cantidad // ETIQUETAS_POR_TICKET) * ETIQUETAS_POR_TICKET
	etiquetas_overflow = cantidad % ETIQUETAS_POR_TICKET

	# Etiquetas del ticket principal (multiplo de 5)
	for x in range(0, etiquetas_principal):
		if modelo == 1:
			genStampImdcc(modelo1_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs_principal)
			id_producto = id_producto + 1
			cs_principal.showPage()
		else:
			genStampDmdcc(modelo2_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs_principal)
			id_producto = id_producto + 1
			cs_principal.showPage()

	# Etiquetas restantes van al ticket overflow
	canvas_ov = cs_overflow if cs_overflow is not None else cs_principal
	for x in range(0, etiquetas_overflow):
		if modelo == 1:
			genStampImdcc(modelo1_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), canvas_ov)
			id_producto = id_producto + 1
			canvas_ov.showPage()
		else:
			genStampDmdcc(modelo2_ticket, nombre_ticket, fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), canvas_ov)
			id_producto = id_producto + 1
			canvas_ov.showPage()

	return id_producto

def printStamps(modelo1_ticket, modelo2_ticket, id_cliente, id_producto, fecha_sello, evento_sello, modo_maquina, nombre_maquina, mes_maquina, pais_maquina, year_maquina, items, productos, T1especial, T2especial, T3especial, TEmod1, TEmod2):
	print("Printing stamps")
	page_width = 55 * mm
	page_height = 25 * mm
	
	cs1a = canvas.Canvas(_output("stamp_simple_1_a.pdf"), pagesize=(page_width, page_height))
	cs1a2 = canvas.Canvas(_output("stamp_simple_1_a2.pdf"), pagesize=(page_width, page_height))
	cs1b = canvas.Canvas(_output("stamp_simple_1_b.pdf"), pagesize=(page_width, page_height))
	cs1c = canvas.Canvas(_output("stamp_simple_1_c.pdf"), pagesize=(page_width, page_height))
	ct1 = canvas.Canvas(_output("stamp_tira_1.pdf"), pagesize=(page_width, page_height))
	cte1 = canvas.Canvas(_output("stamp_tira_1_especial.pdf"), pagesize=(page_width, page_height))
	
	cs2a = canvas.Canvas(_output("stamp_simple_2_a.pdf"), pagesize=(page_width, page_height))
	cs2a2 = canvas.Canvas(_output("stamp_simple_2_a2.pdf"), pagesize=(page_width, page_height))
	cs2b = canvas.Canvas(_output("stamp_simple_2_b.pdf"), pagesize=(page_width, page_height))
	cs2c = canvas.Canvas(_output("stamp_simple_2_c.pdf"), pagesize=(page_width, page_height))
	ct2 = canvas.Canvas(_output("stamp_tira_2.pdf"), pagesize=(page_width, page_height))
	cte2 = canvas.Canvas(_output("stamp_tira_2_especial.pdf"), pagesize=(page_width, page_height))

	cs = [[cs1a, cs1a2, cs1b, cs1c], [cs2a, cs2a2, cs2b, cs2c]]
	ct = [ct1, ct2]
	cte = [cte1, cte2]

	# Canvas overflow para etiquetas restantes (segundo PDF)
	cs1a_ov = canvas.Canvas(_output("stamp_simple_1_a_overflow.pdf"), pagesize=(page_width, page_height))
	cs1a2_ov = canvas.Canvas(_output("stamp_simple_1_a2_overflow.pdf"), pagesize=(page_width, page_height))
	cs1b_ov = canvas.Canvas(_output("stamp_simple_1_b_overflow.pdf"), pagesize=(page_width, page_height))
	cs1c_ov = canvas.Canvas(_output("stamp_simple_1_c_overflow.pdf"), pagesize=(page_width, page_height))
	cs2a_ov = canvas.Canvas(_output("stamp_simple_2_a_overflow.pdf"), pagesize=(page_width, page_height))
	cs2a2_ov = canvas.Canvas(_output("stamp_simple_2_a2_overflow.pdf"), pagesize=(page_width, page_height))
	cs2b_ov = canvas.Canvas(_output("stamp_simple_2_b_overflow.pdf"), pagesize=(page_width, page_height))
	cs2c_ov = canvas.Canvas(_output("stamp_simple_2_c_overflow.pdf"), pagesize=(page_width, page_height))

	cs_overflow = [[cs1a_ov, cs1a2_ov, cs1b_ov, cs1c_ov], [cs2a_ov, cs2a2_ov, cs2b_ov, cs2c_ov]]
	

	for index, item in enumerate(items):

#----inicio ------------- AÑO 2023= SI <> MD IMPRIME SELLOS CON fecha_sello y evento_sello Y LOGO DE FONDO
		if item["cantidad"]>0 and  str(nombre_maquina[0:2]) != "MD":
			

#----inicio ------------- AÑO 2024= SI = IMPORTE MAYOR 100€ 1 TIRA ESPECIAL, 200€ 2 TIRAS, 300€ 3 TIRAS y 350€ 4 TIRAS
		    
			#elif totalImporte > 100:
			#for x in range(0,vecesEspecial):
			#if especialTiraMod1 > 0 or especialTiraMod2 > 0:


			modelo = int(productos[index]["idProducto"][-1:])
			# ANDORRA			
			if productos[index]["modo"] == "S":
				tarifa = productos[index]["nombre_ticket"].split(' ')[1]
				if tarifa == "A":
					tarifa = 0
				elif tarifa == "A2":
					tarifa = 1
				elif tarifa == "B":
					tarifa = 2
				elif tarifa == "C":
					tarifa = 3
#----inicio ------------- nuevo módulo CORTE DE 5
				id_producto = genEtiquetasSimple(modelo1_ticket, modelo2_ticket, modelo, productos[index]["nombre_ticket"], fecha_sello, evento_sello, modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto, item["cantidad"], cs[modelo-1][tarifa], cs_overflow[modelo-1][tarifa])
#----inicio ------------- MODULO ANTERIOR
				#	if modelo==1:
				#		genStampI(modelo1_ticket, productos[index]["nombre_ticket"], fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs[modelo-1][tarifa])
				#		id_producto = int(id_producto) + 1
				#		cs[modelo-1][tarifa].showPage()
				#	else:
				#		genStampD(modelo2_ticket, productos[index]["nombre_ticket"], fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs[modelo-1][tarifa])
				#		id_producto = int(id_producto) + 1
				#		cs[modelo-1][tarifa].showPage()
			elif productos[index]["modo"] == "T":
				if productos[index]["idProducto"] == "tarifaAT1" or productos[index]["idProducto"] == "tarifaAT2":

					for x in range(0,item["cantidad"]):
						if modelo==1:	
							genStampI(modelo1_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampI(modelo1_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampI(modelo1_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampI(modelo1_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
						else:	
							genStampD(modelo2_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampD(modelo2_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampD(modelo2_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampD(modelo2_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()

				elif productos[index]["idProducto"] == "tarifa4T1" or productos[index]["idProducto"] == "tarifa4T2":
		# ANDORRA
					for x in range(0,item["cantidad"]):
						if modelo==1:
							genStampI(modelo1_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampI(modelo1_ticket, "Tarifa A2", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampI(modelo1_ticket, "Tarifa B", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampI(modelo1_ticket, "Tarifa C", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()	
						else:
							genStampD(modelo2_ticket, "Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampD(modelo2_ticket, "Tarifa A2", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampD(modelo2_ticket, "Tarifa B", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStampD(modelo2_ticket, "Tarifa C", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()		



#----inicio ------------- AÑO 2023= SI = MD IMPRIME SELLOS SIN LOGO DE FONDO
		elif item["cantidad"]>0 and  str(nombre_maquina[0:2]) == "MD":
			modelo = int(productos[index]["idProducto"][-1:])

			if productos[index]["modo"] == "S":
				tarifa = productos[index]["nombre_ticket"].split(' ')[1]
				if tarifa == "A":
					tarifa = 0
				elif tarifa == "A2":
					tarifa = 1
				elif tarifa == "B":
					tarifa = 2
				elif tarifa == "C":
					tarifa = 3

#----inicio ------------- nuevo módulo CORTE DE 5
				id_producto = genEtiquetasSimpleMDCC(modelo1_ticket, modelo2_ticket, modelo, productos[index]["nombre_ticket"], fecha_sello, evento_sello, modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto, item["cantidad"], cs[modelo-1][tarifa], cs_overflow[modelo-1][tarifa])

#----inicio ------------- MODULO ANTERIOR
				#for x in range(0,item["cantidad"]):
				#		genStamp(productos[index]["nombre_ticket"], fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cs[modelo-1][tarifa])
				#		id_producto = int(id_producto) + 1
				#		cs[modelo-1][tarifa].showPage()

			elif productos[index]["modo"] == "T":
				if productos[index]["idProducto"] == "tarifaAT1" or productos[index]["idProducto"] == "tarifaAT2":

					for x in range(0,item["cantidad"]):
							genStamp("Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStamp("Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStamp("Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStamp("Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()


				elif productos[index]["idProducto"] == "tarifa4T1" or productos[index]["idProducto"] == "tarifa4T2":
# ANDORRA
					for x in range(0,item["cantidad"]):
							genStamp("Tarifa A", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStamp("Tarifa A2", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStamp("Tarifa B", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()
							genStamp("Tarifa C", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), ct[modelo-1])
							id_producto = int(id_producto) + 1
							ct[modelo-1].showPage()

	# TIRAS ESPECIALES ----------------------------______________________ ESPECIALES_______________--------------	

	totalImporte = 0 	                                                       
	for index, item in enumerate(items):
		if item["cantidad"]>0:
			totalImporte = totalImporte + item["cantidad"] * productos[index]["precio"]
	
	vecesEspecial = 0

	if int(T1especial) == 0:
		T1especial = 500
	if int(T2especial) == 0:
		T2especial = 500
	if int(T3especial) == 0:
		T3especial = 500	

	if totalImporte > int(T3especial):
		vecesEspecial = 3
	elif totalImporte > int(T2especial):
		vecesEspecial = 2
	elif totalImporte > int(T1especial):
		vecesEspecial = 1

	if vecesEspecial > 0 and str(nombre_maquina[0:2]) != "MD":

			if TEmod1 == "S" or TEmod1 == "s":	
				for x in range(vecesEspecial):
				#	for x in range(0,vecesEspecial):
					# TIRA ESPECIAL CON TARIFAS - MISMO LOGO QUE EN LA FERIA
					
						modelo=1
					# ETIQUETA 1
					#	genStampI(modelo1_ticket, "Tarifa A3", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
						genStampE1(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "  -E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()
					# ETIQUETA 2
						genStampE2("Tarifa A3", genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "  -E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()
					#	genStampE2(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
					# ETIQUETA 3
						genStampE3("Tarifa A3", genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "  -E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()
					#	genStampE3(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
					# ETIQUETA 4
					#	genStampI(modelo1_ticket, "Tarifa A3", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
						genStampE4(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "  -E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()		

			if TEmod2 == "S" or TEmod2 == "s":
				for x in range(vecesEspecial):
						modelo=2
						#especialTiraMod1 = 	especialTiraMod1 - 1	
					#else:
					# ETIQUETA 1
					#	genStampD(modelo2_ticket, "Tarifa A3", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
						genStampE1(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "-E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()
					# ETIQUETA 2
						genStampE2("Tarifa A3", genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "-E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()
					#	genStampE2(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
					# ETIQUETA 3
						genStampE3("Tarifa A3", genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "-E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()
					#	genStampE3(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
					# ETIQUETA 4
					#	genStampD(modelo2_ticket, "Tarifa A3", fecha_sello, evento_sello, genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), cte[modelo-1])
					#	id_producto = int(id_producto) + 1
					#	cte[modelo-1].showPage()
						genStampE4(genCodigo(modo_maquina, mes_maquina, pais_maquina, year_maquina, nombre_maquina, id_cliente, id_producto), "-E", cte[modelo-1])
						id_producto = int(id_producto) + 1
						cte[modelo-1].showPage()


			vecesEspecial = 0			
						#especialTiraMod2 = 	especialTiraMod2 - 1



	cs1a.save()
	cs1a2.save()
	cs1b.save()
	cs1c.save()
	ct1.save()
	cte1.save()
	cs2a.save()
	cs2a2.save()
	cs2b.save()
	cs2c.save()
	ct2.save()
	cte2.save()

	# Guardar PDFs de overflow
	cs1a_ov.save()
	cs1a2_ov.save()
	cs1b_ov.save()
	cs1c_ov.save()
	cs2a_ov.save()
	cs2a2_ov.save()
	cs2b_ov.save()
	cs2c_ov.save()


# genStamp("Tarifa A", "14-18 de Septiembre", "Zaragoza", "B9ES16 B004")


def printTickets(fecha_ticket, modo_ticket, modo_ticket_copia, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, ImprimeCopiaTicket, ImprimeMasterTicket):
	
     # Añadido:
     #------------------
	nitems = 0
	for index, item in enumerate(items):
		if item["cantidad"]>0:
			nitems = nitems + 1   #numero de items   #numero de items
	#ANULADO CAMBIOS
		# nitems = 12
	#NO OLVIDAR DE SUMAR LA CANTIDAD CAMBIADA!!! EJEMPLO: eitems = 3*nitems + 3   
	eitems = 3*nitems -17   #espacios necesarios QUITADA 1 LINEA: eitems = 3*nitems -12 y -5 (total -17)
	page_width = 78 * mm
	page_height = (126+eitems) * mm
	page_heighttira = 115 * mm
	# ------------------ page_height = 165 * mm con LINEA QUITADA 148
	c = canvas.Canvas(_output("ticket.pdf"), pagesize=(page_width, page_height))
	ctira = canvas.Canvas(_output("tickettira.pdf"), pagesize=(page_width, page_heighttira))

	genTicket(fecha_ticket, modo_ticket, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_height, page_width, c)
	c.showPage()
	#genTicket(fecha_ticket, modo_ticket_copia, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_height, page_width, c)
	#c.showPage()


# ticket 5 tiras MASTER SET _______________________________
	if ImprimeMasterTicket == "S" or ImprimeMasterTicket == "s":
		genTicketMaster(fecha_ticket, "", modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_height, page_width, c)
		c.showPage()

	# ticket caja inicio - anulado TAIPEI O INTERNACIONAL o FERIAS PEQUEÑAS _______________________________
	if ImprimeCopiaTicket == "S" or ImprimeCopiaTicket == "s":
		genTicketCaja("", "", "", "", items, id_cliente, nombre_maquina, productos, feria, "", "", "", "", "", "", "", page_height, page_width, c)
		c.showPage()
	
	#elnombre_maquina = ''
	#elnombre_maquina = 'MD' + str(year_maquina)[-2:]

	# IMPRIME TICKET POR CADA TIRA _______________________________
	# if nombre_maquina (es distinto a) ("MD" + year_maquina) O ("FI" + year_maquina) (ENTONCES IMPRIME TICKETS POR CADA TIRA)
	itemsColeccion = []
	for item in items:
		itemsColeccion.append({'idProducto' : item['idProducto'], 'cantidad' : 0})
	
	for index, item in enumerate(itemsColeccion):
		# if items[index]["cantidad"]>0 and productos[index]["modo"] == "T":
		# if items[index]["cantidad"]>0 and productos[index]["modo"] == "T" and modo_ticket == "Factura Simplificada": or str(nombre_maquina[0:2]) != "FI":
		if items[index]["cantidad"]>0 and productos[index]["modo"] == "T" and str(nombre_maquina[0:2]) != "MD":
			if str(nombre_maquina[0:2]) != "FI":
				itemsColeccion[index]["cantidad"] = 1
				for x in range(0,items[index]["cantidad"]):
					print(item)
					genTicket(fecha_ticket, modo_ticket, modelo1_ticket, modelo2_ticket, itemsColeccion, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, page_heighttira, page_width, ctira)
					ctira.showPage()
				itemsColeccion[index]["cantidad"] = 0
			
	c.save()
	ctira.save()
# ANDORRA

def afkarPrint(items, precios, id_cliente, id_producto, fecha_sello, evento_sello, fecha_ticket, modo_ticket, modo_ticket_copia, modelo1_ticket, modelo2_ticket, modo_maquina, nombre_maquina, mes_maquina, pais_maquina, year_maquina, feria, lugar, empresa, cif, cp, l1, l2, l3, T1especial, T2especial, T3especial, TEmod1, TEmod2, ImprimeCopiaTicket, ImprimeMasterTicket):
	print("Printing")
	productos = [
		{
			"idProducto": "tarifaAS1",
			"modo": "S",
			"precio": precios[0],
			"nombre_ticket": "Tarifa A"
		},
		{
			"idProducto": "tarifaA2S1",
			"modo": "S",
			"precio": precios[1],
			"nombre_ticket": "Tarifa A2"
		},
		{
			"idProducto": "tarifaBS1",
			"modo": "S",
			"precio": precios[2],
			"nombre_ticket": "Tarifa B"
		},
		{
			"idProducto": "tarifaCS1",
			"modo": "S",
			"precio": precios[3],
			"nombre_ticket": "Tarifa C"
		},
		{
			"idProducto": "tarifaAT1",
			"modo": "T",
			"precio": 4*precios[0],
			"nombre_ticket": "Tarifa A Tira 4"
		},
		{
			"idProducto": "tarifa4T1",
			"modo": "T",
			"precio": precios[0] + precios[1] + precios[2] + precios[3],
			"nombre_ticket": "Tira 4 Tarifas"
		},
		{
			"idProducto": "tarifaAS2",
			"modo": "S",
			"precio": precios[0],
			"nombre_ticket": "Tarifa A"
		},
		{
			"idProducto": "tarifaA2S2",
			"modo": "S",
			"precio": precios[1],
			"nombre_ticket": "Tarifa A2"
		},
		{
			"idProducto": "tarifaBS2",
			"modo": "S",
			"precio": precios[2],
			"nombre_ticket": "Tarifa B"
		},
		{
			"idProducto": "tarifaCS2",
			"modo": "S",
			"precio": precios[3],
			"nombre_ticket": "Tarifa C"
		},
		{
			"idProducto": "tarifaAT2",
			"modo": "T",
			"precio": 4*precios[0],
			"nombre_ticket": "Tarifa A Tira 4"
		},
		{
			"idProducto": "tarifa4T2",
			"modo": "T",
			"precio": precios[0] + precios[1] + precios[2] + precios[3],
			"nombre_ticket": "Tira 4 Tarifas"
		}
	]
	try:
		printTickets(fecha_ticket, modo_ticket, modo_ticket_copia, modelo1_ticket, modelo2_ticket, items, id_cliente, nombre_maquina, productos, feria, lugar, empresa, cif, cp, l1, l2, l3, ImprimeCopiaTicket, ImprimeMasterTicket)
	except Exception as e:
		print(e)
	try:
		printStamps(modelo1_ticket, modelo2_ticket, id_cliente, id_producto, fecha_sello, evento_sello, modo_maquina, nombre_maquina, mes_maquina, pais_maquina, year_maquina, items, productos, T1especial, T2especial, T3especial, TEmod1, TEmod2)
	except Exception as e:
		print(e)
	
	

# items = [{'idProducto': 'tarifaAS1', 'cantidad': 1}, {'idProducto': 'tarifaA2S1', 'cantidad': 1}, {'idProducto': 'tarifaBS1', 'cantidad': 1}, {'idProducto': 'tarifaCS1', 'cantidad': 1}, {'idProducto': 'tarifaAT1', 'cantidad': 1}, {'idProducto': 'tarifa4T1', 'cantidad': 2}, {'idProducto': 'tarifaAS2', 'cantidad': 0}, {'idProducto': 'tarifaA2S2', 'cantidad': 0}, {'idProducto': 'tarifaBS2', 'cantidad': 0}, {'idProducto': 'tarifaCS2', 'cantidad': 0}, {'idProducto': 'tarifaAT2', 'cantidad': 0}, {'idProducto': 'tarifa4T2', 'cantidad': 0}]
# precios = [0.38, 0.47, 0.94, 1.06]
# afkarPrint(items, precios, 0, 0, "14-18 Septiembre", "Zaragoza", "21/03/2017 13:33:13", "Factura Simplificada", "Caballo", "Cibeles", "B", "ES02", "3", "ES", "2017")





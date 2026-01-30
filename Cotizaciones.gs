/*****************************************************
 * COTIZACIONES - VERSIÓN FINAL UNIFICADA CORREGIDA  *
 *****************************************************/

// ================== CONFIGURACIÓN ==================
const SHEET_COT = "Cotización";
const SHEET_BASE_GENERAL = "Hoja 1";
const SHEET_SERVICIOS = "Base de Datos";

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxfcrobOC4pwmgwfMkfv-lYOHyByrlkM4bqhOJoEPdqS8FAk6i59MJt16GwByikW3Vz/exec";
const PLANTILLA_CONTRATO_ID = "1PbPN7niW78giNQuLS0AG95C5J3ENm0zR2zSz9VA9LlU";
const FOLDER_CONTRATOS_ID = "1bwGFSt--bCXRs6auVCoxgdJjxPCp0SS8";

// --- NUEVAS CONSTANTES PARA PAGARÉS ---
const PLANTILLA_PAGARE_JURIDICA_ID = "1i_cDNlHU36F85jQGlA9cNfjN-5bhJ9Xx96gXsppoYDY";
const PLANTILLA_PAGARE_NATURAL_ID = "1wuSVqVS87DAdfrYTHlNIV62TldD_bxTl_XQNrswAA6Q";

// ================== EL ÚNICO onEdit ==================
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    const row = range.getRow();
    const col = range.getColumn();

    if (sheetName !== SHEET_COT || row < 2) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const map = headerMap(headers);
    const editedKey = norm(headers[col - 1]);

    if (editedKey === "tipo_servicio") {
      const servicio = range.getDisplayValue().trim();
      _autocompletarServicio_(sheet, map, row, servicio);
    }

    if (editedKey === "ruc_dni_cliente") {
      const ruc = range.getDisplayValue().trim();
      _autocompletarCliente_(sheet, map, row, ruc);
    }
  } catch (err) {
    console.error("Error en onEdit: " + err.toString());
  }
}

// ================== LÓGICA DE AUTOCOMPLETADO ==================

function _autocompletarServicio_(sheet, map, row, servicioRaw) {
  const campos = ["descripcion", "requisitos", "inicio_postulaciones", "fin_postulaciones", "bono", "precios"];

  if (!servicioRaw) {
    campos.forEach(c => {
      const valVacio = (c === "bono" || c === "precios") ? 0 : "";
      setByHeader(sheet, map, row, c, valVacio);
    });
    return;
  }

  const datosBD = _buscarEnBD_(SHEET_SERVICIOS, "tipo_servicio", servicioRaw);

  if (datosBD) {
    campos.forEach(c => {
      let val = datosBD[norm(c)] || "";
      if (c === "bono" || c === "precios") {
        val = _limpiarDinero(val);
      }
      setByHeader(sheet, map, row, c, val);
    });
  }
}

function _autocompletarCliente_(sheet, map, row, ruc) {
  if (!ruc) return;
  const cliente = _buscarEnBD_(SHEET_BASE_GENERAL, "ID (DNI O RUC)", ruc);
  if (cliente) {
    setByHeader(sheet, map, row, "empresa_cliente", cliente[norm("CLIENTE / RAZÓN SOCIAL")]);
    setByHeader(sheet, map, row, "proveedor", cliente[norm("PROVEEDOR")]);
    setByHeader(sheet, map, row, "c/s_factura", cliente[norm("C/S FACTURA")]);
    setByHeader(sheet, map, row, "nombre_cliente", cliente[norm("CONTACTO NOMBRE")]);
    setByHeader(sheet, map, row, "contacto_whatsapp", cliente[norm("CONTACTO WHATSAPP")]);
    setByHeader(sheet, map, row, "correo_electronico", cliente[norm("Correo electrónico")]);
  }
}

// ================== HELPERS DE DINERO ==================

function _limpiarDinero(texto) {
  if (!texto || texto === "" || texto === "Por definir") return 0;
  let limpio = String(texto).replace(/\u00A0/g, " ").replace(/S\/\.?/gi, "").replace(/,/g, "").trim();
  let num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
}

function _buscarEnBD_(nombreHoja, columnaClave, valorBusqueda) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(nombreHoja);
  if (!sh) return null;
  const data = sh.getDataRange().getDisplayValues();
  const headers = data[0];
  const colIdx = headerMap(headers)[norm(columnaClave)] - 1;
  const target = norm(valorBusqueda);
  for (let i = 1; i < data.length; i++) {
    if (norm(data[i][colIdx]) === target) {
      const obj = {};
      headers.forEach((h, j) => obj[norm(h)] = data[i][j]);
      return obj;
    }
  }
  return null;
}

function norm(s) { 
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\w\s%]/g, "") 
    .replace(/\s+/g, "_").trim(); 
}

function headerMap(headers) { const map = {}; headers.forEach((h, i) => { map[norm(h)] = i + 1; }); return map; }
function setByHeader(sheet, map, row, name, value) { const col = map[norm(name)]; if (col) sheet.getRange(row, col).setValue(value); }

// ================== BOTONES Y WEB APP ==================

function onOpen() {
  SpreadsheetApp.getUi().createMenu("🚀 Cotizaciones")
    .addItem("✨ Abrir Panel de Botones (Fijos)", "mostrarPanelLateral") // Nueva opción
    .addSeparator()
    .addItem("Generar link cotización", "generarLinksWeb")
    .addItem("Generar contrato (Doc)", "generarContratoDesdeCotizacion_BOTON")
    .addSeparator() 
    .addItem("Generar Pagaré Jurídica", "generarPagareJuridica_BOTON")
    .addItem("Generar Pagaré Natural", "generarPagareNatural_BOTON")
    .addToUi();
}

// Función para mostrar el panel lateral estático
function mostrarPanelLateral() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('FST NEGOCIOS - Control')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function doGet(e) {
  const id = e.parameter.id;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_COT);

  const dataRange = sh.getDataRange();
  const values = dataRange.getValues(); 
  const headers = dataRange.getDisplayValues()[0];
  let data = null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      data = {};
      headers.forEach((h, j) => {
        let key = norm(h);
        let val = values[i][j];

        if (key === "tipo_servicio") val = _stripEmojis_(val);

        if (key.includes("%")) {
          val = (Number(val || 0) * 100).toFixed(0) + "%";
        } 
        else if ((key === "precios" || key === "bono" || key.includes("cuota") || key.includes("descuento")) && key !== "num_cuotas") {
          val = _formatSoles_(val);
        }

        if (val instanceof Date) {
          val = Utilities.formatDate(val, "GMT-5", "dd/MM/yyyy");
        }

        data[key] = val;
      });
      break;
    }
  }

  if (!data) return HtmlService.createHtmlOutput("Cotización no encontrada");
  const tpl = HtmlService.createTemplateFromFile("Cotizacion");
  tpl.data = data;
  return tpl.evaluate().setTitle("Cotización - " + data.empresa_cliente).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function generarLinksWeb() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COT);
  const row = sheet.getActiveCell().getRow();
  if (row < 2) return;
  const map = headerMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const id = sheet.getRange(row, map[norm("id_cotizacion")]).getValue();
  if (!id) return SpreadsheetApp.getUi().alert("Falta ID.");

  setByHeader(sheet, map, row, "fecha_generacion", new Date());
  setByHeader(sheet, map, row, "link_cotizacion", WEB_APP_URL + "?id=" + encodeURIComponent(id));
  SpreadsheetApp.getUi().alert("✅ Link generado.");
}

function generarContratoDesdeCotizacion_BOTON() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_COT);
  const row = sheet.getActiveCell().getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert("⚠️ Selecciona una fila con datos primero.");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = headerMap(headers);
  const ruc = sheet.getRange(row, map[norm("RUC_DNI_cliente")]).getValue();
  const cliente = sheet.getRange(row, map[norm("nombre_cliente")]).getValue();

  if (!ruc) {
    SpreadsheetApp.getUi().alert("⚠️ Falta el RUC_DNI_cliente.");
    return;
  }

  try {
    const ahora = new Date();
    const urlContrato = _ejecutarCreacionDocumento(sheet, map, row, ruc, cliente, ahora);

    const fechaRegistro = Utilities.formatDate(ahora, "GMT-5", "dd/MM/yyyy HH:mm:ss");
    setByHeader(sheet, map, row, "fecha_contrato", fechaRegistro); 
    setByHeader(sheet, map, row, "link_contrato", urlContrato);   

    SpreadsheetApp.getUi().alert("✅ Contrato generado con éxito.");
  } catch (err) {
    SpreadsheetApp.getUi().alert("❌ Error: " + err.toString());
  }
}

function _ejecutarCreacionDocumento(sheet, map, row, ruc, cliente, fechaObjeto) {
  const nombreArchivo = "Contrato_" + cliente + "_" + ruc;
  const copia = DriveApp.getFileById(PLANTILLA_CONTRATO_ID).makeCopy(nombreArchivo, DriveApp.getFolderById(FOLDER_CONTRATOS_ID));
  const doc = DocumentApp.openById(copia.getId());
  const body = doc.getBody();

  const dataFila = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fechaFormal = _formatFechaFormal(fechaObjeto);

  headers.forEach((h, i) => {
    let tag = "{{" + h.trim() + "}}";
    let valor = dataFila[i];
    let key = norm(h);

    if (key === "tipo_servicio") valor = _stripEmojis_(valor);

    if (key.includes("%")) {
      valor = (Number(valor || 0) * 100).toFixed(0) + "%";
    } else if ((key === "precios" || key === "bono" || key.includes("cuota") || key.includes("descuento")) && key !== "num_cuotas") {
      valor = _formatSoles_(valor);
    }

    if (key === "fecha_contrato") valor = fechaFormal;

    if (valor instanceof Date && key !== "fecha_contrato") {
      valor = Utilities.formatDate(valor, "GMT-5", "dd/MM/yyyy");
    }

    body.replaceText(tag, String(valor || ""));
  });

  doc.saveAndClose();
  return copia.getUrl();
}

function _stripEmojis_(text) {
  if (!text) return "";
  return String(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

function _formatSoles_(val) {
  if (val === null || val === undefined || val === "" || val === 0) return "S/. 0.00";
  let n = (typeof val === "number") ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return val;
  return "S/. " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Nuevo formato de fecha: Lima, 29 de enero del 2026
 */
function _formatFechaFormal(fecha) {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();
  
  return "Lima, " + dia + " de " + mes + " del " + anio;
}


// =================================================================
// ============ NUEVA LÓGICA: GENERAR PAGARÉS (NAT/JUR) ============
// =================================================================

function generarPagareJuridica_BOTON() {
  _procesoPagareGeneric("JURIDICA", PLANTILLA_PAGARE_JURIDICA_ID, 39); // Columna AM
}

function generarPagareNatural_BOTON() {
  _procesoPagareGeneric("NATURAL", PLANTILLA_PAGARE_NATURAL_ID, 40); // Columna AN
}

/**
 * Función genérica para manejar ambos pagarés y evitar repetir código
 */
function _procesoPagareGeneric(tipo, templateId, colDestino) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_COT);
  const row = sheet.getActiveCell().getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert("⚠️ Selecciona una fila con datos primero.");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = headerMap(headers);
  const ruc = sheet.getRange(row, map[norm("RUC_DNI_cliente")]).getValue();
  const cliente = sheet.getRange(row, map[norm("nombre_cliente")]).getValue();

  if (!ruc) {
    SpreadsheetApp.getUi().alert("⚠️ Falta el RUC_DNI_cliente.");
    return;
  }

  try {
    const ahora = new Date();
    // Crea el documento y reemplaza etiquetas {DATO}
    const urlDoc = _ejecutarCreacionPagare(sheet, map, row, ruc, cliente, ahora, templateId, tipo);

    const fechaRegistro = Utilities.formatDate(ahora, "GMT-5", "dd/MM/yyyy HH:mm:ss");
    
    // ESCRITURA EN COLUMNAS ESPECÍFICAS
    sheet.getRange(row, 38).setValue(fechaRegistro); // Columna AL
    sheet.getRange(row, colDestino).setValue(urlDoc); // Columna AM o AN

    SpreadsheetApp.getUi().alert("✅ Pagaré " + tipo + " generado con éxito.");
  } catch (err) {
    SpreadsheetApp.getUi().alert("❌ Error: " + err.toString());
  }
}

/**
 * Función que realiza el reemplazo de etiquetas con formato {HEADER}
 */
function _ejecutarCreacionPagare(sheet, map, row, ruc, cliente, fechaObjeto, templateId, tipo) {
  const nombreArchivo = "Pagare_" + tipo + "_" + cliente + "_" + ruc;
  const copia = DriveApp.getFileById(templateId).makeCopy(nombreArchivo, DriveApp.getFolderById(FOLDER_CONTRATOS_ID));
  const doc = DocumentApp.openById(copia.getId());
  const body = doc.getBody();

  const dataFila = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fechaFormal = _formatFechaFormal(fechaObjeto);

  headers.forEach((h, i) => {
    let tag = "{" + h.trim() + "}"; // Formato solicitado: {CABECERA}
    let valor = dataFila[i];
    let key = norm(h);

    if (key === "tipo_servicio") valor = _stripEmojis_(valor);

    // Formateo de moneda y porcentajes
    if (key.includes("%")) {
      valor = (Number(valor || 0) * 100).toFixed(0) + "%";
    } else if ((key === "precios" || key === "bono" || key.includes("cuota") || key.includes("descuento")) && key !== "num_cuotas") {
      valor = _formatSoles_(valor);
    }

    if (key === "fecha_pagare" || key === "fecha_contrato") valor = fechaFormal;

    if (valor instanceof Date) {
      valor = Utilities.formatDate(valor, "GMT-5", "dd/MM/yyyy");
    }

    body.replaceText(tag, String(valor || ""));
  });

  doc.saveAndClose();
  return copia.getUrl();
}

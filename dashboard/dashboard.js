import { renderVisaoGeralCharts, renderFonteCharts, renderFrequenciaChart } from "./charts.js";
import { renderHeatmapHabilidades } from "./heatmap.js";
import { renderDiagnostico } from "./diagnostico.js";
import { renderAlertasFrequencia } from "./alertas_frequencia.js";

const SECTION_TITLES = {
  "visao-geral": "Visao geral",
  "avaliarj": "AvaliaRJ",
  "cnca": "CNCA",
  "saeb-ideb": "SAEB/IDEB",
  "frequencia": "Frequencia",
  "habilidades": "Habilidades",
  "diagnostico": "Diagnostico"
};

const FIELD_ALIASES = {
  avaliacao: ["avaliacao", "avaliacaonome", "sistemaavaliativo", "fonte", "exame", "nomeavaliacao", "prova", "instrumento"],
  ano: ["ano", "anoreferencia", "anoletivo"],
  etapa: ["etapa", "serie", "segmento", "ciclo", "anoescolar"],
  trimestre: ["trimestre", "trimestreletivo", "periodo", "bimestre", "cicloavaliativo"],
  escola: ["escola", "nomeescola", "unidadeescolar", "unidade", "codigodaescola", "codigodomunicipio", "municipio"],
  turma: ["turma", "nometurma", "classe"],
  disciplina: ["disciplina", "materia", "componente", "componentecurricular"],
  habilidade: ["habilidade", "codigohabilidade", "descricaohabilidade"],
  percentual: ["percentual", "percentualacerto", "acerto", "desempenhopercentual", "avaliadospercent", "avaliados"],
  proficiencia: ["proficiencia", "nota", "pontuacao", "desempenho", "proficienciamedia"],
  frequencia: ["frequencia", "frequenciapercentual", "presenca", "percentualpresenca", "frequenciapercent", "frequenciamedia", "taxafrequencia"]
};

const DEFAULT_DATASET_CANDIDATES = [
  "/data/dados_educacionais.csv",
  "/data/dashboard_educacional.csv",
  "/data/base_educacional.csv",
  "/data/indicadores.csv",
  "/data/avalia_rj.csv",
  "/data/cnca.csv",
  "/data/saeb_ideb.csv",
  "/data/frequencia.csv",
  "/data/dados_educacionais.json",
  "/data/dashboard_educacional.json"
];

const ESCOLA_FILTER_MAX_OPTIONS = 600;

const chartsRegistry = new Map();
const localDatasets = [];
const LOCAL_UPLOADS_STORAGE_KEY = "painel_educacional_local_uploads_v2";
let trimestreFilter = "todos";
let escolaFilter = "todas";
let escolaSearchTerm = "";

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupRefreshButton();
  setupLocalUploadModule();
  hydrateLocalDatasets();
  renderLocalDatasetsList();
  window.addEventListener("resize", resizeVisibleCharts);
  refreshDashboard();
});

function setupNavigation() {
  const buttons = Array.from(document.querySelectorAll(".menu-link"));
  const sections = Array.from(document.querySelectorAll(".section"));

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.section;

      buttons.forEach((currentButton) => {
        currentButton.classList.toggle("active", currentButton === button);
      });

      sections.forEach((section) => {
        section.classList.toggle("active", section.id === `sec-${sectionKey}`);
      });

      setText("titulo-secao", SECTION_TITLES[sectionKey] || "Dashboard");
      resizeVisibleCharts();
    });
  });
}

function setupRefreshButton() {
  const reloadButton = document.getElementById("recarregar-dados");
  if (!reloadButton) {
    return;
  }

  reloadButton.addEventListener("click", () => {
    refreshDashboard();
  });
}

function setupLocalUploadModule() {
  const input = document.getElementById("input-planilhas-locais");
  const clearButton = document.getElementById("limpar-planilhas-locais");
  const trimestreSelect = document.getElementById("filtro-trimestre");
  const escolaSelect = document.getElementById("filtro-escola");
  const escolaSearchInput = document.getElementById("busca-escola");

  if (!input || !clearButton || !trimestreSelect || !escolaSelect || !escolaSearchInput) {
    return;
  }

  trimestreSelect.addEventListener("change", () => {
    trimestreFilter = String(trimestreSelect.value || "todos");
    refreshDashboard();
  });

  escolaSelect.addEventListener("change", () => {
    escolaFilter = String(escolaSelect.value || "todas");
    refreshDashboard();
  });

  escolaSearchInput.addEventListener("input", () => {
    escolaSearchTerm = normalizeEscola(escolaSearchInput.value || "");
    refreshDashboard();
  });

  input.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setUploadStatus("Lendo planilhas locais...");
    const parseResults = await Promise.all(files.map((file) => parseLocalFile(file)));

    let importedCount = 0;
    let skippedCount = 0;
    let rawRowsCount = 0;
    let normalizedRowsCount = 0;

    parseResults.forEach((result) => {
      if (!result || !result.rows.length) {
        skippedCount += 1;
        return;
      }

      const inferredSource = inferSourceFromFilename(`local/${result.fileName}`);
      const normalizedRows = result.rows
        .map((row) => normalizeRow(row, inferredSource))
        .filter(Boolean);

      if (!normalizedRows.length) {
        skippedCount += 1;
        return;
      }

      localDatasets.push({
        id: buildLocalDatasetId(result.fileName),
        filePath: `local/${result.fileName}`,
        importedAt: new Date().toISOString(),
        rows: normalizedRows
      });
      importedCount += 1;
      rawRowsCount += Number(result.rawCount || result.rows.length || 0);
      normalizedRowsCount += normalizedRows.length;
    });

    input.value = "";

    if (!importedCount) {
      setUploadStatus("Nenhuma planilha local valida foi importada.", true);
      return;
    }

    const msg =
      skippedCount > 0
        ? `${importedCount} planilha(s) importada(s): ${normalizedRowsCount}/${rawRowsCount} linha(s) aproveitada(s), ${skippedCount} ignorada(s).`
        : `${importedCount} planilha(s) importada(s): ${normalizedRowsCount}/${rawRowsCount} linha(s) aproveitada(s).`;
    setUploadStatus(msg);
    persistLocalDatasets();
    renderLocalDatasetsList();
    refreshDashboard();
  });

  clearButton.addEventListener("click", () => {
    localDatasets.length = 0;
    persistLocalDatasets();
    renderLocalDatasetsList();
    setUploadStatus("Importacoes locais removidas.");
    refreshDashboard();
  });
}

function buildLocalDatasetId(fileName) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}_${rand}_${sanitizeKey(fileName || "arquivo")}`;
}

function persistLocalDatasets() {
  try {
    const payload = localDatasets.map((dataset) => ({
      id: String(dataset.id || ""),
      filePath: String(dataset.filePath || ""),
      importedAt: String(dataset.importedAt || ""),
      rows: Array.isArray(dataset.rows) ? dataset.rows : []
    }));
    window.localStorage.setItem(LOCAL_UPLOADS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    setUploadStatus("Falha ao salvar importacoes locais neste navegador.", true);
  }
}

function hydrateLocalDatasets() {
  try {
    const raw = window.localStorage.getItem(LOCAL_UPLOADS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }

    parsed.forEach((dataset) => {
      if (!dataset || !Array.isArray(dataset.rows) || !dataset.rows.length) {
        return;
      }
      const source = inferSourceFromFilename(String(dataset.filePath || "local/planilha"));
      const normalizedRows = dataset.rows
        .map((row) => {
          if (row && typeof row === "object" && "avaliacao" in row && "ano" in row) {
            return row;
          }
          return normalizeRow(row, source);
        })
        .filter(Boolean);
      if (!normalizedRows.length) {
        return;
      }
      localDatasets.push({
        id: String(dataset.id || buildLocalDatasetId(dataset.filePath || "local")),
        filePath: String(dataset.filePath || "local/planilha"),
        importedAt: String(dataset.importedAt || ""),
        rows: normalizedRows
      });
    });

    if (localDatasets.length) {
      setUploadStatus(`${localDatasets.length} planilha(s) local(is) restaurada(s) deste navegador.`);
    }
  } catch (error) {
    window.localStorage.removeItem(LOCAL_UPLOADS_STORAGE_KEY);
    localDatasets.length = 0;
    setUploadStatus("Cache local invalido foi limpo.", true);
  }
}

function renderLocalDatasetsList() {
  const listElement = document.getElementById("lista-planilhas-locais");
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  if (!localDatasets.length) {
    const item = document.createElement("li");
    item.textContent = "Os uploads locais ficam salvos neste navegador.";
    listElement.appendChild(item);
    return;
  }

  localDatasets.slice(-8).reverse().forEach((dataset) => {
    const item = document.createElement("li");
    const fileName = String(dataset.filePath || "local/planilha").replace(/^local\//, "");
    const rowsCount = Array.isArray(dataset.rows) ? dataset.rows.length : 0;
    const trimestres = summarizeTrimestres(dataset.rows);
    const importedAt = formatImportDate(dataset.importedAt);
    item.textContent = `${fileName}: ${rowsCount} linha(s)${trimestres ? `, ${trimestres}` : ""}${importedAt ? ` (${importedAt})` : ""}.`;
    listElement.appendChild(item);
  });
}

function summarizeTrimestres(rows) {
  if (!Array.isArray(rows)) {
    return "";
  }
  const values = new Set();
  rows.forEach((row) => {
    const tri = normalizeTrimestre(row && row.trimestre ? row.trimestre : "");
    if (tri) {
      values.add(tri);
    }
  });
  const sorted = Array.from(values).sort();
  return sorted.length ? `trimestres: ${sorted.join(", ")}` : "";
}

function formatImportDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("pt-BR");
}

async function refreshDashboard() {
  setStatus("Carregando datasets de /data...");

  const { rows, loadedFiles } = await loadEducationalDatasets();
  const rowsByTrimestre = applyTrimestreFilter(rows);
  renderEscolaFilterOptions(rowsByTrimestre);
  const filteredRows = applyEscolaFilter(rowsByTrimestre);
  const localCount = loadedFiles.filter((file) => file.startsWith("local/")).length;
  const dataCount = loadedFiles.length - localCount;

  updateKpis(filteredRows);
  renderAll(filteredRows);

  if (!filteredRows.length) {
    if (rows.length && (trimestreFilter !== "todos" || escolaFilter !== "todas")) {
      setStatus(withFiltersTag("Sem dados para o(s) filtro(s) selecionado(s)."), true);
      return;
    }
    setStatus("Sem dados em /data e sem planilhas locais importadas.", true);
    return;
  }

  if (localCount && dataCount) {
    setStatus(withFiltersTag(`${dataCount} dataset(s) de /data + ${localCount} planilha(s) local(is).`));
    return;
  }

  if (localCount) {
    setStatus(withFiltersTag(`${localCount} planilha(s) local(is) carregada(s).`));
    return;
  }

  if (loadedFiles.length === 1) {
    setStatus(withFiltersTag(`1 dataset carregado: ${loadedFiles[0]}`));
    return;
  }

  setStatus(withFiltersTag(`${loadedFiles.length} datasets carregados em /data.`));
}

function applyTrimestreFilter(rows) {
  if (trimestreFilter === "todos") {
    return rows;
  }

  return rows.filter((row) => normalizeTrimestre(row && row.trimestre ? row.trimestre : "") === trimestreFilter);
}

function applyEscolaFilter(rows) {
  if (escolaFilter === "todas") {
    return rows;
  }

  return rows.filter((row) => normalizeEscola(row && row.escola ? row.escola : "") === escolaFilter);
}

function withFiltersTag(text) {
  const tags = [];
  if (trimestreFilter !== "todos") {
    tags.push(trimestreFilter);
  }
  if (escolaFilter !== "todas") {
    tags.push(`escola:${escolaFilter}`);
  }
  return tags.length ? `${text} | filtro: ${tags.join(" | ")}` : text;
}

function renderEscolaFilterOptions(rows) {
  const select = document.getElementById("filtro-escola");
  if (!select) {
    return;
  }

  const previousValue = escolaFilter;
  const escolaMap = new Map();
  rows.forEach((row) => {
    const label = stringValue(row && row.escola ? row.escola : "");
    const normalized = normalizeEscola(label);
    if (!normalized || escolaMap.has(normalized)) {
      return;
    }
    escolaMap.set(normalized, label);
  });

  const searchTerm = normalizeEscola(escolaSearchTerm);
  let allCandidates = [];
  if (!searchTerm && escolaMap.size > ESCOLA_FILTER_MAX_OPTIONS * 3) {
    let taken = 0;
    for (const entry of escolaMap.entries()) {
      allCandidates.push(entry);
      taken += 1;
      if (taken >= ESCOLA_FILTER_MAX_OPTIONS) {
        break;
      }
    }
    setEscolaFilterInfo(
      `Muitas escolas no dataset (${formatInt(escolaMap.size)}). Digite na busca para refinar.`
    );
  } else {
    escolaMap.forEach((label, value) => {
      if (!searchTerm || value.includes(searchTerm) || normalizeEscola(label).includes(searchTerm)) {
        allCandidates.push([value, label]);
      }
    });
    if (searchTerm && !allCandidates.length) {
      setEscolaFilterInfo("Nenhuma escola encontrada para a busca informada.", true);
    } else {
      setEscolaFilterInfo("");
    }
  }

  const sortedOptions = allCandidates
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .slice(0, ESCOLA_FILTER_MAX_OPTIONS);
  const validValues = new Set(["todas", ...sortedOptions.map(([value]) => value)]);
  if (!validValues.has(previousValue)) {
    escolaFilter = "todas";
  }

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "todas";
  allOption.textContent = "Todas";
  select.appendChild(allOption);

  sortedOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  select.value = escolaFilter;
}

function renderAll(rows) {
  renderVisaoGeralCharts(rows, getChartById);
  renderFonteCharts(rows, getChartById);
  renderFrequenciaChart(rows, getChartById);
  renderHeatmapHabilidades(rows, getChartById);
  renderDiagnostico(rows, getChartById, { targetScore: 70, diagnosticsListId: "diagnostico-list" });
  renderAlertasFrequencia(rows, getChartById, { threshold: 75, listElementId: "lista-alertas-frequencia" });
  resizeVisibleCharts();
}

function getChartById(containerId) {
  const container = document.getElementById(containerId);
  if (!container || typeof echarts === "undefined") {
    return null;
  }

  let chart = chartsRegistry.get(containerId);
  if (chart && chart.getDom() !== container) {
    chart.dispose();
    chart = null;
  }

  if (!chart) {
    chart = echarts.init(container);
    chartsRegistry.set(containerId, chart);
  }

  return chart;
}

function resizeVisibleCharts() {
  chartsRegistry.forEach((chart) => {
    const chartElement = chart.getDom();
    if (chartElement && chartElement.offsetParent !== null) {
      chart.resize();
    }
  });
}

async function loadEducationalDatasets() {
  const manifestFiles = await loadManifestFiles();
  const filesToTry = deduplicate(manifestFiles.length ? manifestFiles : DEFAULT_DATASET_CANDIDATES);

  const fetchResults = await Promise.all(filesToTry.map((filePath) => fetchDataset(filePath)));
  const localResults = localDatasets.map((dataset) => ({
    filePath: dataset.filePath,
    rows: dataset.rows,
    preNormalized: true
  }));
  const allResults = [...fetchResults, ...localResults];
  const loadedFiles = [];
  const rows = [];

  allResults.forEach((result) => {
    if (!result) {
      return;
    }

    loadedFiles.push(result.filePath);
    const inferredSource = inferSourceFromFilename(result.filePath);

    if (result.preNormalized) {
      result.rows.forEach((row) => {
        if (row && typeof row === "object") {
          rows.push(row);
        }
      });
      return;
    }

    result.rows.forEach((row) => {
      const normalizedRow = normalizeRow(row, inferredSource);
      if (normalizedRow) {
        rows.push(normalizedRow);
      }
    });
  });

  return { rows, loadedFiles };
}

async function loadManifestFiles() {
  try {
    const response = await fetch("/data/manifest.json", { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const manifestData = await response.json();
    if (Array.isArray(manifestData)) {
      return manifestData.map(normalizeDatasetPath).filter(Boolean);
    }

    if (manifestData && Array.isArray(manifestData.datasets)) {
      return manifestData.datasets.map(normalizeDatasetPath).filter(Boolean);
    }

    return [];
  } catch (error) {
    return [];
  }
}

function normalizeDatasetPath(rawPath) {
  if (typeof rawPath !== "string") {
    return "";
  }

  const trimmedPath = rawPath.trim();
  if (!trimmedPath) {
    return "";
  }

  if (trimmedPath.startsWith("/data/")) {
    return trimmedPath;
  }

  if (trimmedPath.startsWith("data/")) {
    return `/${trimmedPath}`;
  }

  return `/data/${trimmedPath.replace(/^[./]+/, "")}`;
}

async function fetchDataset(filePath) {
  try {
    const response = await fetch(filePath, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const rawText = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const isJson = filePath.toLowerCase().endsWith(".json") || contentType.includes("json");
    const rows = isJson ? parseJsonRows(rawText) : parseCsvRows(rawText);

    if (!rows.length) {
      return null;
    }

    return { filePath, rows };
  } catch (error) {
    return null;
  }
}

async function parseLocalFile(file) {
  if (!file || !file.name) {
    return null;
  }

  const fileName = String(file.name);
  const lowerName = fileName.toLowerCase();

  try {
    if (lowerName.endsWith(".json")) {
      const text = await file.text();
      const rows = parseJsonRows(text);
      return { fileName, rows, rawCount: rows.length };
    }

    if (lowerName.endsWith(".csv")) {
      const text = await file.text();
      const rows = parseCsvRows(text);
      return { fileName, rows, rawCount: rows.length };
    }

    if (lowerName.endsWith(".xlsx")) {
      const buffer = await file.arrayBuffer();
      const rows = parseXlsxRows(buffer);
      return { fileName, rows, rawCount: rows.length };
    }

    return { fileName, rows: [], rawCount: 0 };
  } catch (error) {
    return { fileName, rows: [], rawCount: 0 };
  }
}

function parseXlsxRows(arrayBuffer) {
  if (typeof XLSX === "undefined") {
    return [];
  }

  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", raw: false, cellDates: false });
  } catch (error) {
    return [];
  }

  const rows = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return;
    }

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const matrixRows = matrixToObjects(matrix);
    if (matrixRows.length) {
      rows.push(...matrixRows);
      return;
    }

    const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    if (Array.isArray(sheetRows) && sheetRows.length) {
      rows.push(...sheetRows);
    }
  });

  return rows;
}

function matrixToObjects(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) {
    return [];
  }

  const aliasesSet = new Set(Object.values(FIELD_ALIASES).flat());
  let bestIndex = -1;
  let bestScore = -1;

  matrix.slice(0, 30).forEach((row, index) => {
    if (!Array.isArray(row)) {
      return;
    }
    const normalized = row.map((cell) => sanitizeKey(cell)).filter(Boolean);
    if (normalized.length < 2) {
      return;
    }

    const score = normalized.reduce((sum, value) => {
      const tokenScore =
        aliasesSet.has(value) || /^h\d{1,2}$/.test(value) || /^h\d{1,2}percent$/.test(value)
          ? 1
          : 0;
      return sum + tokenScore;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex < 0) {
    return [];
  }

  const headerRow = matrix[bestIndex] || [];
  const headers = headerRow.map((cell, idx) => {
    const label = String(cell || "").trim();
    return label || `coluna_${idx + 1}`;
  });

  const normalizedHeaders = headers.map((header) => sanitizeKey(header));
  const rows = [];

  for (let index = bestIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (!Array.isArray(row)) {
      continue;
    }

    const values = headers.map((_, idx) => String(row[idx] ?? "").trim());
    if (values.every((value) => value === "")) {
      continue;
    }

    const normalizedValues = values.map((value) => sanitizeKey(value));
    if (normalizedValues.every((value, idx) => value && value === normalizedHeaders[idx])) {
      continue;
    }

    const record = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx];
    });
    rows.push(record);
  }

  return rows;
}

function parseJsonRows(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data;
    }

    if (parsed && Array.isArray(parsed.rows)) {
      return parsed.rows;
    }

    return [];
  } catch (error) {
    return [];
  }
}

function parseCsvRows(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header, index) => {
    const trimmedHeader = String(header).trim();
    return trimmedHeader || `coluna_${index + 1}`;
  });

  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index], delimiter);
    if (values.every((value) => String(value).trim() === "")) {
      continue;
    }

    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = String(values[headerIndex] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"" && insideQuotes && nextChar === "\"") {
      currentCell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      cells.push(currentCell);
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  cells.push(currentCell);
  return cells;
}

function normalizeRow(rawRow, fallbackSource) {
  if (!rawRow || typeof rawRow !== "object") {
    return null;
  }

  const normalizedInput = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    normalizedInput[sanitizeKey(key)] = typeof value === "string" ? value.trim() : value;
  });

  const row = {
    avaliacao: stringValue(getAliasValue(normalizedInput, FIELD_ALIASES.avaliacao) || fallbackSource || "Sem fonte"),
    ano: integerValue(getAliasValue(normalizedInput, FIELD_ALIASES.ano)),
    etapa: stringValue(getAliasValue(normalizedInput, FIELD_ALIASES.etapa)),
    trimestre: normalizeTrimestre(getAliasValue(normalizedInput, FIELD_ALIASES.trimestre)),
    escola: stringValue(getAliasValue(normalizedInput, FIELD_ALIASES.escola)),
    turma: stringValue(getAliasValue(normalizedInput, FIELD_ALIASES.turma)),
    disciplina: stringValue(getAliasValue(normalizedInput, FIELD_ALIASES.disciplina)),
    habilidade: stringValue(getAliasValue(normalizedInput, FIELD_ALIASES.habilidade)),
    percentual: percentValue(getAliasValue(normalizedInput, FIELD_ALIASES.percentual)),
    proficiencia: numberValue(getAliasValue(normalizedInput, FIELD_ALIASES.proficiencia)),
    frequencia: percentValue(getAliasValue(normalizedInput, FIELD_ALIASES.frequencia))
  };

  if (!Number.isFinite(row.ano)) {
    row.ano = inferYear([row.avaliacao, row.etapa, fallbackSource]);
  }

  if (!row.trimestre) {
    row.trimestre = normalizeTrimestre(row.etapa);
  }

  if (!Number.isFinite(row.proficiencia) && Number.isFinite(row.percentual)) {
    row.proficiencia = row.percentual;
  }

  if (!Number.isFinite(row.percentual) && Number.isFinite(row.proficiencia)) {
    row.percentual = row.proficiencia;
  }

  if (!hasDimension(row)) {
    return null;
  }

  return row;
}

function hasDimension(row) {
  return Boolean(
    Number.isFinite(row.ano) ||
    row.escola ||
    row.turma ||
    row.disciplina ||
    row.habilidade
  );
}

function sanitizeKey(rawKey) {
  return String(rawKey || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u3164/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getAliasValue(normalizedInput, aliases) {
  for (const alias of aliases) {
    const value = normalizedInput[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function stringValue(value) {
  return String(value ?? "").replace(/\u3164/g, " ").trim();
}

function numberValue(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return Number.NaN;
  }

  let text = String(value).replace(/\u3164/g, " ").trim().replace("%", "");
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function integerValue(value) {
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
}

function inferYear(values) {
  for (const value of values) {
    const text = String(value || "");
    const matches = text.match(/(?:19|20)\d{2}/g);
    if (matches && matches.length) {
      return Number(matches[matches.length - 1]);
    }
  }
  return Number.NaN;
}

function normalizeTrimestre(value) {
  const text = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u3164/g, " ")
    .trim();

  if (!text) {
    return "";
  }

  const directMatch = text.match(/(?:tri|trimestre|t)\s*([1-4])/);
  if (directMatch) {
    return `T${directMatch[1]}`;
  }

  const numberMatch = text.match(/\b([1-4])\b/);
  if (numberMatch && (text.includes("trimestre") || text.includes("tri"))) {
    return `T${numberMatch[1]}`;
  }

  return "";
}

function normalizeEscola(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u3164/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function percentValue(value) {
  const parsed = numberValue(value);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  if (parsed >= 0 && parsed <= 1) {
    return parsed * 100;
  }

  return parsed;
}

function inferSourceFromFilename(filePath) {
  const normalizedPath = filePath.toLowerCase();

  if (normalizedPath.includes("avalia")) {
    return "AvaliaRJ";
  }
  if (normalizedPath.includes("cnca")) {
    return "CNCA";
  }
  if (normalizedPath.includes("saeb") || normalizedPath.includes("ideb")) {
    return "SAEB/IDEB";
  }
  if (normalizedPath.includes("frequ")) {
    return "Frequencia";
  }
  return "Geral";
}

function updateKpis(rows) {
  setText("kpi-registros", formatInt(rows.length));
  setText("kpi-escolas", formatInt(uniqueCount(rows, "escola")));
  setText("kpi-turmas", formatInt(uniqueCount(rows, "turma")));

  const frequencies = rows
    .map((row) => row.frequencia)
    .filter((value) => Number.isFinite(value));

  const averageFrequency = average(frequencies);
  setText("kpi-frequencia-media", Number.isFinite(averageFrequency) ? `${averageFrequency.toFixed(1)}%` : "-");
}

function uniqueCount(rows, field) {
  const values = new Set();
  rows.forEach((row) => {
    const value = String(row[field] || "").trim();
    if (value) {
      values.add(value);
    }
  });
  return values.size;
}

function average(values) {
  if (!values.length) {
    return Number.NaN;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function setText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

function setStatus(text, isError = false) {
  const statusElement = document.getElementById("dataset-status");
  if (!statusElement) {
    return;
  }

  statusElement.textContent = text;
  statusElement.classList.toggle("error", isError);
}

function setUploadStatus(text, isError = false) {
  const statusElement = document.getElementById("upload-status");
  if (!statusElement) {
    return;
  }

  statusElement.textContent = text;
  statusElement.classList.toggle("error", isError);
}

function setEscolaFilterInfo(text, isError = false) {
  const statusElement = document.getElementById("filtro-escola-info");
  if (!statusElement) {
    return;
  }
  statusElement.textContent = text || "";
  statusElement.classList.toggle("error", isError);
}

function formatInt(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function deduplicate(values) {
  return Array.from(new Set(values));
}

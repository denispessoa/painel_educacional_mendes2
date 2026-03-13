const COLORS = {
  teal: "#008b72",
  orange: "#ec8d2b",
  blue: "#3d7edb",
  red: "#c03734",
  ink: "#143a33",
  muted: "#4f6d66",
  grid: "#d7e7e1"
};

export function renderVisaoGeralCharts(rows, getChartById) {
  renderTendenciaProficiencia(rows, getChartById("chart-tendencia-proficiencia"));
  renderDesempenhoDisciplina(rows, getChartById("chart-proficiencia-disciplina"));
}

export function renderFonteCharts(rows, getChartById) {
  renderAvaliacaoPorAno(rows, getChartById("chart-avaliarj-ano"), "avalia", "AvaliaRJ");
  renderTopHabilidadesCnca(rows, getChartById("chart-cnca-habilidades"));
  renderSaebIdebComparativo(rows, getChartById("chart-saeb-ideb"));
}

export function renderFrequenciaChart(rows, getChartById) {
  const chart = getChartById("chart-frequencia-distribuicao");
  if (!chart) {
    return;
  }

  const frequencias = rows
    .map((row) => row.frequencia)
    .filter((value) => Number.isFinite(value));

  if (!frequencias.length) {
    renderNoData(chart, "Sem dados de frequencia para distribuicao.");
    return;
  }

  const bins = [
    { label: "0-59", min: 0, max: 59.999 },
    { label: "60-69", min: 60, max: 69.999 },
    { label: "70-79", min: 70, max: 79.999 },
    { label: "80-89", min: 80, max: 89.999 },
    { label: "90-100", min: 90, max: 100 }
  ];

  const counts = bins.map((bin) => {
    return frequencias.filter((value) => value >= bin.min && value <= bin.max).length;
  });

  chart.setOption(
    {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 14, top: 30, bottom: 40 },
      xAxis: {
        type: "category",
        data: bins.map((bin) => bin.label),
        axisLabel: { color: COLORS.muted }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: COLORS.muted },
        splitLine: { lineStyle: { color: COLORS.grid } }
      },
      series: [
        {
          name: "Turmas",
          type: "bar",
          barWidth: "56%",
          data: counts,
          itemStyle: {
            color: COLORS.orange,
            borderRadius: [8, 8, 0, 0]
          }
        }
      ]
    },
    true
  );
}

function renderTendenciaProficiencia(rows, chart) {
  if (!chart) {
    return;
  }

  const grouped = groupAverage(
    rows,
    (row) => (Number.isFinite(row.ano) ? String(row.ano) : ""),
    desempenhoValor
  )
    .sort((a, b) => Number(a.key) - Number(b.key));

  if (!grouped.length) {
    renderNoData(chart, "Sem dados anuais para tendencia.");
    return;
  }

  chart.setOption(
    {
      color: [COLORS.teal],
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 26, bottom: 36 },
      xAxis: {
        type: "category",
        data: grouped.map((item) => item.key),
        axisLabel: { color: COLORS.muted }
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: COLORS.muted,
          formatter: (value) => Number(value).toFixed(0)
        },
        splitLine: { lineStyle: { color: COLORS.grid } }
      },
      series: [
        {
          name: "Desempenho medio",
          type: "line",
          smooth: true,
          data: grouped.map((item) => round1(item.value)),
          areaStyle: { color: "rgba(0, 139, 114, 0.16)" },
          lineStyle: { width: 3 },
          symbolSize: 7
        }
      ]
    },
    true
  );
}

function renderDesempenhoDisciplina(rows, chart) {
  if (!chart) {
    return;
  }

  const grouped = groupAverage(
    rows,
    (row) => normalizeText(row.disciplina),
    desempenhoValor
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (!grouped.length) {
    renderNoData(chart, "Sem dados por disciplina.");
    return;
  }

  chart.setOption(
    {
      color: [COLORS.blue],
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 130, right: 16, top: 20, bottom: 24 },
      xAxis: {
        type: "value",
        axisLabel: { color: COLORS.muted },
        splitLine: { lineStyle: { color: COLORS.grid } }
      },
      yAxis: {
        type: "category",
        data: grouped.map((item) => limitLabel(item.key, 22)).reverse(),
        axisLabel: { color: COLORS.muted }
      },
      series: [
        {
          name: "Desempenho medio",
          type: "bar",
          data: grouped.map((item) => round1(item.value)).reverse(),
          barWidth: "56%",
          itemStyle: {
            borderRadius: [0, 8, 8, 0]
          }
        }
      ]
    },
    true
  );
}

function renderAvaliacaoPorAno(rows, chart, sourceFragment, sourceLabel) {
  if (!chart) {
    return;
  }

  const filtered = rows.filter((row) => normalizeText(row.avaliacao).toLowerCase().includes(sourceFragment));
  const grouped = groupAverage(
    filtered,
    (row) => (Number.isFinite(row.ano) ? String(row.ano) : ""),
    desempenhoValor
  )
    .sort((a, b) => Number(a.key) - Number(b.key));

  if (!grouped.length) {
    renderNoData(chart, `Sem registros para ${sourceLabel}.`);
    return;
  }

  chart.setOption(
    {
      color: [COLORS.teal],
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 24, bottom: 36 },
      xAxis: {
        type: "category",
        data: grouped.map((item) => item.key),
        axisLabel: { color: COLORS.muted }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: COLORS.muted },
        splitLine: { lineStyle: { color: COLORS.grid } }
      },
      series: [
        {
          name: `${sourceLabel} medio`,
          type: "line",
          smooth: true,
          data: grouped.map((item) => round1(item.value)),
          lineStyle: { width: 3 },
          symbolSize: 7,
          itemStyle: { color: COLORS.teal }
        }
      ]
    },
    true
  );
}

function renderTopHabilidadesCnca(rows, chart) {
  if (!chart) {
    return;
  }

  const cncaRows = rows.filter((row) => normalizeText(row.avaliacao).toLowerCase().includes("cnca"));
  const grouped = groupAverage(
    cncaRows,
    (row) => normalizeText(row.habilidade),
    desempenhoValor
  )
    .sort((a, b) => a.value - b.value)
    .slice(0, 12);

  if (!grouped.length) {
    renderNoData(chart, "Sem registros de habilidades CNCA.");
    return;
  }

  chart.setOption(
    {
      color: [COLORS.orange],
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 170, right: 18, top: 20, bottom: 24 },
      xAxis: {
        type: "value",
        axisLabel: { color: COLORS.muted },
        splitLine: { lineStyle: { color: COLORS.grid } }
      },
      yAxis: {
        type: "category",
        data: grouped.map((item) => limitLabel(item.key, 26)).reverse(),
        axisLabel: { color: COLORS.muted }
      },
      series: [
        {
          name: "Desempenho",
          type: "bar",
          data: grouped.map((item) => round1(item.value)).reverse(),
          barWidth: "56%",
          itemStyle: { borderRadius: [0, 8, 8, 0] }
        }
      ]
    },
    true
  );
}

function renderSaebIdebComparativo(rows, chart) {
  if (!chart) {
    return;
  }

  const filtered = rows.filter((row) => {
    const source = normalizeText(row.avaliacao).toLowerCase();
    return source.includes("saeb") || source.includes("ideb");
  });

  const desempenho = groupAverage(
    filtered,
    (row) => (Number.isFinite(row.ano) ? String(row.ano) : ""),
    desempenhoValor
  );

  const frequencia = groupAverage(
    filtered,
    (row) => (Number.isFinite(row.ano) ? String(row.ano) : ""),
    (row) => row.frequencia
  );

  const yearSet = new Set([...desempenho.map((item) => item.key), ...frequencia.map((item) => item.key)]);
  const years = Array.from(yearSet).sort((a, b) => Number(a) - Number(b));

  if (!years.length) {
    renderNoData(chart, "Sem registros SAEB/IDEB.");
    return;
  }

  const desempenhoMap = toMap(desempenho);
  const frequenciaMap = toMap(frequencia);

  chart.setOption(
    {
      color: [COLORS.blue, COLORS.orange],
      tooltip: { trigger: "axis" },
      legend: {
        top: 0,
        textStyle: { color: COLORS.muted },
        data: ["Desempenho medio", "Frequencia media"]
      },
      grid: { left: 46, right: 46, top: 42, bottom: 34 },
      xAxis: {
        type: "category",
        data: years,
        axisLabel: { color: COLORS.muted }
      },
      yAxis: [
        {
          type: "value",
          name: "Desempenho",
          axisLabel: { color: COLORS.muted },
          splitLine: { lineStyle: { color: COLORS.grid } }
        },
        {
          type: "value",
          name: "Frequencia %",
          axisLabel: { color: COLORS.muted },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: "Desempenho medio",
          type: "bar",
          data: years.map((year) => round1(desempenhoMap.get(year))),
          barWidth: "44%",
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        },
        {
          name: "Frequencia media",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          data: years.map((year) => round1(frequenciaMap.get(year))),
          symbolSize: 7,
          lineStyle: { width: 3 }
        }
      ]
    },
    true
  );
}

function groupAverage(rows, keySelector, valueSelector) {
  const map = new Map();

  rows.forEach((row) => {
    const key = normalizeText(keySelector(row));
    const value = valueSelector(row);

    if (!key || !Number.isFinite(value)) {
      return;
    }

    const current = map.get(key) || { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    map.set(key, current);
  });

  return Array.from(map.entries()).map(([key, value]) => {
    return { key, value: value.sum / value.count, count: value.count };
  });
}

function toMap(items) {
  const map = new Map();
  items.forEach((item) => {
    map.set(item.key, item.value);
  });
  return map;
}

function desempenhoValor(row) {
  if (Number.isFinite(row.proficiencia)) {
    return row.proficiencia;
  }
  if (Number.isFinite(row.percentual)) {
    return row.percentual;
  }
  return Number.NaN;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function round1(value) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : null;
}

function limitLabel(label, maxLength) {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}...`;
}

function renderNoData(chart, message) {
  chart.setOption(
    {
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: message,
            fontSize: 14,
            fill: COLORS.muted
          }
        }
      ]
    },
    true
  );
}

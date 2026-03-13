const COLORS = {
  muted: "#4f6d66",
  grid: "#d7e7e1"
};

export function renderHeatmapHabilidades(rows, getChartById) {
  const chart = getChartById("chart-heatmap-habilidades");
  if (!chart) {
    return;
  }

  const validRows = rows.filter((row) => {
    return normalizeText(row.disciplina) && normalizeText(row.habilidade) && Number.isFinite(desempenhoValor(row));
  });

  if (!validRows.length) {
    renderNoData(chart, "Sem dados para heatmap de habilidades.");
    return;
  }

  const disciplinas = topCategories(validRows, (row) => normalizeText(row.disciplina), 8);
  const habilidades = topCategories(validRows, (row) => normalizeText(row.habilidade), 12);

  const disciplinaSet = new Set(disciplinas);
  const habilidadeSet = new Set(habilidades);
  const matrix = new Map();

  validRows.forEach((row) => {
    const disciplina = normalizeText(row.disciplina);
    const habilidade = normalizeText(row.habilidade);
    const valor = desempenhoValor(row);

    if (!disciplinaSet.has(disciplina) || !habilidadeSet.has(habilidade) || !Number.isFinite(valor)) {
      return;
    }

    const key = `${disciplina}|||${habilidade}`;
    const current = matrix.get(key) || { sum: 0, count: 0 };
    current.sum += valor;
    current.count += 1;
    matrix.set(key, current);
  });

  const heatmapData = [];
  let maxValue = 0;

  matrix.forEach((value, key) => {
    const [disciplina, habilidade] = key.split("|||");
    const disciplinaIndex = disciplinas.indexOf(disciplina);
    const habilidadeIndex = habilidades.indexOf(habilidade);
    const media = value.sum / value.count;

    if (disciplinaIndex < 0 || habilidadeIndex < 0 || !Number.isFinite(media)) {
      return;
    }

    maxValue = Math.max(maxValue, media);
    heatmapData.push([habilidadeIndex, disciplinaIndex, round1(media)]);
  });

  if (!heatmapData.length) {
    renderNoData(chart, "Sem dados suficientes para compor matriz.");
    return;
  }

  chart.setOption(
    {
      tooltip: {
        position: "top",
        formatter: (params) => {
          const [habilidadeIndex, disciplinaIndex, value] = params.data;
          return `${disciplinas[disciplinaIndex]}<br>${habilidades[habilidadeIndex]}<br>Media: ${value}`;
        }
      },
      grid: { left: 120, right: 24, top: 20, bottom: 86 },
      xAxis: {
        type: "category",
        data: habilidades.map((item) => limitLabel(item, 18)),
        splitArea: { show: true },
        axisLabel: { color: COLORS.muted, rotate: 35 }
      },
      yAxis: {
        type: "category",
        data: disciplinas.map((item) => limitLabel(item, 22)),
        splitArea: { show: true },
        axisLabel: { color: COLORS.muted }
      },
      visualMap: {
        min: 0,
        max: Math.max(100, Math.ceil(maxValue)),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 8,
        text: ["Alto", "Baixo"],
        inRange: {
          color: ["#f9edd0", "#f3b55b", "#ec8d2b", "#be6a16", "#8b460d"]
        }
      },
      series: [
        {
          name: "Media",
          type: "heatmap",
          data: heatmapData,
          label: { show: true, fontSize: 10 },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: "rgba(0,0,0,0.15)"
            }
          }
        }
      ]
    },
    true
  );
}

function topCategories(rows, selector, limit) {
  const frequencies = new Map();

  rows.forEach((row) => {
    const key = selector(row);
    if (!key) {
      return;
    }
    frequencies.set(key, (frequencies.get(key) || 0) + 1);
  });

  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function desempenhoValor(row) {
  if (Number.isFinite(row.percentual)) {
    return row.percentual;
  }
  if (Number.isFinite(row.proficiencia)) {
    return row.proficiencia;
  }
  return Number.NaN;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function round1(value) {
  return Number(value.toFixed(1));
}

function limitLabel(label, maxLength) {
  return label.length <= maxLength ? label : `${label.slice(0, maxLength - 1)}...`;
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

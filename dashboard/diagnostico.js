const COLORS = {
  muted: "#4f6d66",
  red: "#c03734",
  green: "#1f7a56",
  grid: "#d7e7e1"
};

export function renderDiagnostico(rows, getChartById, config = {}) {
  const chart = getChartById("chart-diagnostico-gap");
  const targetScore = Number(config.targetScore) || 70;
  const listId = config.diagnosticsListId || "diagnostico-list";

  const disciplinaAverages = groupAverage(
    rows,
    (row) => normalizeText(row.disciplina),
    desempenhoValor
  ).sort((a, b) => a.value - b.value);

  if (!chart) {
    renderList(rows, disciplinaAverages, targetScore, listId);
    return;
  }

  if (!disciplinaAverages.length) {
    renderNoData(chart, "Sem dados para diagnostico por disciplina.");
    renderList(rows, disciplinaAverages, targetScore, listId);
    return;
  }

  const topDisciplines = disciplinaAverages.slice(0, 10);
  const seriesData = topDisciplines.map((item) => {
    const gap = item.value - targetScore;
    return {
      value: round1(gap),
      itemStyle: {
        color: gap < 0 ? COLORS.red : COLORS.green
      }
    };
  });

  chart.setOption(
    {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const param = params[0];
          const gap = Number(param.value);
          const signal = gap > 0 ? "+" : "";
          return `${param.name}<br>Gap: ${signal}${gap.toFixed(1)}`;
        }
      },
      grid: { left: 150, right: 24, top: 20, bottom: 36 },
      xAxis: {
        type: "value",
        axisLabel: {
          color: COLORS.muted,
          formatter: (value) => `${value}`
        },
        splitLine: { lineStyle: { color: COLORS.grid } }
      },
      yAxis: {
        type: "category",
        data: topDisciplines.map((item) => limitLabel(item.key, 24)).reverse(),
        axisLabel: { color: COLORS.muted }
      },
      series: [
        {
          name: "Gap vs meta",
          type: "bar",
          barWidth: "55%",
          data: seriesData.reverse(),
          label: {
            show: true,
            position: "right",
            formatter: (item) => `${item.value > 0 ? "+" : ""}${item.value}`
          }
        }
      ],
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#8ea9a1", type: "dashed" },
        data: [{ xAxis: 0 }]
      }
    },
    true
  );

  renderList(rows, disciplinaAverages, targetScore, listId);
}

function renderList(rows, disciplinaAverages, targetScore, listId) {
  const listElement = document.getElementById(listId);
  if (!listElement) {
    return;
  }

  const items = [];

  if (disciplinaAverages.length) {
    const lowestDisciplines = disciplinaAverages.slice(0, 3).map((item) => {
      const gap = item.value - targetScore;
      return `${item.key}: media ${round1(item.value)} (gap ${gap > 0 ? "+" : ""}${round1(gap)}).`;
    });
    items.push(`Disciplinas com maior urgencia: ${lowestDisciplines.join(" ")}`);

    const aboveTarget = disciplinaAverages.filter((item) => item.value >= targetScore).length;
    items.push(`${aboveTarget}/${disciplinaAverages.length} disciplinas estao na meta ${targetScore}.`);
  }

  const habilidadeAverages = groupAverage(
    rows,
    (row) => normalizeText(row.habilidade),
    desempenhoValor
  ).sort((a, b) => a.value - b.value);

  if (habilidadeAverages.length) {
    const weakest = habilidadeAverages
      .slice(0, 3)
      .map((item) => `${item.key} (${round1(item.value)})`)
      .join(", ");
    items.push(`Habilidades com menor dominio: ${weakest}.`);
  }

  if (!items.length) {
    items.push("Sem dados suficientes para sintese diagnostica.");
  }

  listElement.innerHTML = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    listElement.appendChild(li);
  });
}

function groupAverage(rows, keySelector, valueSelector) {
  const map = new Map();

  rows.forEach((row) => {
    const key = keySelector(row);
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
    return { key, value: value.sum / value.count };
  });
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

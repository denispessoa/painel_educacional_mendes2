const COLORS = {
  muted: "#4f6d66",
  red: "#c03734",
  orange: "#ec8d2b",
  grid: "#d7e7e1"
};

export function renderAlertasFrequencia(rows, getChartById, config = {}) {
  const threshold = Number(config.threshold) || 75;
  const listElementId = config.listElementId || "lista-alertas-frequencia";
  const chart = getChartById("chart-alertas-frequencia");

  const grouped = groupAverageByTurma(rows);
  const alerts = grouped
    .filter((item) => Number.isFinite(item.value) && item.value < threshold)
    .sort((a, b) => a.value - b.value)
    .slice(0, 15);

  if (chart) {
    if (!alerts.length) {
      renderNoData(chart, `Sem turmas abaixo de ${threshold}% de frequencia.`);
    } else {
      chart.setOption(
        {
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          grid: { left: 180, right: 22, top: 20, bottom: 24 },
          xAxis: {
            type: "value",
            axisLabel: {
              color: COLORS.muted,
              formatter: (value) => `${value}%`
            },
            splitLine: { lineStyle: { color: COLORS.grid } }
          },
          yAxis: {
            type: "category",
            data: alerts.map((item) => limitLabel(item.label, 30)).reverse(),
            axisLabel: { color: COLORS.muted }
          },
          series: [
            {
              name: "Frequencia media",
              type: "bar",
              barWidth: "52%",
              data: alerts.map((item) => round1(item.value)).reverse(),
              itemStyle: {
                borderRadius: [0, 8, 8, 0],
                color: (params) => {
                  if (params.value < 65) {
                    return COLORS.red;
                  }
                  return COLORS.orange;
                }
              },
              label: {
                show: true,
                position: "right",
                formatter: (item) => `${item.value}%`
              }
            }
          ]
        },
        true
      );
    }
  }

  renderAlertList(alerts, threshold, listElementId);
}

function groupAverageByTurma(rows) {
  const map = new Map();

  rows.forEach((row) => {
    if (!Number.isFinite(row.frequencia)) {
      return;
    }

    const escola = normalizeText(row.escola) || "Escola nao informada";
    const turma = normalizeText(row.turma) || "Turma nao informada";
    const key = `${escola}|||${turma}`;
    const current = map.get(key) || { sum: 0, count: 0, escola, turma };
    current.sum += row.frequencia;
    current.count += 1;
    map.set(key, current);
  });

  return Array.from(map.values()).map((item) => {
    const value = item.sum / item.count;
    return {
      label: `${item.escola} - ${item.turma}`,
      value
    };
  });
}

function renderAlertList(alerts, threshold, listElementId) {
  const listElement = document.getElementById(listElementId);
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  if (!alerts.length) {
    const item = document.createElement("li");
    item.textContent = `Nenhuma turma abaixo de ${threshold}% de frequencia.`;
    listElement.appendChild(item);
    return;
  }

  alerts.slice(0, 8).forEach((alert) => {
    const item = document.createElement("li");
    item.textContent = `${alert.label}: ${round1(alert.value)}% de frequencia media.`;
    listElement.appendChild(item);
  });
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

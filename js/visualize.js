// Visualization utilities for microgpt.js teaching sandbox

class Viz {
  // --- color utilities ---
  static heatColor(value, min = 0, max = 1) {
    const t = (max - min === 0) ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
    const h = (1 - t) * 240;
    const s = 80;
    const l = 30 + t * 35;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  static textColor(value, min = 0, max = 1) {
    const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
    return t > 0.5 ? '#fff' : '#000';
  }

  // --- attention heatmap ---
  static drawAttention(canvas, attnWeights, xLabels, yLabels) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rows = attnWeights.length;
    if (rows === 0) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const cols = attnWeights[0].length;
    if (cols === 0) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const dpr = window.devicePixelRatio || 1;
    const rectW = canvas.width / dpr;
    const rectH = canvas.height / dpr;
    canvas.width = rectW * dpr;
    canvas.height = rectH * dpr;
    ctx.scale(dpr, dpr);

    // Adaptive margins — smaller for tiny canvases
    const isSingleRow = rows === 1;
    const margin = {
      top: isSingleRow ? 8 : 20,
      right: 12,
      bottom: isSingleRow ? 8 : 25,
      left: isSingleRow ? 8 : 40,
    };
    const cellW = (rectW - margin.left - margin.right) / cols;
    const cellH = (rectH - margin.top - margin.bottom) / rows;

    ctx.clearRect(0, 0, rectW, rectH);

    // Find min/max for color scale
    let minV = Infinity, maxV = -Infinity;
    for (const row of attnWeights) {
      for (const v of row) {
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }
    const range = maxV - minV || 1;
    const minColor = minV - range * 0.1;

    // Draw cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = attnWeights[r][c];
        const x = margin.left + c * cellW;
        const y = margin.top + r * cellH;
        ctx.fillStyle = Viz.heatColor(v, minColor, maxV);
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);

        if (cellW > 30 && cellH > 20) {
          ctx.fillStyle = Viz.textColor(v, minColor, maxV);
          ctx.font = `${Math.min(10, cellH * 0.7)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(v.toFixed(2), x + cellW / 2, y + cellH / 2);
        }
      }
    }

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = `${isSingleRow ? 9 : 11}px monospace`;
    ctx.textAlign = 'center';

    // X-axis labels
    if (xLabels) {
      for (let c = 0; c < cols; c++) {
        ctx.fillText(xLabels[c] || c, margin.left + c * cellW + cellW / 2, margin.top - 4);
      }
    }

    // Y-axis labels
    if (yLabels) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < rows; r++) {
        ctx.fillText(yLabels[r] || r, margin.left - 4, margin.top + r * cellH + cellH / 2);
      }
    }

    // Color bar
    const barX = rectW - 20;
    const barY = margin.top;
    const barW = 10;
    const barH = rectH - margin.top - margin.bottom;
    for (let i = 0; i < barH; i++) {
      const t = 1 - i / barH;
      const val = minColor + t * (maxV - minColor);
      ctx.fillStyle = Viz.heatColor(val, minColor, maxV);
      ctx.fillRect(barX, barY + i, barW, 1);
    }
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(maxV.toFixed(2), barX + barW + 2, barY + 6);
    ctx.fillText(minColor.toFixed(2), barX + barW + 2, barY + barH);
  }

  // --- probability bars ---
  static drawProbs(canvas, probs, labels) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const margin = { top: 10, right: 20, bottom: 25, left: 45 };
    const barArea = H - margin.top - margin.bottom;
    const barW = (W - margin.left - margin.right) / probs.length - 1;

    let maxV = Math.max(...probs);
    if (maxV === 0) maxV = 1;

    for (let i = 0; i < probs.length; i++) {
      const x = margin.left + i * (barW + 1);
      const h = Math.max(1, (probs[i] / maxV) * barArea);
      const y = margin.top + barArea - h;

      ctx.fillStyle = `hsl(${(i / probs.length) * 360}, 70%, 50%)`;
      ctx.fillRect(x, y, barW, h);

      if (labels && labels[i]) {
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x + barW / 2, margin.top + barArea + 16);
      }
    }

    // Baseline
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + barArea);
    ctx.lineTo(W - margin.right, margin.top + barArea);
    ctx.stroke();

    // Value label on max bar
    const maxIdx = probs.indexOf(maxV);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    const valX = margin.left + maxIdx * (barW + 1) + barW / 2;
    ctx.fillText(maxV.toFixed(3), valX, margin.top + barArea - (probs[maxIdx] / maxV) * barArea - 4);
  }

  // --- loss curve ---
  static drawLossCurve(canvas, lossHistory) {
    if (!canvas || lossHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const margin = { top: 15, right: 15, bottom: 25, left: 50 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const minL = Math.min(...lossHistory) * 0.95;
    const maxL = Math.max(...lossHistory) * 1.05;
    const range = maxL - minL || 1;

    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < lossHistory.length; i++) {
      const x = margin.left + (i / Math.max(1, lossHistory.length - 1)) * plotW;
      const y = margin.top + plotH - ((lossHistory[i] - minL) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (lossHistory.length === 1) {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(margin.left, margin.top + plotH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(maxL.toFixed(2), margin.left - 6, margin.top + 10);
    ctx.fillText(minL.toFixed(2), margin.left - 6, margin.top + plotH);

    ctx.textAlign = 'center';
    ctx.fillText('0', margin.left, margin.top + plotH + 16);
    ctx.fillText(`${lossHistory.length - 1}`, margin.left + plotW, margin.top + plotH + 16);
  }

  // --- embedding matrix heatmap ---
  static drawEmbedding(canvas, matrix, rowLabels, colLabels) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rows = matrix.length;
    if (rows === 0) return;
    const cols = matrix[0].length;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const margin = { top: 10, right: 5, bottom: 20, left: 30 };
    const cellW = (W - margin.left - margin.right) / cols;
    const cellH = (H - margin.top - margin.bottom) / rows;

    let minV = Infinity, maxV = -Infinity;
    for (const row of matrix) {
      for (const v of row) {
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = matrix[r][c];
        const x = margin.left + c * cellW;
        const y = margin.top + r * cellH;
        ctx.fillStyle = Viz.heatColor(v, minV, maxV);
        ctx.fillRect(x, y, cellW, cellH);
      }
    }

    if (rowLabels) {
      ctx.fillStyle = '#888';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      for (let r = 0; r < Math.min(rows, rowLabels.length); r++) {
        ctx.fillText(rowLabels[r], margin.left - 3, margin.top + r * cellH + cellH * 0.7);
      }
    }
  }

  // --- vector as bar chart ---
  static drawVector(canvas, values, color = '#4ecdc4') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const margin = { top: 5, right: 10, bottom: 5, left: 5 };
    const barArea = H - margin.top - margin.bottom;
    const barW = (W - margin.left - margin.right) / values.length - 1;

    let maxAbs = Math.max(Math.abs(Math.max(...values)), Math.abs(Math.min(...values)));
    if (maxAbs === 0) maxAbs = 1;
    const midY = margin.top + barArea / 2;

    for (let i = 0; i < values.length; i++) {
      const x = margin.left + i * (barW + 1);
      const h = (values[i] / maxAbs) * (barArea / 2);
      const y = values[i] >= 0 ? midY - h : midY;
      const height = Math.abs(h);

      ctx.fillStyle = values[i] >= 0 ? color : '#ff6b6b';
      ctx.fillRect(x, y, barW, height || 1);
    }

    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(margin.left, midY);
    ctx.lineTo(W - margin.right, midY);
    ctx.stroke();
  }
}

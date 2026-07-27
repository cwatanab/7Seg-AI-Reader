import { BoundingBox } from './yoloInference';

/**
 * BoundingBox のオーバーレイを Canvas 上に描画する (Apple Action Blue スタイル)
 */
export function drawDetections(
  boxes: BoundingBox[],
  videoW: number,
  videoH: number,
  canvas: HTMLCanvasElement,
  imageSource?: HTMLImageElement | HTMLCanvasElement
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const containerW = canvas.parentElement?.clientWidth || videoW;
  const containerH = canvas.parentElement?.clientHeight || videoH;

  canvas.width = containerW;
  canvas.height = containerH;
  ctx.clearRect(0, 0, containerW, containerH);

  const scale = videoW > 0 && videoH > 0 ? Math.max(containerW / videoW, containerH / videoH) : 1;
  const renderedW = videoW * scale;
  const renderedH = videoH * scale;
  const offsetX = (containerW - renderedW) / 2;
  const offsetY = (containerH - renderedH) / 2;

  if (imageSource) {
    ctx.drawImage(imageSource, offsetX, offsetY, renderedW, renderedH);
  }

  boxes.forEach((box) => {
    const nX1 = box.normX1 ?? (videoW > 0 ? Math.max(0, Math.min(1, box.x1 / videoW)) : 0);
    const nY1 = box.normY1 ?? (videoH > 0 ? Math.max(0, Math.min(1, box.y1 / videoH)) : 0);
    const nX2 = box.normX2 ?? (videoW > 0 ? Math.max(0, Math.min(1, box.x2 / videoW)) : 0);
    const nY2 = box.normY2 ?? (videoH > 0 ? Math.max(0, Math.min(1, box.y2 / videoH)) : 0);

    const bx1 = nX1 * renderedW + offsetX;
    const by1 = nY1 * renderedH + offsetY;
    const bw = Math.max(1, (nX2 - nX1) * renderedW);
    const bh = Math.max(1, (nY2 - nY1) * renderedH);

    const lineWidth = Math.max(2, Math.round(Math.min(containerW, containerH) * 0.003));

    // Apple Action Blue (#0066cc) 検出枠
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = 0;
    ctx.strokeRect(bx1, by1, bw, bh);

    // ラベルと信頼度（小さく表示）
    const confidencePercent = Math.round(box.score * 100);
    const labelText = box.label;
    const confText = `${confidencePercent}%`;

    const mainFontSize = Math.max(12, Math.min(16, Math.round(bh * 0.18)));
    const smallFontSize = Math.max(9, Math.round(mainFontSize * 0.72));

    ctx.font = `600 ${mainFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const mainWidth = ctx.measureText(labelText).width;

    ctx.font = `400 ${smallFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const confWidth = ctx.measureText(confText).width;

    const paddingX = 6;
    const paddingY = 3;
    const gap = 4;
    const totalWidth = mainWidth + gap + confWidth;
    const tagHeight = mainFontSize + paddingY * 2;

    const labelY = by1 - tagHeight >= 0 ? by1 - tagHeight : by1;

    // Apple Action Blue (#0066cc) ラベル背景タグ
    ctx.fillStyle = '#0066cc';
    ctx.fillRect(bx1, labelY, totalWidth + paddingX * 2, tagHeight);

    // 主文字 (検出ラベル)
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${mainFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(labelText, bx1 + paddingX, labelY + mainFontSize - 1);

    // 小さな文字 (信頼度 %)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `400 ${smallFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(confText, bx1 + paddingX + mainWidth + gap, labelY + mainFontSize - 1);
  });
}

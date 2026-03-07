export class PexelsTool {
  render(data, toolCall) {
    if (data.error) return window.toolErrorEl(`Pexels error: ${data.error}`);
    const card = document.createElement('div');
    card.className = 'tool-card pexels-card';
    const isVideo = data.type === 'video';
    const query   = window.escapeHtml(data.query);
    const mediaHTML = isVideo
      ? `<video
           class="pexels-media"
           src="${window.escapeHtml(data.video_url)}"
           autoplay muted loop playsinline
         ></video>`
      : `<img
           class="pexels-media"
           src="${window.escapeHtml(data.image_url)}"
           alt="${query}"
           loading="lazy"
         />`;
    const photographerHTML = data.photographer
      ? `<span class="pexels-photographer">${window.escapeHtml(data.photographer)}</span>`
      : '';
    const durationHTML = isVideo && data.duration
      ? `<span class="pexels-duration">${data.duration}s</span>`
      : '';
    const downloadURL  = isVideo ? window.escapeHtml(data.video_url) : window.escapeHtml(data.image_url);
    const downloadName = isVideo ? `pexels-${query}.mp4` : `pexels-${query}.jpg`;
    card.innerHTML = `
      <div class="pexels-header">
        <span class="pexels-type-badge">${isVideo ? 'Video' : 'Photo'}</span>
        <span class="pexels-query">${query}</span>
      </div>
      <div class="pexels-media-wrap">
        ${mediaHTML}
      </div>
      <div class="pexels-footer">
        ${photographerHTML}
        ${durationHTML}
        <a class="pexels-download" href="${downloadURL}" download="${downloadName}" target="_blank" rel="noopener">Download</a>
        <a class="pexels-attribution" href="${window.escapeHtml(data.pexels_url)}" target="_blank" rel="noopener">via Pexels</a>
      </div>
    `;
    return card;
  }
}
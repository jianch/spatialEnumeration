/* Physical interface sizing shares the stimulus screen-width calibration.
 * Font sizes use measured glyph bounds, rather than treating em size as ink height.
 */
(function (root) {
  'use strict';
  const fontFamily = 'system-ui, -apple-system, sans-serif';
  function applyCalibration(config, pixelsPerMm) {
    if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) throw new Error('Invalid physical display calibration.');
    const context = document.createElement('canvas').getContext('2d');
    function fontSize(glyphHeightMm, text, weight) {
      context.font = `${weight} 100px ${fontFamily}`;
      const bounds = context.measureText(text);
      const height = bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent;
      return glyphHeightMm * pixelsPerMm * 100 / height;
    }
    const typography = {
      instruction_font_px: fontSize(config.typography.instructionCapitalHeightMm, 'H', 400),
      heading_font_px: fontSize(config.typography.headingCapitalHeightMm, 'H', 600),
      number_font_px: fontSize(config.responsePad.numberGlyphHeightMm, '0123456789', 600),
      reminder_font_px: fontSize(config.responsePad.reminderGlyphHeightMm, 'H', 400)
    };
    const style = document.documentElement.style;
    for (const [name, size] of Object.entries(typography)) style.setProperty('--' + name.replaceAll('_', '-'), `${size}px`);
    style.setProperty('--pad-width', `${(config.responsePad.numbers.length * config.responsePad.buttonWidthMm + (config.responsePad.numbers.length - 1) * config.responsePad.gapMm) * pixelsPerMm}px`);
    style.setProperty('--pad-button-height', `${config.responsePad.buttonHeightMm * pixelsPerMm}px`);
    style.setProperty('--pad-gap', `${config.responsePad.gapMm * pixelsPerMm}px`);
    style.setProperty('--reminder-line-height', `${config.responsePad.reminderLineHeightMm * pixelsPerMm}px`);
    return typography;
  }
  root.EnumerationDisplay = {applyCalibration};
})(globalThis);

/** JSON for an HTML script data assignment, including recursively embedded HTML.
 * Escape '<' as source text so no data string can close its enclosing script.
 * Construct the backslash explicitly to avoid source-transport escape ambiguity.
 */
export function inlineAssetJson(value) {
  const json = JSON.stringify(value);
  if (typeof json !== 'string') throw new TypeError('Inline assets must serialize to JSON');
  return json.replaceAll('<', String.fromCharCode(92) + 'u003c');
}

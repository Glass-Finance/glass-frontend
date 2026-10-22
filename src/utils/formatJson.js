// Validate syntax, then change whitespace only. Parsing and stringifying would
// round large numbers, normalize escapes, and collapse/reorder object keys.
export function formatJson(value) {
  try {
    JSON.parse(value);
  } catch {
    return null;
  }

  const tokens = value.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g);
  let depth = 0;
  const indent = () => "  ".repeat(depth);
  return tokens
    .map((token, index) => {
      if (token === "{" || token === "[") {
        depth++;
        return (
          token + (tokens[index + 1] === "}" || tokens[index + 1] === "]" ? "" : `\n${indent()}`)
        );
      }
      if (token === "}" || token === "]") {
        depth--;
        return (
          (tokens[index - 1] === "{" || tokens[index - 1] === "[" ? "" : `\n${indent()}`) + token
        );
      }
      if (token === ",") return `,\n${indent()}`;
      if (token === ":") return ": ";
      return token;
    })
    .join("");
}

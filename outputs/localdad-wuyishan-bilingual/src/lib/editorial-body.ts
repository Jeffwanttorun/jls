export interface EditorialBodySections {
  includesSources: boolean;
}

export function inspectEditorialBody(body = ""): EditorialBodySections {
  return {
    includesSources:/^##\s+Sources and Further Reading\s*$/im.test(body),
  };
}

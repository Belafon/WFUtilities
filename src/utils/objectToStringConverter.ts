// (e.g., utils/objectToStringConverter.ts)
export class CodeLiteral {
  constructor(public value: string) {}
}

export class ObjectToStringConverter {
  private indentChar: string;

  constructor(indentChar: string = '  ') {
    this.indentChar = indentChar;
  }

  private getIndent(level: number): string {
    return this.indentChar.repeat(level);
  }

  public convert(obj: any, indentLevel: number = 0): string {
    if (obj === null) {
      return 'null';
    }
    if (obj === undefined) {
      return 'undefined';
    }
    if (obj instanceof CodeLiteral) {
      return obj.value;
    }
    if (typeof obj === 'string') {
      // Default: treat as string literal and quote
      return `'${obj.replace(/'/g, "\\'")}'`;
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    if (Array.isArray(obj)) {
      const currentIndent = this.getIndent(indentLevel);
      const nextItemIndentLevel = indentLevel + 1;
      if (obj.length === 0) {
        return '[]';
      }
      const items = obj
        .map(item => `${this.getIndent(nextItemIndentLevel)}${this.convert(item, nextItemIndentLevel)}`)
        .join(',\n');
      return `[\n${items}\n${currentIndent}]`;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      const currentIndent = this.getIndent(indentLevel);
      const nextPropIndentLevel = indentLevel + 1;

      if (keys.length === 0) {
        return '{}';
      }
      // Filter out properties explicitly set to undefined *if desired*,
      // or map them to "key: undefined". For now, let's map them.
      const properties = keys
        .map(key => {
          const value = obj[key];
          const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
          return `${this.getIndent(nextPropIndentLevel)}${formattedKey}: ${this.convert(value, nextPropIndentLevel)}`;
        })
        .join(',\n');
      return `{\n${properties}\n${currentIndent}}`;
    }
    // Fallback for other types (e.g., functions, symbols) - might need specific handling
    return String(obj);
  }
}

// Instantiate or import as needed in PassageManager
// const objectToStringConverter = new ObjectToStringConverter();
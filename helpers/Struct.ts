/**
 * This file is part of the Stalker 2 Modding Tools project.
 * This is a base class for all structs.
 */
export abstract class Struct {
  static reservedKeys = new Set([
    "reservedKeys",
    "isRoot",
    "refurl",
    "refkey",
    "TAB",
    "pad",
    "renderRef",
    "toString",
  ]);
  isRoot?: boolean = false;
  refurl?: string = undefined;
  refkey?: string | number = undefined;
  static TAB = "   ";
  static pad(text: string): string {
    return `${Struct.TAB}${text.replace(/\n+/g, `\n${Struct.TAB}`)}`;
  }

  static detectNumber(value: string | number): value is number {
    return typeof value === "number" || parseInt(value).toString() === value;
  }

  static renderRef(ref: string): string {
    if (ref === "_" || ref === "*") {
      return "[*]"; // Special case for wildcard structs
    }
    if (parseInt(ref).toString() === ref || typeof ref === "number") {
      return `[${ref}]`;
    }
    return ref;
  }

  toString(): string {
    const allKeys = Object.keys(this).filter(
      (key) => !Struct.reservedKeys.has(key),
    );
    let text: string;
    text = this.isRoot ? `${this.constructor.name} : ` : "";
    text += "struct.begin";
    const refs = ["refurl", "refkey"]
      .map((k) => [k, this[k]])
      .filter(([_, v]) => v != null)
      .map(([k, v]) => `${k}=${Struct.renderRef(v)}`)
      .join(";");
    if (refs) {
      text += ` {${refs}}`;
    }
    text += "\n";
    // Add all keys
    text += allKeys
      .filter((k) => this[k])
      .map((key) =>
        Struct.pad(
          `${Struct.renderRef(key)} ${this[key] instanceof Struct ? ":" : "="} ${this[key]}`,
        ),
      )
      .join("\n");
    text += "\nstruct.end";
    return text;
  }

  static fromString<IntendedType = Struct>(text: string): IntendedType {
    const lines = text.trim().split("\n");

    const parseHead = (line: string): Struct => {
      const match = line.match(
        /^(.*) : struct\.begin\s*({\s*((refurl|refkey)\s*=.+)\s*})?/,
      );
      if (!match) {
        throw new Error(`Invalid struct head: ${line}`);
      }
      let name = match[1].trim();
      if (name === "[*]") {
        name = "_"; // Special case for wildcard structs
      }
      const Dummy = new Function(
        "parent",
        `return class ${name} extends parent {}`,
      )(Struct);
      const dummy = new Dummy();
      if (match[3]) {
        const refs = match[3]
          .split(";")
          .map((ref) => ref.trim())
          .filter(Boolean)
          .reduce(
            (acc, ref) => {
              const [key, value] = ref.split("=");
              acc[key.trim()] = value.trim();
              return acc;
            },
            {} as Record<string, string>,
          );
        dummy.refurl = refs.refurl;
        dummy.refkey = refs.refkey;
      }
      return dummy as Struct;
    };

    const root = parseHead(lines[0]);
    root.isRoot = true;

    const walk = (current: Struct, lines: string[], index: number): number => {
      while (index < lines.length) {
        const line = lines[index].trim();
        if (line === "struct.end") {
          return index + 1; // Move past the end of the current struct
        }
        if (line.includes("struct.begin")) {
          // This is a nested struct
          const nestedStruct = parseHead(line);
          current[nestedStruct.constructor.name] = nestedStruct;
          index++;
          index = walk(nestedStruct, lines, index);
        } else {
          // This is a key-value pair
          const [key, value] = line.split("=").map((s) => s.trim());
          current[key] = Struct.detectNumber(value) ? parseInt(value) : value;
          index++;
        }
      }
      return index;
    };
    walk(root, lines, 1);

    return root as IntendedType;
  }
}

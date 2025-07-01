/**
 * This file is part of the Stalker 2 Modding Tools project.
 * This is a base class for all structs.
 */
export abstract class Struct {
  static reservedKeys = new Set(["isRoot", "refurl", "refkey", "_id"]);
  isRoot?: boolean;
  refurl?: string = undefined;
  refkey?: string | number = undefined;
  abstract _id: string;

  static TAB = "   ";
  static pad(text: string): string {
    return `${Struct.TAB}${text.replace(/\n+/g, `\n${Struct.TAB}`)}`;
  }
  static WILDCARD = "_wildcard";
  static isNumber(ref: string): boolean {
    return Number.isInteger(parseInt(ref)) || typeof ref === "number";
  }
  static renderKeyName(ref: string): string {
    if (`${ref}`.startsWith("_")) {
      return Struct.renderKeyName(ref.slice(1)); // Special case for indexed structs
    }
    if (`${ref}`.includes("*")) {
      return "[*]"; // Special case for wildcard structs
    }
    if (`${ref}`.includes("_dupe_")) {
      return Struct.renderKeyName(ref.slice(0, ref.indexOf("_dupe_")));
    }
    if (Struct.isNumber(ref)) {
      return `[${parseInt(ref)}]`;
    }
    return ref;
  }

  static renderStructName(name: string): string {
    if (name === Struct.WILDCARD) {
      return "[*]"; // Special case for wildcard structs
    }
    if (`${name}`.startsWith("_")) {
      return Struct.renderStructName(name.slice(1)); // Special case for indexed structs
    }
    if (Struct.isNumber(name)) {
      return `[${parseInt(name)}]`;
    }
    return name;
  }

  static parseStructName(name: string): string {
    if (name === "[*]") {
      return Struct.WILDCARD; // Special case for wildcard structs
    }
    if (/\[(\d+)]/.test(name)) {
      return `_${name.match(/\[(\d+)]/)[1]}`; // Special case for indexed structs
    }
    return name;
  }

  static parseKeyName(key: string): string {
    return key;
  }

  static createDynamicClass = (name: string): new () => Struct =>
    new Function("parent", `return class ${name} extends parent {}`)(Struct);

  toString(): string {
    const allKeys = Object.keys(this).filter(
      (key) => !Struct.reservedKeys.has(key),
    );
    let text: string;
    text = this["__proto__"].isRoot
      ? `${Struct.renderStructName(this._id)} : `
      : "";
    text += "struct.begin";
    const refs = ["refurl", "refkey"]
      .map((k) => [k, this[k]])
      .filter(([_, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => `${k}=${Struct.renderKeyName(v)}`)
      .join(";");
    if (refs) {
      text += ` {${refs}}`;
    }
    text += "\n";
    // Add all keys
    text += allKeys
      .filter((k) => this[k] != null)
      .map((key) =>
        Struct.pad(
          `${Struct.renderKeyName(key)} ${this[key] instanceof Struct ? ":" : "="}${" ".repeat(+(this[key] !== ""))}${this[key]}`,
        ),
      )
      .join("\n");
    text += "\nstruct.end";
    return text;
  }

  toTs(): string {
    return JSON.stringify(this, null, 2);
  }

  static fromString<IntendedType = Struct>(text: string): IntendedType[] {
    const lines = text.trim().split("\n");

    const parseHead = (line: string): Struct => {
      const match = line.match(
        /^(.*)\s*:\s*struct\.begin\s*({\s*((refurl|refkey)\s*=.+)\s*})?/,
      );
      if (!match) {
        throw new Error(`Invalid struct head: ${line}`);
      }
      let name = Struct.parseStructName(match[1].trim());

      const dummy = new (Struct.createDynamicClass(name))();
      if (name === match[1].trim()) {
        dummy._id = name;
      }
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

    const parseKeyValue = (line: string, parent: Struct): void => {
      const match = line.match(/^(.*?)(\s*:\s*|\s*=\s*)(.*)$/);
      if (!match) {
        throw new Error(`Invalid key-value pair: ${line}`);
      }
      const key = Struct.parseKeyName(match[1].trim());
      const value = match[3].trim();
      if (parent[key] === undefined) {
        parent[key] = value;
      } else {
        parent[`${key}_dupe_${index}`] = value;
      }
    };
    let index = 0;

    const walk = () => {
      const roots: Struct[] = [];
      const stack = [];
      while (index < lines.length) {
        const line = lines[index++].trim();
        const current = stack[stack.length - 1];
        if (line.includes("struct.begin")) {
          const newStruct = parseHead(line);
          if (current) {
            const key = Struct.renderStructName(newStruct.constructor.name);
            if (current[key] !== undefined) {
              current[`${key}_dupe_${index}`] = newStruct;
            } else {
              current[key] = newStruct;
            }
          } else {
            newStruct["__proto__"].isRoot = true;
            roots.push(newStruct);
          }
          stack.push(newStruct);
        } else if (line.includes("struct.end")) {
          stack.pop();
        } else if (line.includes("=") && current) {
          parseKeyValue(line, current);
        }
      }
      return roots;
    };

    return walk() as IntendedType[];
  }
}

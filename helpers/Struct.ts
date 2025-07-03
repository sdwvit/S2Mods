export type Value = Omit<Struct, "toTs"> | string | number;
export type Entries = Record<string, Value> | Value[];

/**
 * This file is part of the Stalker 2 Modding Tools project.
 * This is a base class for all structs.
 */
export abstract class Struct {
  isRoot?: boolean;
  refurl?: string = undefined;
  refkey?: string | number = undefined;
  bskipref?: boolean;
  abstract _id: string;
  entries: Entries;

  static TAB = "   ";
  static pad(text: string): string {
    return `${Struct.TAB}${text.replace(/\n+/g, `\n${Struct.TAB}`)}`;
  }
  static WILDCARD = "_wildcard";
  static isNumber(ref: string): boolean {
    return Number.isInteger(parseInt(ref)) || typeof ref === "number";
  }
  static isArrayKey(key: string) {
    return key.includes("[") && key.includes("]");
  }
  static renderKeyName(ref: string, useAsterisk?: boolean): string {
    if (`${ref}`.startsWith("_")) {
      return Struct.renderKeyName(ref.slice(1), useAsterisk); // Special case for indexed structs
    }
    if (`${ref}`.includes("*") || useAsterisk) {
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

  static extractKeyFromBrackets(key: string) {
    if (/\[(.+)]/.test(key)) {
      return key.match(/\[(.+)]/)[1];
    }
    return "";
  }

  static parseStructName(name: string): string {
    if (Struct.extractKeyFromBrackets(name) === "*") {
      return Struct.WILDCARD; // Special case for wildcard structs
    }
    if (Struct.isNumber(Struct.extractKeyFromBrackets(name))) {
      return `_${name.match(/\[(\d+)]/)[1]}`; // Special case for indexed structs
    }
    return name;
  }

  static createDynamicClass = (name: string): new () => Struct =>
    new Function("parent", `return class ${name} extends parent {}`)(Struct);

  toString(): string {
    let text: string;
    text = this.isRoot ? `${Struct.renderStructName(this._id)} : ` : "";
    text += "struct.begin";
    const refs = ["refurl", "refkey", "bskipref"]
      .map((k) => [k, this[k]])
      .filter(([_, v]) => v !== "" && v !== undefined && v !== false)
      .map(([k, v]) => {
        if (v === true) return k;
        return `${k}=${Struct.renderKeyName(v)}`;
      })
      .join(";");
    if (refs) {
      text += ` {${refs}}`;
    }
    text += "\n";
    // Add all keys
    text += Object.entries(this.entries)
      .filter(([key]) => key !== "_useAsterisk")
      .map(([key, value]) =>
        Struct.pad(
          `${Struct.renderKeyName(key, this.entries["_useAsterisk"])} ${value instanceof Struct ? ":" : "="}${" ".repeat(+(value !== ""))}${value}`,
        ),
      )
      .join("\n");
    text += "\nstruct.end";
    return text;
  }

  toTs(): string {
    return JSON.stringify(this, null, 2);
  }

  static addEntry(parent: Struct, key: string, value: Value, index: number) {
    if (Struct.isArrayKey(key)) {
      parent.entries ||= [];
      if (Struct.extractKeyFromBrackets(key) === "*") {
        parent.entries["_useAsterisk"] = true;
        (parent.entries as Value[]).push(value);
      } else {
        (parent.entries as Value[])[Struct.extractKeyFromBrackets(key)] = value;
      }
    } else {
      parent.entries ||= {};
      if (parent.entries[key] === undefined) {
        parent.entries[key] = value;
      } else {
        parent.entries[`${key}_dupe_${index}`] = value;
      }
    }
  }

  static fromString<IntendedType extends Partial<Struct> = Struct>(
    text: string,
  ): IntendedType[] {
    const lines = text.trim().split("\n");

    const parseHead = (line: string): Struct => {
      const match = line.match(
        /^(.*)\s*:\s*struct\.begin\s*({\s*((refurl|refkey|bskipref)\s*(=.+)?)\s*})?/,
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
              acc[key.trim()] = value ? value.trim() : true;
              return acc;
            },
            {} as { refurl?: string; refkey?: string; bskipref?: boolean },
          );
        dummy.refurl = refs.refurl;
        dummy.refkey = refs.refkey;
        dummy.bskipref = refs.bskipref;
      }
      return dummy as Struct;
    };

    const parseKeyValue = (line: string, parent: Struct): void => {
      const match = line.match(/^(.*?)(\s*:\s*|\s*=\s*)(.*)$/);
      if (!match) {
        throw new Error(`Invalid key-value pair: ${line}`);
      }
      const key = match[1].trim();
      const value = match[3].trim();
      Struct.addEntry(parent, key, value, index);
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
            Struct.addEntry(current, key, newStruct, index);
          } else {
            newStruct.isRoot = true;
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

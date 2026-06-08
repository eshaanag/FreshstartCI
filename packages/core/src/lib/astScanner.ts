import { readdir } from "node:fs/promises";
import path from "node:path";

import { Node, Project, type BindingElement, type SourceFile, ts } from "ts-morph";

export interface EnvVarUsage {
  name: string;
  file: string;
  line: number;
  accessPattern: "process.env" | "import.meta.env" | "destructuring";
}

export interface DynamicEnvAccess {
  file: string;
  line: number;
  expression: string;
}

export interface EnvScanResult {
  usages: EnvVarUsage[];
  dynamicAccesses: DynamicEnvAccess[];
  filesScanned: number;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const EXCLUDED_DIRECTORIES = new Set(["node_modules", "dist", ".git", ".next", "coverage"]);

/**
 * Scans JavaScript and TypeScript source files for environment variable usage.
 *
 * @param repoPath - Repository root to scan.
 * @param ignore - Path prefixes to skip while walking source files.
 * @returns Static env var usages, dynamic accesses, and file count.
 *
 * @example
 * ```ts
 * const scan = await scanEnvUsage("/repo");
 * scan.usages.map((usage) => usage.name);
 * ```
 */
export async function scanEnvUsage(
  repoPath: string,
  ignore: string[] = [],
): Promise<EnvScanResult> {
  const files = await listSourceFiles(repoPath, repoPath, ignore);
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
    },
    skipAddingFilesFromTsConfig: true,
  });
  const usages: EnvVarUsage[] = [];
  const dynamicAccesses: DynamicEnvAccess[] = [];

  for (const file of files) {
    const sourceFile = project.addSourceFileAtPath(file);
    collectEnvUsage(sourceFile, repoPath, usages, dynamicAccesses);
  }

  return {
    usages: dedupeUsages(usages),
    dynamicAccesses: dedupeDynamicAccesses(dynamicAccesses),
    filesScanned: files.length,
  };
}

async function listSourceFiles(
  rootPath: string,
  currentPath: string,
  ignore: string[],
): Promise<string[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);

    if (shouldIgnore(relativePath, entry.name, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(rootPath, fullPath, ignore)));
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectEnvUsage(
  sourceFile: SourceFile,
  repoPath: string,
  usages: EnvVarUsage[],
  dynamicAccesses: DynamicEnvAccess[],
): void {
  sourceFile.forEachDescendant((node) => {
    if (Node.isPropertyAccessExpression(node)) {
      const expressionText = node.getExpression().getText();

      if (expressionText === "process.env" || expressionText === "import.meta.env") {
        usages.push(usage(sourceFile, repoPath, node, node.getName(), expressionText));
      }
    }

    if (Node.isElementAccessExpression(node)) {
      const expressionText = node.getExpression().getText();

      if (expressionText === "process.env" || expressionText === "import.meta.env") {
        const argument = node.getArgumentExpression();

        if (
          argument !== undefined &&
          (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        ) {
          usages.push(usage(sourceFile, repoPath, node, argument.getLiteralText(), expressionText));
        } else {
          dynamicAccesses.push(dynamicAccess(sourceFile, repoPath, node));
        }
      }
    }

    if (Node.isVariableDeclaration(node) && isEnvObjectText(node.getInitializer()?.getText())) {
      const nameNode = node.getNameNode();

      if (Node.isObjectBindingPattern(nameNode)) {
        for (const element of nameNode.getElements()) {
          const name = bindingElementName(element);

          if (name !== undefined) {
            usages.push(usage(sourceFile, repoPath, element, name, "destructuring"));
          }
        }
      }
    }
  });
}

function usage(
  sourceFile: SourceFile,
  repoPath: string,
  node: Node,
  name: string,
  accessPattern: EnvVarUsage["accessPattern"],
): EnvVarUsage {
  return {
    name,
    file: path.relative(repoPath, sourceFile.getFilePath()),
    line: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
    accessPattern,
  };
}

function dynamicAccess(sourceFile: SourceFile, repoPath: string, node: Node): DynamicEnvAccess {
  return {
    file: path.relative(repoPath, sourceFile.getFilePath()),
    line: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
    expression: node.getText(),
  };
}

function bindingElementName(element: BindingElement): string | undefined {
  const propertyName = element.getPropertyNameNode();

  if (propertyName !== undefined) {
    return propertyName.getText().replace(/^["']|["']$/g, "");
  }

  const nameNode = element.getNameNode();

  return Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
}

function isEnvObjectText(text: string | undefined): boolean {
  return text === "process.env" || text === "import.meta.env";
}

function shouldIgnore(relativePath: string, entryName: string, ignore: string[]): boolean {
  return (
    EXCLUDED_DIRECTORIES.has(entryName) ||
    ignore.some(
      (ignorePath) => relativePath === ignorePath || relativePath.startsWith(`${ignorePath}/`),
    )
  );
}

function dedupeUsages(usages: EnvVarUsage[]): EnvVarUsage[] {
  const seen = new Set<string>();

  return usages.filter((usageItem) => {
    const key = `${usageItem.name}:${usageItem.file}:${usageItem.line}:${usageItem.accessPattern}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeDynamicAccesses(accesses: DynamicEnvAccess[]): DynamicEnvAccess[] {
  const seen = new Set<string>();

  return accesses.filter((access) => {
    const key = `${access.file}:${access.line}:${access.expression}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

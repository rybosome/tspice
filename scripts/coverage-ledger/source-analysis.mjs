import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function filesUnder(root, suffix) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(root, entry.name);
      return entry.isDirectory()
        ? filesUnder(file, suffix)
        : file.endsWith(suffix)
          ? [file]
          : [];
    })
    .sort();
}

export function source(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}

export function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

export function unwrap(node) {
  while (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isTypeAssertionExpression(node)
  )
    node = node.expression;
  return node;
}

export function evidence(root, node) {
  const file = node.getSourceFile();
  return {
    file: path.relative(root, file.fileName).split(path.sep).join("/"),
    line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
  };
}

export function contractMethods(root) {
  const entry = path.join(root, "packages/backend-contract/src/index.ts");
  const program = ts.createProgram([entry], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
  const checker = program.getTypeChecker();
  const raw = program
    .getSourceFile(entry)
    .statements.find(
      (node) =>
        ts.isInterfaceDeclaration(node) && node.name.text === "SpiceRawBackend",
    );
  if (!raw) throw new Error("Missing SpiceRawBackend interface");
  return checker
    .getTypeAtLocation(raw)
    .getProperties()
    .map((symbol) => {
      const declaration = symbol.declarations?.find(ts.isMethodSignature);
      if (!declaration)
        throw new Error(
          `Raw property ${symbol.name} is not a method signature`,
        );
      return {
        name: symbol.name,
        interface: declaration.parent.name.text,
        domain: path.basename(declaration.getSourceFile().fileName, ".ts"),
        evidence: evidence(root, declaration),
      };
    })
    .sort((a, b) => compareText(a.name, b.name));
}

// Resolve only the static array/identifier/import syntax used by the registry.
// Unknown expressions fail instead of silently omitting scenarios.
export function registeredCases(root) {
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const out = {
      file,
      vars: new Map(),
      exports: new Map(),
      imports: new Map(),
    };
    modules.set(file, out);
    if (file.endsWith(".json")) {
      out.json = JSON.parse(fs.readFileSync(file, "utf8"));
      return out;
    }
    const sf = source(file);
    for (const statement of sf.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        statement.importClause &&
        !statement.importClause.isTypeOnly
      ) {
        const target = path.resolve(
          path.dirname(file),
          statement.moduleSpecifier.text.replace(/\.js$/, ".ts"),
        );
        if (statement.importClause.name)
          out.imports.set(statement.importClause.name.text, {
            target,
            name: "default",
          });
        const bindings = statement.importClause.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const item of bindings.elements)
            out.imports.set(item.name.text, {
              target,
              name: item.propertyName?.text ?? item.name.text,
            });
      }
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
            throw new Error(`Unsupported registry declaration in ${file}`);
          out.vars.set(declaration.name.text, declaration.initializer);
          if (
            statement.modifiers?.some(
              (m) => m.kind === ts.SyntaxKind.ExportKeyword,
            )
          )
            out.exports.set(declaration.name.text, declaration.name.text);
        }
      if (
        ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const item of statement.exportClause.elements)
          out.exports.set(
            item.name.text,
            item.propertyName?.text ?? item.name.text,
          );
      }
    }
    return out;
  }
  const resolving = new Set();
  function value(module, name) {
    const key = `${module.file}:${name}`;
    if (resolving.has(key)) throw new Error(`Cycle in case registry: ${key}`);
    resolving.add(key);
    let result;
    if (module.json && name === "default") {
      if (!Array.isArray(module.json))
        throw new Error(`Case file is not an array: ${module.file}`);
      result = module.json.map((item) => ({
        ...item,
        source: path.relative(root, module.file).split(path.sep).join("/"),
      }));
    } else if (module.vars.has(name))
      result = expression(module, module.vars.get(name));
    else if (module.imports.has(name)) {
      const imported = module.imports.get(name);
      const target = load(imported.target);
      result = value(
        target,
        target.exports.get(imported.name) ?? imported.name,
      );
    } else throw new Error(`Unresolved registry binding ${key}`);
    resolving.delete(key);
    return result;
  }
  function expression(module, input) {
    const node = unwrap(input);
    if (ts.isIdentifier(node)) return value(module, node.text);
    if (ts.isArrayLiteralExpression(node))
      return node.elements.flatMap((element) => {
        if (!ts.isSpreadElement(element))
          throw new Error(
            `Only static array spreads are supported in ${module.file}`,
          );
        return expression(module, element.expression);
      });
    throw new Error(`Unsupported case-registry expression: ${node.getText()}`);
  }
  return value(
    load(path.join(root, "packages/py-parity-checking/src/cases/index.ts")),
    "allCases",
  );
}

function localFunctions(sf) {
  const functions = new Map();
  walk(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body)
      functions.set(node.name.text, node);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      functions.set(node.name.text, node.initializer);
  });
  return functions;
}

function returnedObject(factory, functions) {
  return factory.body.statements
    .filter(ts.isReturnStatement)
    .map((s) => {
      let node = s.expression && unwrap(s.expression);
      if (node && ts.isIdentifier(node) && functions.has(node.text))
        node = unwrap(functions.get(node.text));
      return node;
    })
    .find((n) => n && ts.isObjectLiteralExpression(n));
}

export function tsRoutes(root, backend, methods, policy = {}) {
  const routes = new Map();
  for (const file of filesUnder(
    path.join(root, `packages/backend-${backend}/src/domains`),
    ".ts",
  )) {
    const sf = source(file);
    const functions = localFunctions(sf);
    for (const factory of sf.statements.filter(ts.isFunctionDeclaration)) {
      if (!factory.body || !factory.type) continue;
      const names = methods
        .filter((method) => method.interface === factory.type.getText())
        .map((m) => m.name);
      if (!names.length) continue;
      const returned = returnedObject(factory, functions);
      if (!returned)
        throw new Error(
          `Cannot find returned API object in ${file}:${factory.name?.text}`,
        );
      for (const property of returned.properties) {
        const name = property.name?.getText().replace(/^['"]|['"]$/g, "");
        if (!names.includes(name)) continue;
        const calls = new Set();
        const strings = new Set();
        const throws = [];
        const references = new Set();
        const calledExpressions = new Set();
        const seen = new Set();
        function trace(node, context = functions) {
          if (!node || seen.has(node)) return;
          seen.add(node);
          walk(node, (child) => {
            if (ts.isStringLiteralLike(child)) strings.add(child.text);
            if (
              ts.isThrowStatement(child) &&
              child.expression &&
              ts.isNewExpression(child.expression) &&
              child.expression.arguments?.[0] &&
              ts.isStringLiteral(child.expression.arguments[0])
            ) {
              throws.push({
                errorType: child.expression.expression.getText(),
                message: child.expression.arguments[0].text,
                evidence: evidence(root, child),
              });
            }
            if (ts.isIdentifier(child)) references.add(child.text);
            if (
              backend === "wasm" &&
              ts.isPropertyAccessExpression(child) &&
              child.name.text.startsWith("_tspice_")
            )
              calls.add(child.name.text.slice(1));
            if (ts.isCallExpression(child)) {
              const callee = child.expression;
              calledExpressions.add(callee.getText());
              if (ts.isPropertyAccessExpression(callee)) {
                if (
                  backend === "node" &&
                  callee.expression.getText() === "native"
                )
                  calls.add(callee.name.text);
                if (
                  backend === "wasm" &&
                  callee.name.text.startsWith("_tspice_")
                )
                  calls.add(callee.name.text.slice(1));
              }
              if (ts.isIdentifier(callee) && context.has(callee.text))
                trace(context.get(callee.text), context);
            }
            if (
              ts.isShorthandPropertyAssignment(child) &&
              context.has(child.name.text)
            )
              trace(context.get(child.name.text), context);
          });
        }
        trace(property);
        const override = policy[name]?.[backend];
        let delegatedEvidence = null;
        if (override) {
          if (
            override.importedFrom &&
            !sf.statements.some(
              (statement) =>
                ts.isImportDeclaration(statement) &&
                statement.moduleSpecifier.text === override.importedFrom &&
                statement.importClause?.namedBindings &&
                ts.isNamedImports(statement.importClause.namedBindings) &&
                statement.importClause.namedBindings.elements.some(
                  (item) => item.name.text === override.requiresCall,
                ),
            )
          )
            throw new Error(`Stale import policy for ${backend}.${name}`);
          if (
            override.exportIndex &&
            !source(path.join(root, override.exportIndex)).statements.some(
              (statement) =>
                ts.isExportDeclaration(statement) &&
                statement.moduleSpecifier?.text === override.exportModule &&
                statement.exportClause &&
                ts.isNamedExports(statement.exportClause) &&
                statement.exportClause.elements.some(
                  (item) => item.name.text === override.requiresCall,
                ),
            )
          )
            throw new Error(
              `Stale delegated export policy for ${backend}.${name}`,
            );
          if (
            override.requiresCall &&
            !calledExpressions.has(override.requiresCall)
          )
            throw new Error(
              `Stale route policy ${backend}.${name}: missing call ${override.requiresCall}`,
            );
          if (
            override.requiresIdentifier &&
            !references.has(override.requiresIdentifier)
          )
            throw new Error(
              `Stale route policy ${backend}.${name}: missing identifier ${override.requiresIdentifier}`,
            );
          const delegatedSource = source(path.join(root, override.file));
          const delegatedFunctions = localFunctions(delegatedSource);
          let delegated = delegatedFunctions.get(override.function);
          if (!delegated)
            throw new Error(
              `Missing delegated function for ${backend}.${name}`,
            );
          if (override.method)
            delegated = returnedObject(
              delegated,
              delegatedFunctions,
            )?.properties.find((p) => p.name?.getText() === override.method);
          if (!delegated)
            throw new Error(`Missing delegated method for ${backend}.${name}`);
          delegatedEvidence = evidence(root, delegated);
          trace(delegated, delegatedFunctions);
        }
        if (routes.has(name))
          throw new Error(`Duplicate ${backend} API route: ${name}`);
        routes.set(name, {
          evidence: evidence(root, property),
          factory: factory.name.text,
          calls: [...calls].sort(),
          strings: [...strings].sort(),
          throws,
          delegatedEvidence,
          policy: override ?? null,
        });
      }
    }
  }
  return routes;
}

// A small lexical C/C++ index, not a C preprocessor or compiler. Comments and
// string literals are tokenized separately, and balanced delimiters prevent
// declarations/comments/calls from being confused with function bodies.
export function cTokens(text) {
  const tokens = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const start = i;
    const atLine = line;
    if (/\s/.test(text[i])) {
      if (text[i++] === "\n") line++;
      continue;
    }
    if (text.startsWith("//", i)) {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (text.startsWith("/*", i)) {
      i += 2;
      while (i < text.length && !text.startsWith("*/", i)) {
        if (text[i++] === "\n") line++;
      }
      i += 2;
      continue;
    }
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i++];
      let value = "";
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") {
          value += text[i++];
          if (i < text.length) value += text[i++];
        } else {
          if (text[i] === "\n") line++;
          value += text[i++];
        }
      }
      i++;
      tokens.push({ value, kind: "string", line: atLine });
      continue;
    }
    if (/[A-Za-z_]/.test(text[i])) {
      while (i < text.length && /[A-Za-z0-9_]/.test(text[i])) i++;
      tokens.push({ value: text.slice(start, i), kind: "id", line: atLine });
    } else tokens.push({ value: text[i++], kind: "punctuation", line: atLine });
  }
  return tokens;
}

export function closeToken(tokens, start) {
  const open = tokens[start]?.value;
  const close = { "(": ")", "{": "}", "[": "]" }[open];
  if (!close || tokens[start]?.kind !== "punctuation")
    throw new Error(`Not an opening token: ${open}`);
  let depth = 1;
  for (let i = start + 1; i < tokens.length; i++) {
    if (tokens[i].kind !== "punctuation") continue;
    if (tokens[i].value === open) depth++;
    if (tokens[i].value === close && --depth === 0) return i;
  }
  throw new Error(`Unbalanced C delimiter at line ${tokens[start].line}`);
}

export function cFunctions(tokens, { staticInlineOnly = false } = {}) {
  const definitions = new Map();
  const keywords = new Set(["if", "while", "for", "switch", "catch", "sizeof"]);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (
      tokens[i].kind !== "id" ||
      keywords.has(tokens[i].value) ||
      tokens[i + 1].kind !== "punctuation" ||
      tokens[i + 1].value !== "("
    )
      continue;
    const end = closeToken(tokens, i + 1);
    if (
      tokens[end + 1]?.kind !== "punctuation" ||
      tokens[end + 1]?.value !== "{"
    )
      continue;
    if (staticInlineOnly) {
      const qualifiers = new Set();
      for (
        let j = i - 1;
        tokens[j]?.kind === "id" || tokens[j]?.value === "*";
        j--
      )
        qualifiers.add(tokens[j].value);
      if (!qualifiers.has("static") || !qualifiers.has("inline")) continue;
    }
    const bodyEnd = closeToken(tokens, end + 1);
    definitions.set(tokens[i].value, {
      line: tokens[i].line,
      body: tokens.slice(end + 2, bodyEnd),
    });
  }
  return definitions;
}

export function cCalls(tokens) {
  return [
    ...new Set(
      tokens
        .filter(
          (token, i) =>
            token.kind === "id" &&
            tokens[i + 1]?.kind === "punctuation" &&
            tokens[i + 1]?.value === "(",
        )
        .map((t) => t.value),
    ),
  ].sort();
}

export function cArguments(tokens, start) {
  const end = closeToken(tokens, start);
  const args = [];
  let from = start + 1;
  for (let i = from; i < end; i++) {
    if (tokens[i].kind !== "punctuation") continue;
    if (["(", "{", "["].includes(tokens[i].value)) i = closeToken(tokens, i);
    else if (tokens[i].value === ",") {
      args.push(tokens.slice(from, i));
      from = i + 1;
    }
  }
  args.push(tokens.slice(from, end));
  return args;
}

export function nativeExports(root) {
  const exports = new Map();
  for (const file of filesUnder(
    path.join(root, "packages/backend-node/native/src/domains"),
    ".cc",
  )) {
    const tokens = cTokens(fs.readFileSync(file, "utf8"));
    const functions = cFunctions(tokens);
    // Shared headers can define TU-local helpers using the same prefix as the
    // exported ABI. Follow only definitions in this translation unit's direct
    // includes, so a declaration or a matching name in another file cannot
    // establish an implementation route.
    for (let i = 0; i + 2 < tokens.length; i++) {
      const directive = tokens[i];
      const keyword = tokens[i + 1];
      const header = tokens[i + 2];
      if (
        directive.kind !== "punctuation" ||
        directive.value !== "#" ||
        keyword.value !== "include" ||
        keyword.line !== directive.line ||
        header.kind !== "string" ||
        header.line !== directive.line ||
        !header.value.endsWith(".h") ||
        path.basename(header.value) !== header.value
      )
        continue;
      const included = path.join(
        root,
        "packages/backend-shim-c/include",
        header.value,
      );
      if (!fs.existsSync(included)) continue;
      const locals = cFunctions(cTokens(fs.readFileSync(included, "utf8")), {
        staticInlineOnly: true,
      });
      for (const [name, definition] of locals) functions.set(name, definition);
    }
    for (let i = 0; i < tokens.length; i++)
      if (
        tokens[i].value === "SetExportChecked" &&
        tokens[i + 1]?.kind === "punctuation" &&
        tokens[i + 1]?.value === "("
      ) {
        const args = cArguments(tokens, i + 1);
        const name = args[2]?.find((t) => t.kind === "string")?.value;
        const pointerTokens = args[3];
        const newIndex = pointerTokens?.findIndex(
          (t, n) => t.value === "New" && pointerTokens[n + 1]?.value === "(",
        );
        if (!name || newIndex == null || newIndex < 0)
          throw new Error(
            `Unsupported native export at ${file}:${tokens[i].line}`,
          );
        const handler = cArguments(pointerTokens, newIndex + 1)[1]?.find(
          (t) => t.kind === "id",
        )?.value;
        if (!handler || !functions.has(handler))
          throw new Error(`No native export body for ${name} in ${file}`);
        const calls = new Set();
        const seen = new Set();
        function trace(fn) {
          if (seen.has(fn)) return;
          seen.add(fn);
          for (const call of cCalls(functions.get(fn).body)) {
            if (functions.has(call)) trace(call);
            else if (call.startsWith("tspice_") || call.endsWith("_c"))
              calls.add(call);
          }
        }
        trace(handler);
        if (exports.has(name))
          throw new Error(`Duplicate native export ${name}`);
        const registration = [...functions].find(([, fn]) =>
          fn.body.includes(tokens[i]),
        )?.[0];
        exports.set(name, {
          handler,
          registration,
          evidence: { file: path.relative(root, file), line: tokens[i].line },
          calls: [...calls].sort(),
        });
      }
  }
  return exports;
}

export function backendComposition(root, relative) {
  const sf = source(path.join(root, relative));
  const variables = localFunctions(sf);
  const factories = new Map();
  walk(sf, (node) => {
    if (!ts.isPropertyAssignment(node) || node.name.getText() !== "raw") return;
    const object = unwrap(node.initializer);
    if (!ts.isObjectLiteralExpression(object))
      throw new Error(`Unsupported raw backend composition in ${relative}`);
    for (const property of object.properties) {
      if (!ts.isSpreadAssignment(property))
        throw new Error(
          `Unsupported raw override in ${relative}; extend ledger analysis explicitly`,
        );
      let expression = unwrap(property.expression);
      if (ts.isIdentifier(expression))
        expression = unwrap(variables.get(expression.text));
      if (
        !expression ||
        !ts.isCallExpression(expression) ||
        !ts.isIdentifier(expression.expression)
      )
        throw new Error(`Unresolved raw backend spread in ${relative}`);
      factories.set(expression.expression.text, evidence(root, property));
    }
  });
  if (!factories.size)
    throw new Error(`No raw backend composition in ${relative}`);
  return { factories, variables, sf };
}

export function shimIndex(root) {
  const definitions = new Map();
  const functions = new Map();
  const declarations = new Map();
  for (const file of filesUnder(
    path.join(root, "packages/backend-shim-c/include"),
    ".h",
  )) {
    const tokens = cTokens(fs.readFileSync(file, "utf8"));
    for (let i = 0; i < tokens.length - 1; i++)
      if (
        tokens[i].kind === "id" &&
        tokens[i].value.startsWith("tspice_") &&
        tokens[i + 1].kind === "punctuation" &&
        tokens[i + 1].value === "("
      ) {
        const end = closeToken(tokens, i + 1);
        if (
          tokens[end + 1]?.kind === "punctuation" &&
          tokens[end + 1]?.value === ";"
        )
          declarations.set(tokens[i].value, {
            file: path.relative(root, file),
            line: tokens[i].line,
          });
      }
  }
  for (const file of filesUnder(
    path.join(root, "packages/backend-shim-c/src"),
    ".c",
  )) {
    for (const [name, fn] of cFunctions(
      cTokens(fs.readFileSync(file, "utf8")),
    )) {
      const relative = path.relative(root, file);
      const record = {
        evidence: { file: relative, line: fn.line },
        calls: cCalls(fn.body),
      };
      functions.set(`${relative}:${name}`, record);
      if (declarations.has(name)) {
        if (definitions.has(name))
          throw new Error(`Duplicate public C function ${name}`);
        definitions.set(name, record);
      }
    }
  }
  return {
    definitions,
    declarations,
    resolve: (name, file) =>
      functions.get(`${file}:${name}`) ?? definitions.get(name),
  };
}

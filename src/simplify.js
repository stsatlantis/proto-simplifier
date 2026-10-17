(function (root, factory) {
  const api = factory();
  root.NoBsProtoViewer = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const IDENT = /[A-Za-z0-9_]/;

  const PROTO_KEYWORDS = new Set([
    "syntax", "package", "import", "public", "weak", "option", "message",
    "enum", "service", "rpc", "returns", "stream", "oneof", "map", "reserved",
    "extend", "extensions", "group", "to", "max", "optional", "required",
    "repeated", "true", "false",
  ]);

  const PROTO_TYPES = new Set([
    "double", "float", "int32", "int64", "uint32", "uint64", "sint32",
    "sint64", "fixed32", "fixed64", "sfixed32", "sfixed64", "bool", "string",
    "bytes",
  ]);

  function isWhitespace(ch) {
    return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
  }

  function isLineWhitespace(ch) {
    return ch === " " || ch === "\t" || ch === "\r";
  }

  function skipString(src, i) {
    const quote = src[i];
    i++;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      i++;
      if (ch === quote) break;
    }
    return i;
  }

  // Index just past the ')' matching the '(' at index i.
  function matchParen(src, i) {
    const n = src.length;
    let depth = 0;
    while (i < n) {
      const ch = src[i];
      if (ch === '"' || ch === "'") {
        i = skipString(src, i);
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    return i;
  }

  function isOptionAnnotationAt(src, i) {
    if (src.substr(i, 6) !== "option") return false;
    const before = src[i - 1];
    if (before && IDENT.test(before)) return false;
    const after = src[i + 6];
    if (after && IDENT.test(after)) return false;
    let j = i + 6;
    while (j < src.length && isWhitespace(src[j])) j++;
    return src[j] === "(";
  }

  // Does an annotation `name` match any entry in the keep list? An entry matches
  // when it equals the name or is a dot-delimited suffix of it, so "field_behavior"
  // keeps "google.api.field_behavior" and the full name works too.
  function annotationMatches(name, keepList) {
    for (let k = 0; k < keepList.length; k++) {
      const entry = keepList[k];
      if (!entry) continue;
      if (name === entry) return true;
      if (name.endsWith("." + entry)) return true;
    }
    return false;
  }

  // The identifying key of a single field-option entry: the extension name for
  // "(a.b.c) = ..." or the leading identifier for a standard option "deprecated = true".
  function entryKey(entry) {
    const e = entry.trim();
    if (e[0] === "(") {
      const end = matchParen(e, 0);
      return e.slice(1, end - 1).trim();
    }
    const m = e.match(/^[A-Za-z0-9_.]+/);
    return m ? m[0] : "";
  }

  // Split a field-option block "[ ... ]" (start at '[') into top-level entries.
  function parseBracket(src, start) {
    const n = src.length;
    let i = start + 1;
    let square = 1;
    let curly = 0;
    let paren = 0;
    const entries = [];
    let entryStart = i;
    while (i < n) {
      const ch = src[i];
      if (ch === '"' || ch === "'") {
        i = skipString(src, i);
        continue;
      }
      if (ch === "(") paren++;
      else if (ch === ")") paren--;
      else if (ch === "{") curly++;
      else if (ch === "}") curly--;
      else if (ch === "[") square++;
      else if (ch === "]") {
        square--;
        if (square === 0) {
          entries.push(src.slice(entryStart, i));
          return { endIndex: i + 1, entries: entries };
        }
      } else if (ch === "," && square === 1 && curly === 0 && paren === 0) {
        entries.push(src.slice(entryStart, i));
        i++;
        entryStart = i;
        continue;
      }
      i++;
    }
    entries.push(src.slice(entryStart, i));
    return { endIndex: i, entries: entries };
  }

  // Collapse whitespace runs to single spaces, but never inside string literals.
  function collapseWhitespace(s) {
    let out = "";
    let i = 0;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (c === '"' || c === "'") {
        const e = skipString(s, i);
        out += s.slice(i, e);
        i = e;
        continue;
      }
      if (isWhitespace(c)) {
        let j = i;
        while (j < n && isWhitespace(s[j])) j++;
        out += " ";
        i = j;
        continue;
      }
      out += c;
      i++;
    }
    return out.trim();
  }

  function computeLineOf(src) {
    const arr = new Int32Array(src.length);
    let line = 1;
    for (let k = 0; k < src.length; k++) {
      arr[k] = line;
      if (src[k] === "\n") line++;
    }
    return arr;
  }

  function normalizeOptions(options) {
    const o = options || {};
    let keep = o.keepAnnotations;
    if (typeof keep === "string") keep = keep.split(/[\n,]/);
    if (!Array.isArray(keep)) keep = [];
    keep = keep.map(function (s) {
      return String(s).trim();
    }).filter(Boolean);
    return {
      keepComments: !!o.keepComments,
      keepAnnotations: keep,
      preserveBlanks: !!o.preserveBlanks,
    };
  }

  // Scan the source, dropping comments and option/annotation noise per `opts`.
  // Returns an array of { text, srcLine } where srcLine is the 1-based line in
  // the ORIGINAL source that the line's content came from.
  function stripLexical(src, opts) {
    const n = src.length;
    const lineOf = computeLineOf(src);
    const keepList = opts.keepAnnotations;
    const lines = [];
    let cur = [];
    let curSrcLine = null;
    let curAnySrcLine = null;
    let lastSig = "";
    let i = 0;

    function curBlank() {
      for (let k = 0; k < cur.length; k++) {
        if (!isLineWhitespace(cur[k])) return false;
      }
      return true;
    }

    function finalizeLine(newlineIdx) {
      let sl = curSrcLine != null ? curSrcLine : curAnySrcLine;
      if (sl == null && newlineIdx != null && newlineIdx < n) sl = lineOf[newlineIdx];
      lines.push({ text: cur.join(""), srcLine: sl });
      cur = [];
      curSrcLine = null;
      curAnySrcLine = null;
    }

    function clearCurrentLine() {
      cur = [];
      curSrcLine = null;
      curAnySrcLine = null;
    }

    function pushChar(ch, idx) {
      if (ch === "\n") {
        finalizeLine(idx);
        return;
      }
      cur.push(ch);
      const sl = idx != null ? lineOf[idx] : null;
      if (curAnySrcLine == null) curAnySrcLine = sl;
      if (!isWhitespace(ch)) {
        if (curSrcLine == null) curSrcLine = sl;
        lastSig = ch;
      }
    }

    function pushRange(from, to) {
      for (let k = from; k < to; k++) pushChar(src[k], k);
    }

    function pushSynthetic(str, idx) {
      for (let k = 0; k < str.length; k++) pushChar(str[k], idx);
    }

    function dropBlankLineRemainder(from) {
      let j = from;
      while (j < n && isLineWhitespace(src[j])) j++;
      if (j >= n || src[j] === "\n") {
        clearCurrentLine();
        return j < n ? j + 1 : j;
      }
      return from;
    }

    while (i < n) {
      const c = src[i];

      if (c === '"' || c === "'") {
        const end = skipString(src, i);
        pushRange(i, end);
        i = end;
        continue;
      }

      if (c === "/" && src[i + 1] === "/") {
        if (opts.keepComments) {
          let j = i;
          while (j < n && src[j] !== "\n") j++;
          pushRange(i, j);
          i = j;
          continue;
        }
        const blank = curBlank();
        while (i < n && src[i] !== "\n") i++;
        if (blank && !opts.preserveBlanks) i = dropBlankLineRemainder(i);
        continue;
      }

      if (c === "/" && src[i + 1] === "*") {
        let j = i + 2;
        while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
        j = Math.min(j + 2, n);
        if (opts.keepComments) {
          pushRange(i, j);
          i = j;
          continue;
        }
        const blank = curBlank();
        i = j;
        if (blank && !opts.preserveBlanks) i = dropBlankLineRemainder(i);
        continue;
      }

      if (c === "[") {
        const parsed = parseBracket(src, i);
        const kept = [];
        for (let e = 0; e < parsed.entries.length; e++) {
          const entry = parsed.entries[e];
          if (entry.trim() === "") continue;
          if (annotationMatches(entryKey(entry), keepList)) kept.push(entry);
        }
        if (kept.length) {
          const inner = kept
            .map(function (e) {
              return collapseWhitespace(e);
            })
            .join(", ");
          pushSynthetic("[" + inner + "]", i);
        }
        i = parsed.endIndex;
        continue;
      }

      if (
        c === "o" &&
        isOptionAnnotationAt(src, i) &&
        (lastSig === "" || lastSig === "{" || lastSig === "}" || lastSig === ";")
      ) {
        let p = i + 6;
        while (p < n && isWhitespace(src[p])) p++;
        const parenEnd = matchParen(src, p);
        const name = src.slice(p + 1, parenEnd - 1).trim();

        let depth = 0;
        let k = i + 6;
        while (k < n) {
          const d = src[k];
          if (d === '"' || d === "'") {
            k = skipString(src, k);
            continue;
          }
          if (d === "{") depth++;
          else if (d === "}") depth--;
          else if (d === ";" && depth === 0) {
            k++;
            break;
          }
          k++;
        }
        const stmtEnd = k;

        if (annotationMatches(name, keepList)) {
          pushRange(i, stmtEnd);
          i = stmtEnd;
        } else {
          i = stmtEnd;
          if (curBlank() && !opts.preserveBlanks) i = dropBlankLineRemainder(i);
        }
        continue;
      }

      pushChar(c, i);
      i++;
    }

    if (cur.length > 0) finalizeLine(null);

    return lines;
  }

  function squeezeBlanks(lines) {
    const res = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (line.text.trim() !== "") {
        res.push(line);
        continue;
      }
      if (res.length === 0) continue;
      if (res[res.length - 1].text.trim() === "") continue;
      if (res[res.length - 1].text.trimEnd().endsWith("{")) continue;
      let j = idx + 1;
      while (j < lines.length && lines[j].text.trim() === "") j++;
      if (j >= lines.length) continue;
      if (lines[j].text.trim().startsWith("}")) continue;
      res.push(line);
    }
    return res;
  }

  function alignBraces(lines) {
    const stack = [];
    let inStr = false;
    let quote = "";
    const res = [];
    for (const raw of lines) {
      const lead = (raw.text.match(/^[ \t]*/) || [""])[0];
      const rest = raw.text.slice(lead.length);
      let indent = lead;
      if (!inStr && rest.startsWith("}") && stack.length) {
        indent = stack[stack.length - 1];
      }
      const text = indent + rest;
      res.push({ text: text, srcLine: raw.srcLine });
      for (let k = 0; k < text.length; k++) {
        const ch = text[k];
        if (inStr) {
          if (ch === "\\") {
            k++;
            continue;
          }
          if (ch === quote) inStr = false;
          continue;
        }
        if (ch === '"' || ch === "'") {
          inStr = true;
          quote = ch;
          continue;
        }
        if (ch === "{") stack.push(indent);
        else if (ch === "}") stack.pop();
      }
    }
    return res;
  }

  function cleanup(lines, opts) {
    let ls = lines.map(function (l) {
      return {
        text: l.text.replace(/[ \t]+;/g, ";").replace(/[ \t]+$/, ""),
        srcLine: l.srcLine,
      };
    });
    if (!opts.preserveBlanks) ls = squeezeBlanks(ls);
    ls = alignBraces(ls);
    return ls;
  }

  function simplifyProtoLines(src, options) {
    if (typeof src !== "string") return [];
    const opts = normalizeOptions(options);
    return cleanup(stripLexical(src, opts), opts);
  }

  function simplifyProto(src, options) {
    if (typeof src !== "string") return "";
    return simplifyProtoLines(src, options)
      .map(function (l) {
        return l.text;
      })
      .join("\n");
  }

  // Split a single line of simplified proto into highlight tokens. Token types:
  // "text" (incl. punctuation), "string", "comment", "number", "keyword", "type".
  function tokenizeProtoLine(text) {
    const tokens = [];
    const n = text.length;
    let i = 0;

    function push(type, value) {
      const last = tokens[tokens.length - 1];
      if (last && last.type === "text" && type === "text") {
        last.value += value;
      } else {
        tokens.push({ type: type, value: value });
      }
    }

    while (i < n) {
      const c = text[i];

      if (c === " " || c === "\t") {
        let j = i;
        while (j < n && (text[j] === " " || text[j] === "\t")) j++;
        push("text", text.slice(i, j));
        i = j;
        continue;
      }

      if (c === '"' || c === "'") {
        const end = skipString(text, i);
        push("string", text.slice(i, end));
        i = end;
        continue;
      }

      if (c === "/" && text[i + 1] === "/") {
        push("comment", text.slice(i));
        i = n;
        continue;
      }

      if (c === "/" && text[i + 1] === "*") {
        let j = text.indexOf("*/", i + 2);
        j = j === -1 ? n : j + 2;
        push("comment", text.slice(i, j));
        i = j;
        continue;
      }

      if (c >= "0" && c <= "9") {
        let j = i;
        while (j < n && /[0-9a-fA-FxX.eE+\-]/.test(text[j])) j++;
        push("number", text.slice(i, j));
        i = j;
        continue;
      }

      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_.]/.test(text[j])) j++;
        const w = text.slice(i, j);
        const type = PROTO_KEYWORDS.has(w)
          ? "keyword"
          : PROTO_TYPES.has(w)
          ? "type"
          : "text";
        push(type, w);
        i = j;
        continue;
      }

      push("text", c);
      i++;
    }

    return tokens;
  }

  return {
    simplifyProto: simplifyProto,
    simplifyProtoLines: simplifyProtoLines,
    tokenizeProtoLine: tokenizeProtoLine,
  };
});

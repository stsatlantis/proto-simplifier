const test = require("node:test");
const assert = require("node:assert");
const {
  simplifyProto,
  simplifyProtoLines,
  tokenizeProtoLine,
} = require("../src/simplify.js");

function eq(input, expected) {
  assert.strictEqual(simplifyProto(input).trim(), expected.trim());
}

const EXAMPLE_1 = `message CasePriorityEscalationSettings {
    option (google.api.message_visibility).restriction = "DEV";
    option (grpc.gateway.protoc_gen_openapiv3.options.openapiv3_schema) = {
      json_schema: {
        title: "Escalation settings"
        description: "Configuration for priority escalation of cases driven by indicator updates: a case is escalated when an update from one of its indicators raises the indicator priority. This is independent of the timer-based priorityEscalationSettings, which escalates unacknowledged cases after a period of time."
        required: ["enabled"]
      }
    };

    optional bool enabled = 1 [
      (google.api.field_visibility).restriction = "DEV",
      (grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {
        description: "Enable or disable escalation of the case priority on indicator updates. Required."
        example: "true"
      }
    ];
  }`;

const EXAMPLE_2 = `message ActiveTimeframe {
  string start_time = 1 [(grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {description: "Start time."}]; // Timeframe start time: The point in the time(date-time) when the rule will start to be active.
  string end_time = 2 [(grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {description: "End time."}]; // Timeframe end time: The point in the time(date-time) when the rule will finish to be active.
  string timezone = 3 [(grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {description: "Timezone."}]; // Timeframe timezone: The rule will be active according to a specific timezone.
}`;

test("test.md Example #1: strips message options and field annotation block", () => {
  eq(
    EXAMPLE_1,
    `message CasePriorityEscalationSettings {
    optional bool enabled = 1;
}`
  );
});

test("test.md Example #2: strips inline field annotations and trailing comments", () => {
  eq(
    EXAMPLE_2,
    `message ActiveTimeframe {
  string start_time = 1;
  string end_time = 2;
  string timezone = 3;
}`
  );
});

test("standalone comment lines are removed without leaving a gap", () => {
  eq(
    `message M {
  // a doc comment
  int32 a = 1;
}`,
    `message M {
  int32 a = 1;
}`
  );
});

test("standard options (no parentheses) are kept", () => {
  eq(
    `option go_package = "github.com/x/y";
message M {
  int32 a = 1 [(custom.thing) = true];
}`,
    `option go_package = "github.com/x/y";
message M {
  int32 a = 1;
}`
  );
});

test("comment-like and bracket-like text inside string literals is preserved", () => {
  eq(
    `option java_package = "com.x // not a comment [not bracket]";
message M {
  int32 a = 1;
}`,
    `option java_package = "com.x // not a comment [not bracket]";
message M {
  int32 a = 1;
}`
  );
});

test("block comments are removed", () => {
  eq(
    `/* license header */
message M {
  int32 a = 1; /* trailing */
}`,
    `message M {
  int32 a = 1;
}`
  );
});

test("closing braces are realigned to their opener, nested messages preserved", () => {
  eq(
    `message Outer {
  message Inner {
    int32 a = 1 [(x) = 1];
  }
  int32 b = 2;
}`,
    `message Outer {
  message Inner {
    int32 a = 1;
  }
  int32 b = 2;
}`
  );
});

test("author blank lines between fields are preserved", () => {
  eq(
    `message M {
  int32 a = 1;

  int32 b = 2;
}`,
    `message M {
  int32 a = 1;

  int32 b = 2;
}`
  );
});

test("non-string input returns empty string / empty lines", () => {
  assert.strictEqual(simplifyProto(null), "");
  assert.strictEqual(simplifyProto(undefined), "");
  assert.deepStrictEqual(simplifyProtoLines(null), []);
});

// --- original row numbers ---------------------------------------------------

test("simplifyProtoLines maps each kept line to its ORIGINAL source line", () => {
  const lines = simplifyProtoLines(EXAMPLE_1);
  assert.deepStrictEqual(
    lines.map((l) => l.text),
    ["message CasePriorityEscalationSettings {", "    optional bool enabled = 1;", "}"]
  );
  assert.deepStrictEqual(
    lines.map((l) => l.srcLine),
    [1, 11, 18]
  );
});

test("simplifyProtoLines keeps contiguous numbers when nothing is dropped mid-body", () => {
  const lines = simplifyProtoLines(EXAMPLE_2);
  assert.deepStrictEqual(
    lines.map((l) => l.srcLine),
    [1, 2, 3, 4, 5]
  );
});

// --- tokenizer / highlighting ----------------------------------------------

function tok(line, value) {
  return tokenizeProtoLine(line).find((t) => t.value === value);
}

test("tokenizeProtoLine classifies keywords, builtin types, numbers", () => {
  const line = "  optional bool enabled = 1;";
  assert.strictEqual(tok(line, "optional").type, "keyword");
  assert.strictEqual(tok(line, "bool").type, "type");
  assert.strictEqual(tok(line, "1").type, "number");
  const identTok = tokenizeProtoLine(line).find((t) => t.value.includes("enabled"));
  assert.strictEqual(identTok.type, "text");
});

test("tokenizeProtoLine treats string literals as one string token", () => {
  const toks = tokenizeProtoLine('option go_package = "github.com/x/y";');
  assert.strictEqual(tok('option go_package = "github.com/x/y";', "option").type, "keyword");
  const str = toks.find((t) => t.type === "string");
  assert.strictEqual(str.value, '"github.com/x/y"');
});

test("tokenizeProtoLine reconstructs the original line exactly", () => {
  const line = "  repeated map<string, int32> items = 7;";
  const joined = tokenizeProtoLine(line)
    .map((t) => t.value)
    .join("");
  assert.strictEqual(joined, line);
});

// --- options: keep comments -------------------------------------------------

test("keepComments retains inline and standalone comments", () => {
  const input = `message M {
  // doc
  int32 a = 1; // trailing
}`;
  const out = simplifyProto(input, { keepComments: true });
  assert.ok(out.includes("// doc"), "standalone comment kept");
  assert.ok(out.includes("// trailing"), "inline comment kept");
});

// --- options: keep certain annotations --------------------------------------

test("keepAnnotations keeps matching option statements, removes others", () => {
  const input = `message M {
  option (google.api.resource) = { type: "x" };
  option (grpc.gateway.visibility).restriction = "DEV";
  int32 a = 1;
}`;
  const out = simplifyProto(input, { keepAnnotations: ["google.api.resource"] });
  assert.ok(out.includes('option (google.api.resource) = { type: "x" };'));
  assert.ok(!out.includes("visibility"), "non-matching option removed");
});

test("keepAnnotations keeps only matching entries inside a field [...] block", () => {
  const input = `message M {
  string a = 1 [(google.api.field_behavior) = REQUIRED, (grpc.openapiv3_field) = {description: "d"}];
}`;
  const out = simplifyProto(input, { keepAnnotations: ["field_behavior"] });
  assert.ok(out.includes("string a = 1 [(google.api.field_behavior) = REQUIRED];"));
  assert.ok(!out.includes("openapiv3_field"), "non-matching entry removed");
});

test("keepAnnotations matches by full name or dotted suffix", () => {
  const input = `message M {
  int32 a = 1 [(a.b.keepme) = 1];
  int32 c = 2 [(x.y.other) = 1];
}`;
  const bySuffix = simplifyProto(input, { keepAnnotations: ["keepme"] });
  assert.ok(bySuffix.includes("[(a.b.keepme) = 1]"));
  assert.ok(!bySuffix.includes("other"));
  const byFull = simplifyProto(input, { keepAnnotations: ["a.b.keepme"] });
  assert.ok(byFull.includes("[(a.b.keepme) = 1]"));
});

test("keepAnnotations accepts a newline/comma-separated string", () => {
  const input = `message M {
  int32 a = 1 [(keep.one) = 1, (drop.two) = 2];
}`;
  const out = simplifyProto(input, { keepAnnotations: "keep.one\n drop.nope" });
  assert.ok(out.includes("[(keep.one) = 1]"));
  assert.ok(!out.includes("drop.two"));
});

// --- options: compact vs. preserve blank lines ------------------------------

test("preserveBlanks leaves a blank where removed content was; compact collapses it", () => {
  const input = `message M {
  int32 a = 1;
  // removed comment
  int32 b = 2;
}`;
  assert.strictEqual(
    simplifyProto(input),
    `message M {
  int32 a = 1;
  int32 b = 2;
}`
  );
  assert.strictEqual(
    simplifyProto(input, { preserveBlanks: true }),
    `message M {
  int32 a = 1;

  int32 b = 2;
}`
  );
});

test("omitting options equals passing empty options", () => {
  const input = `message M {
  int32 a = 1 [(x) = 1]; // c
}`;
  assert.strictEqual(simplifyProto(input), simplifyProto(input, {}));
});

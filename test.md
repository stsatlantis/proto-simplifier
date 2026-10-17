=== Example #1 ===
Input:
```
message CasePriorityEscalationSettings {
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
  }
```

Output:
```
message CasePriorityEscalationSettings {
    optional bool enabled = 1;
}

```

=== Example #2 ===
Input:
```
message ActiveTimeframe {
  string start_time = 1 [(grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {description: "Start time."}]; // Timeframe start time: The point in the time(date-time) when the rule will start to be active.
  string end_time = 2 [(grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {description: "End time."}]; // Timeframe end time: The point in the time(date-time) when the rule will finish to be active.
  string timezone = 3 [(grpc.gateway.protoc_gen_openapiv3.options.openapiv3_field) = {description: "Timezone."}]; // Timeframe timezone: The rule will be active according to a specific timezone.
}
```

Output:
```
message ActiveTimeframe {
  string start_time = 1;
  string end_time = 2;
  string timezone = 3;
}
```